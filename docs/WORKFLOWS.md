# 🔄 Workflows - Finance Family

Documentación de los flujos de trabajo principales en Finance Family.

---

## 📋 Tabla de Contenidos

1. [Categorización de Transacciones](#categorización-de-transacciones)
2. [Pipeline de Sugerencias](#pipeline-de-sugerencias)
3. [Validación Humana](#validación-humana)
4. [Sincronización de Datos](#sincronización-de-datos)

---

## 📊 Visualización Interactiva

Abre el **[Workflow Categorización Canvas](/Users/yosbanytejas/.cursor/projects/Users-yosbanytejas-Documents-finance-family/canvases/categorization-workflow.canvas.tsx)** para una visualización interactiva del pipeline completo. Haz clic en cada etapa para ver detalles adicionales.

---

## 🏷️ Categorización de Transacciones

### Descripción General

El sistema de categorización automática utiliza múltiples estrategias para sugerir categorías a las transacciones. Cada estrategia tiene un nivel de confianza diferente.

**Estrategias (por confiabilidad):**

1. **RULES** - Patrones configurados manualmente
2. **HISTORICAL_EXACT** - Histórico: 100% coincidencia
3. **HISTORICAL_CONSENSUS** - Histórico: >50% consenso
4. **AGENT** - Sugerencias del LLM

---

### Flujo Principal: Categorización de Transacción Pendiente

```
┌─────────────────────────────────┐
│  Transacción Pendiente          │
│  (sin categorizar)              │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  RULES                          │
│  (Patrones configurados)        │
│  - confidence >= 0.5            │
└────────────┬────────────────────┘
             │
             ├─ ✅ MATCH → Proponer + Salir
             │
             ├─ ❌ NO MATCH → Continuar
             │
             ▼
┌─────────────────────────────────┐
│  HISTORICAL_EXACT               │
│  (Búsqueda en histórico)        │
│  - 100% coincidencia            │
└────────────┬────────────────────┘
             │
             ├─ ✅ MATCH → Proponer + Salir
             │
             ├─ ❌ NO MATCH → Continuar
             │
             ▼
┌─────────────────────────────────┐
│  HISTORICAL_CONSENSUS           │
│  (Búsqueda con tolerancia)      │
│  - > 50% consenso               │
└────────────┬────────────────────┘
             │
             ├─ ✅ MATCH → Proponer + Salir
             │
             ├─ ❌ NO MATCH → Continuar
             │
             ▼
┌─────────────────────────────────┐
│  AGENT (LLM)                    │
│  (Sugerencia inteligente)       │
│  - Consulta contexto            │
└────────────┬────────────────────┘
             │
             ├─ ✅ Propuesta válida → Sugerir
             │
             ├─ ❓ Incertidumbre → Abstenerse
             │
             ▼
┌─────────────────────────────────┐
│  Resultado                      │
│  - Categoría + Confianza        │
│  - O: Manual (usuario)          │
└─────────────────────────────────┘
```

---

### Algoritmo: AGENT - Búsqueda Inteligente

**Entrada**: Transacción pendiente con descripción/merchant

**Proceso Principal**:

```
TRANSACCIÓN PENDIENTE
        ↓
   REGLAS (RULES)
        ↓
HISTÓRICO EXACTO (HISTORICAL_EXACT)
        ↓
AGENT (Búsqueda Inteligente)
        ↓
Puede consultar historial real
        ↓
Busca merchants/descripciones similares
        ↓
Ve cómo los categorizaste anteriormente
        ↓
Propone categoría o se abstiene
```

#### Detalles del Flujo AGENT

1. **Normalización de Entrada**
   - Convertir descripción a formato estándar
   - Extraer merchant principal
   - Limpiar información innecesaria

2. **Consulta de Histórico Real**
   - Buscar transacciones con merchant similar
   - Considerar contexto temporal (reciente vs. antiguo)
   - Analizar montos (patrón de gasto)

3. **Búsqueda de Patrones**
   - Palabras clave relevantes
   - Expresiones regulares (ej: "SUPER", "MARKET", "STORE")
   - Dominio de la transacción (ej: ".com", país)

4. **Análisis de Consenso**
   - Si hay múltiples históricos: calcular consenso
   - Umbral de confianza: >50% para proponer
   - Si hay conflicto: abstenerse

5. **Decisión Final**
   - ✅ Proponer categoría (confianza >70%)
   - ⓘ Sugerir múltiples opciones (50-70%)
   - ❌ Abstenerse (confianza <50%)

**Contexto que Consulta el AGENT**:

```
✓ Transacciones previas del mismo usuario
✓ Merchants similares (búsqueda fuzzy)
✓ Palabras clave históricas
✓ Patrones de gasto por categoría
✓ Temporalidad (transacciones recientes)
✓ Montos típicos por categoría
```

**Ejemplos de Funcionamiento**:

| Descripción | Contexto | RULES | HIST_EXACT | AGENT | Resultado |
|---|---|---|---|---|---|
| `MERCADO CENTRAL` | Usuario compra en mercados | ❌ | ✅ → "Supermercado" | - | Supermercado |
| `SPOTIFY.COM` | Usuario paga suscripciones | ✅ (0.9) | - | - | Suscripciones |
| `AMAZON PRIME` | Compra de todo tipo | ❌ | ⓘ (20% electro, 30% casa) | Busca histórico reciente | Propone basado en contexto |
| `XYZ CORP INC` | Desconocido, sin histórico | ❌ | ❌ | Incertidumbre | Abstenerse → Manual |

---

---

## 🤖 Implementación Técnica del AGENT

### Arquitectura

El AGENT se ejecuta como una **función serverless** en Firebase Cloud Functions con acceso a:

1. **Firestore Database**
   - Índice de transacciones históricas
   - Mapa de categorías por merchant
   - Matriz de consenso

2. **LLM (Modelo de Lenguaje)**
   - Análisis de descripción
   - Extracción de entidades
   - Decisión de confianza

3. **Cache Local**
   - Transacciones recientes
   - Patrones frecuentes
   - Resultados previos

### Función Principal

```typescript
async function categorizeWithAgent(
  transaction: Transaction
): Promise<Suggestion | null> {
  // 1. Normalizar
  const normalized = normalizeMerchant(transaction.description);
  
  // 2. Buscar en histórico
  const historicalMatches = await findHistoricalMatches(normalized);
  
  if (historicalMatches.length > 0) {
    return analyzeConsensus(historicalMatches);
  }
  
  // 3. Consultar LLM si no hay histórico
  const llmSuggestion = await llm.suggestCategory(transaction, {
    userHistory: historicalMatches,
    recentCategories: await getRecentCategories(transaction.userId),
    spendingPatterns: await getUserPatterns(transaction.userId)
  });
  
  // 4. Validar confianza
  if (llmSuggestion.confidence > CONFIDENCE_THRESHOLD) {
    return llmSuggestion;
  }
  
  return null; // Abstenerse
}
```

### Performance

- **Latencia objetivo**: <1 segundo por transacción
- **Cache hit rate**: ~70% (sin necesidad de LLM)
- **Costo por llamada**: Bajo cuando usa histórico, más alto con LLM

### Métricas Clave

```
categorizeWithAgent:
  ├─ cache_hit (% de veces que encuentra en histórico)
  ├─ llm_calls (veces que activa LLM)
  ├─ confidence_dist (distribución de confianza)
  ├─ latency_p50/p95/p99
  └─ acceptance_rate (cuántas propuestas acepta usuario)
```

---

## 🔀 Pipeline de Sugerencias

### Componentes Principales

```
Frontend (User Input)
    │
    ├─ Transacción pendiente
    │
    ▼
Backend (Processing)
    │
    ├─ 1. Validar transacción
    ├─ 2. Ejecutar RULES
    ├─ 3. Ejecutar HISTORICAL_EXACT
    ├─ 4. Ejecutar HISTORICAL_CONSENSUS
    ├─ 5. Ejecutar AGENT (si necesario)
    │
    ▼
Firestore (Storage)
    │
    ├─ Guardar sugerencia
    ├─ Guardar feedback del usuario
    │
    ▼
Frontend (Display)
    │
    └─ Mostrar sugerencia + Botones
       - Aceptar
       - Rechazar
       - Editar
```

### Estados de una Sugerencia

```
PENDING (creada)
    │
    ├─ ACCEPTED (usuario confirmó)
    │   └─ Transacción categorizada
    │
    ├─ REJECTED (usuario rechazó)
    │   └─ Feedback enviado
    │
    └─ EXPIRED (tiempo máximo)
        └─ No se actualizó
```

---

## ✅ Validación Humana

### FASE 07C3 - Validación de Calidad

**Objetivo**: Determinar confiabilidad de cada estrategia

**Datos a validar**:
- RULES: ~18 casos con confianza variada
- HISTORICAL_EXACT: ~32 casos con 100% consenso
- HISTORICAL_CONSENSUS: ~12 casos con >50% consenso
- AGENT: ~10 casos de LLM

**Proceso**:

```
1. Extraer muestras diversas
   ↓
2. Mostrar sugerencias al usuario
   ↓
3. Usuario valida: Aceptar/Rechazar
   ↓
4. Calcular tasa de aceptación por estrategia
   ↓
5. Análisis de resultados
   - RULES: ¿Qué confianza es confiable?
   - HISTORICAL: ¿Consenso mínimo?
   - AGENT: ¿Qué contexto ayuda?
   ↓
6. Recomendaciones para FASE 07C4
```

**Output Esperado**:

```json
{
  "RULES": {
    "0.9+": { "acceptance": 0.95, "samples": 5 },
    "0.7-0.89": { "acceptance": 0.80, "samples": 8 },
    "0.5-0.69": { "acceptance": 0.60, "samples": 5 }
  },
  "HISTORICAL_EXACT": { "acceptance": 0.98, "samples": 32 },
  "HISTORICAL_CONSENSUS": { "acceptance": 0.75, "samples": 12 },
  "AGENT": { "acceptance": 0.70, "samples": 9 }
}
```

---

## 🔄 Sincronización de Datos

### Actualización de Histórico

Cuando el usuario categoriza una transacción (manual o acepta sugerencia):

```
User Action (Aceptar/Rechazar/Editar)
    │
    ▼
Update Transaction
    │
    ├─ Guardar categoría
    ├─ Guardar timestamp
    ├─ Marcar como "user_confirmed"
    │
    ▼
Update Historical Index
    │
    ├─ Normalizador: merchant/descripción
    ├─ Agregar entrada a índice
    ├─ Actualizar consenso si hay múltiples
    │
    ▼
Regenerar Sugerencias
    │
    ├─ Otras transacciones pendientes
    ├─ Puede que ahora tengan HISTORICAL_EXACT
    │
    ▼
Notificar Usuario
    │
    └─ Transacciones categorizadas
```

### Invalidación de Cache

El índice histórico se regenera cuando:

1. Usuario agrega regla (RULES)
2. Usuario categoriza transacción
3. Usuario sincroniza desde banco
4. Se ejecuta validación FASE 07C3

---

## 📊 Métricas y Monitoreo

### KPIs Principales

| Métrica | Descripción | Target |
|---------|-------------|--------|
| **Auto-Categorization Rate** | % transacciones categorizadas automáticamente | >70% |
| **Acceptance Rate** | % sugerencias aceptadas por usuario | >80% |
| **False Positive Rate** | % sugerencias incorrectas | <10% |
| **Time to Categorize** | Tiempo promedio por transacción | <1s |

### Logs Relevantes

```
categorization:start → transactionId, description
categorization:rule_match → rule_id, confidence
categorization:historical_exact → count, categories
categorization:historical_consensus → consensus_pct
categorization:agent_call → model, latency
categorization:success → categoryId, source
categorization:error → error_type, reason
```

---

## 🔗 Documentos Relacionados

- [FASE_07C2_ACLARACION_PIPELINE.md](./FASE_07C2_ACLARACION_PIPELINE.md) - Detalle técnico del pipeline
- [FASE_07C3_STATUS.md](./FASE_07C3_STATUS.md) - Estado de validación humana
- [API.md](./API.md) - Endpoints de categorización
- [TECHNICAL_VALIDATION.md](./TECHNICAL_VALIDATION.md) - Validaciones técnicas

---

**Última actualización**: Oct 4, 2026  
**Versión**: 1.0.0  
**Autor**: Documentation System
