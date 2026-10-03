# FASE 07C — ASISTENTE DE CLASIFICACIÓN PARA PENDIENTES

## Estado: INICIADO

**Fecha Inicio:** 3 de Octubre 2026
**Objetivo:** Transformar 76 transacciones pendientes mediante sugerencias inteligentes (rules + historia + LLM fallback) con confirmación humana obligatoria.

## Dataset Actual

```
totalTransactions = 672
categorized = 596
pending = 76
categories = 14
```

**Las 596 categorizadas:** sin `classificationSource` (legacy). Usarlas como historial de referencia, no como ground truth perfecto.

## Arquitectura de Sugerencias

### Pipeline (por transacción pendiente)

```
Transacción Pendiente
  ↓
1. RULES (motor existente) → confidence ≥ 0.5
  ├─ SÍ → source: 'rules'
  ├─ NO → continuar
  ↓
2. HISTORICAL EXACT
  ├─ merchant normalizado
  ├─ si ALL apariciones → misma categoría
  └─ source: 'historical_exact', confidence = 1.0
  ├─ NO → continuar
  ↓
3. HISTORICAL CONSENSUS
  ├─ distribuir por categoría
  ├─ calcular consensus (mayoría)
  └─ source: 'historical_consensus', confidence = consensus %
  ├─ Sin predominio claro → continuar
  ↓
4. AGENT (fallback)
  ├─ solo si description semánticamente útil
  ├─ limited context (no UID, no paths)
  ├─ source: 'agent'
  └─ confidence: agentConfidence (internamente separado)
  ├─ FALLO → source: 'none'
  ↓
RESULTADO: Exactamente en un grupo primario
```

## Etapas Implementación

### Etapa 1: Correcciones de Logging (HECHA)
- ✅ No imprimir UID, Firebase paths, tokens
- ✅ Mantener: total, categorized, pending, period, agregados

### Etapa 2: Servicio de Sugerencias (EN PROGRESO)

#### classificationSuggestion.service.ts

- Input: `Transaction` (pendiente)
- Output: `ClassificationSuggestion` (máximo uno, o null si 'none')

```typescript
interface ClassificationSuggestion {
  transactionId: string;
  suggestedCategoryId: string;
  source: 'rules' | 'historical_exact' | 'historical_consensus' | 'agent' | 'none';
  confidence: number; // 0-1
  reason: string; // corto
  metadata?: {
    matchedKeywords?: string[]; // si source = 'rules'
    merchantNormalized?: string; // si source = historical_*
    sampleSize?: number; // si source = historical_consensus
    consensusPercentage?: number; // si source = historical_consensus
  };
}
```

### Etapa 3: Normalización de Merchant

- Detectar prefijos como `REDIVA `, `COMPRA `, números adyacentes
- Extraer merchant canonical
- No modificar descripción original, solo para matching

### Etapa 4: Historial Exact & Consensus

- Buscar en las 596 transacciones categorizadas legacy
- Exact: 100% coincidencia de categoría
- Consensus: mayoría (sin threshold de auto-aplicación)

### Etapa 5: Tool Read-Only Backend

**suggestTransactionCategory**

```
Input: { transactionId }
Output: {
  transactionId,
  suggestion: {
    categoryId,
    confidence,
    reasoningSummary
  }
}
```

- NO aceptar: uid, userId, familyId, firebasePath, categoryOverride
- Obtener transacción vía AuthenticatedContext
- NO escribir en Firebase

### Etapa 6: UI de Revisión (Extender Pendientes)

- Mostrar sugerencia, origen, confianza
- Filtrar por: Todas, Rules, Historial, Agente, Sin sugerencia
- Checkboxes existentes → seleccionar varias
- Botón "Aplicar sugerencias seleccionadas"

### Etapa 7: Preview + Confirmación

- Antes de persistir: mostrar N transacciones, categorías a asignar
- Confirmación simple en UI existente

### Etapa 8: Persistencia + Metadata

Cuando usuario confirma:

```typescript
if (source === 'rules') {
  classificationSource = 'rules';
  classificationConfidence = ruleConfidence;
}
if (source === 'historical_exact' || source === 'historical_consensus') {
  classificationSource = 'history';
  classificationConfidence = historicalConfidence;
}
if (source === 'agent') {
  classificationSource = 'agent';
  classificationConfidence = agentConfidence;
}

// En todos los casos:
classificationVerified = true;
verifiedAt = now;
classifiedAt = now;
```

Si usuario ignora y elige otra categoría:

```typescript
classificationSource = 'manual';
classificationVerified = true;
```

### Etapa 9: Métricas de Aceptación

Registrar metadata mínima:

```typescript
{
  transactionId,
  suggestionSource,
  suggestedCategoryId,
  accepted, // boolean
  actualCategoryId // si != suggestedCategoryId
}
```

Permite calcular: rulesAcceptanceRate, historyAcceptanceRate, agentAcceptanceRate

### Etapa 10: Tests Piloto

- Aplicar pipeline READ-ONLY sobre 76 pendientes reales
- Medir funnel:
  - 76 pendientes
  - X → rules
  - Y → historical exact
  - Z → historical consensus
  - N → agent
  - M → unresolved
  
- Pilot agente: máximo 10 no resueltas, evaluar calidad antes de expandir

### Etapa 11: Producción

- Backend build + deploy
- Frontend build + deploy (GitHub Pages)
- Health check: https://service.nrdonline.site/health → HTTP 200

## NO HACER (Alcance Limitado)

- ❌ auto-aplicar sugerencias del agente
- ❌ auto-aplicar sugerencias históricas
- ❌ cambiar rules threshold
- ❌ generar keywords automáticamente
- ❌ crear categorías nuevas
- ❌ recalificar las 596 legacy
- ❌ agregar memory
- ❌ agregar streaming
- ❌ modificar financial summary
- ❌ iniciar FASE 07D

## Criterio de Éxito

**Antes:** "yo tengo que decidir las 76"
**Después:** "el sistema propone la mayoría y yo confirmo/corrijo"

Sin auto-write del agente. Confirmación humana obligatoria.

## Reporte Final Esperado

1. **Dataset:** 672 / 596 / 76 (valores actuales)
2. **Merchant normalization:** patrones detectados
3. **Funnel:** números reales por grupo
4. **Agent Pilot:** cantidad evaluada + correct/incorrect/uncertain
5. **UI:** cómo quedó revisión
6. **Batch approval:** resultado
7. **Persistencia:** metadata final según source
8. **Acceptance Metrics:** implementado
9. **Seguridad:** suggestTransactionCategory confirmado read-only
10. **Tool Registry:** lista final
11. **Producción:** frontend/backend status
12. **Limitaciones:** claras
13. **Estado:** FASE 07C COMPLETA o BLOQUEADA

---

## Tracking de Progreso

### Completado
- ✅ Plan detallado
- ✅ Análisis de contexto

### En Progreso
- 🔄 Implementación de servicio de sugerencias
- 🔄 Normalización de merchant
- 🔄 Tool backend (suggestTransactionCategory)
- 🔄 UI extendida

### Pendiente
- ⏳ Tests piloto
- ⏳ Productionización
- ⏳ Reporte final

---

