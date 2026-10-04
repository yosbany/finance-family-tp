# FASE 07C3 — Validación Humana de Sugerencias

**Fecha**: 3 de Octubre, 2026  
**Estado**: PREPARACIÓN PARA REVISIÓN  
**Objetivo**: Medir la calidad REAL de sugerencias antes de UI o auto-aplicación  

---

## Propósito

FASE 07C3 responde preguntas críticas sobre cada mecanismo de clasificación:

| Pregunta | Métrica | Decisión |
|----------|---------|----------|
| ¿Qué tan confiables son RULES? | acceptanceRate por bucket | threshold |
| ¿HISTORICAL_EXACT es realmente 100%? | acceptanceRate | strong suggestion? |
| ¿Consenso → mejor calidad? | consensus vs acceptance | threshold |
| ¿AGENT produce sugerencias útiles? | acceptanceRate + invalid rate | include en UI? |
| ¿Fuentes suficientemente confiables? | combined metrics | phase 07C4 design |

---

## Contexto Real (FASE 07C2 Execution)

```
Total Transactions:        672
Categorized (legacy):      596
Pending:                    76

FUNNEL RESOLUTION:
├─ RULES:                  18  (threshold: 0.5)
├─ HISTORICAL_EXACT:       32  (100% consensus)
├─ HISTORICAL_CONSENSUS:   12  (> 50% consensus)
└─ REMAINING:              14
    ├─ SEMANTIC:           8   (clear context)
    ├─ AMBIGUOUS:          5   (context, multiple interpretations)
    └─ OPAQUE:             1   (insufficient info)

LLM PILOT:
├─ Candidates:            13
├─ Processed:             10
├─ Valid suggestions:      9
└─ Invalid:                1
```

---

## Muestras Preparadas para Revisión

### A. REGLAS (RULES) — Máx 10

**Criterio de selección**: Variedad de confidence buckets
- 0.50-0.74: 3 casos
- 0.75-0.89: 4 casos
- 0.90-1.00: 3 casos

**Para cada caso mostrar**:
- Caso #
- Merchant/Descripción (sanitizado)
- Categoría sugerida
- rulesConfidence
- keywords matched

**Estado**: Pendiente extracción de Firebase (script: `scripts/validate-07c3.ts`)

---

### B. HISTÓRICO EXACTO (HISTORICAL_EXACT) — Máx 10

**Criterio**: Merchant normalizado + 100% histórico misma categoría

**Para cada caso**:
- Caso #
- Merchant
- Categoría sugerida
- Tamaño de muestra histórica (ej: "8 antecedentes")
- Consensus: 100%

**Estado**: Pendiente extracción

---

### C. HISTÓRICO CONSENSO (HISTORICAL_CONSENSUS) — Máx 10

**Criterio**: Merchant normalizado + > 50% consenso histórico

**Para cada caso**:
- Caso #
- Merchant
- Categoría sugerida
- Consensus rate (ej: "7/10 = 70%")
- Tamaño de muestra

**Análisis posterior**: Correlacionar consensus % con aceptación humana

**Estado**: Pendiente extracción

---

### D. AGENTE LLM (AGENT) — 9 Propuestas Válidas

**Origen**: `docs/FASE_07C2_PROPUESTAS_PARA_REVISION.md` (líneas 20-150)

**Propuestas válidas**:

| Caso | Merchant | Categoría | agentConfidence | Razonamiento |
|------|----------|-----------|-----------------|--------------|
| AGENT_1 | Tienda de deportes | Deportes y Recreación | 0.92 | Términos retail deportivo |
| AGENT_2 | Farmacia - Medicamentos | Salud y Bienestar | 0.88 | Pattern histórico |
| AGENT_3 | Servicio de suscripción | Entretenimiento y Streaming | 0.85 | Contexto digital |
| AGENT_4 | Servicios profesionales | Servicios profesionales | 0.81 | Término explícito |
| AGENT_5 | Supermercado | Alimentos y Bebidas | 0.79 | Keyword fuerte |
| AGENT_6 | Servicios de utilidad | Servicios e Impuestos | 0.75 | Categoría estándar |
| AGENT_7 | Transferencia ambigua | Transferencias y Pagos | 0.68 | Baja confianza |
| AGENT_8 | Tienda electrodomésticos | Hogar y Equipamiento | 0.82 | Categoría bien definida |
| AGENT_10 | Restaurant | Restaurantes y Comida | 0.86 | Keywords claros |

**Nota**: AGENT_9 fue INVALID (categoría no existe en schema)

---

## Formato de Revisión

### Decisiones Permitidas por Caso

Para cada muestra, seleccionar UNA:

```
[ ] CORRECT     → La categoría sugerida es correcta
[ ] INCORRECT   → La categoría es incorrecta
                  → (Proporcionar categoría correcta si es posible)
[ ] UNCERTAIN   → No puede confirmarse
```

### Registro de Respuestas

**NO persistir en Firebase todavía.**

Usar archivo temporal de evaluación:
- `docs/FASE_07C3_HUMAN_FEEDBACK.json`

Formato:

```json
{
  "timestamp": "2026-10-03T...",
  "reviewer": "user@example.com",
  "responses": [
    {
      "caseId": "RULES_1",
      "decision": "CORRECT",
      "correctCategory": null,
      "notes": ""
    },
    {
      "caseId": "RULES_2",
      "decision": "INCORRECT",
      "correctCategory": "transportation",
      "notes": "Esta es una compra de repuestos, no servicios"
    }
  ]
}
```

---

## Análisis Posterior (Se Ejecuta Automáticamente)

### Por cada fuente, calcular:

```
reviewed = número de casos evaluados
correct = marcados como CORRECT
incorrect = marcados como INCORRECT
uncertain = marcados como UNCERTAIN

acceptanceRate = correct / (correct + incorrect)
  = CORRECTOS / DECISIVOS
  (UNCERTAIN se excluye del denominador)
```

### Para RULES, además:

```
Por confidence bucket (0.50-0.74, 0.75-0.89, 0.90-1.00):
  - acceptance rate independiente
  - Para decidir si threshold = 0.5 sigue válido
```

### Para HISTORICAL_CONSENSUS, además:

```
Tabla: consensus % vs human acceptance
  - ¿Mayor consenso → mayor aceptación?
  - ¿Hay threshold óptimo?
```

### Para AGENT, además:

```
- agentAcceptanceRate
- invalidCategoryRate (currently: 1/10 = 10%)
- Separar por confidence si sample permite
```

---

## Tabla Final de Resultados

**IMPORTANTE**: Se genera DESPUÉS de todas las respuestas humanas

```
┌─────────────────────┬──────────┬─────────┬──────────┬──────────┬─────────────┐
│ SOURCE              │ REVIEWED │ CORRECT │ INCOR    │ UNCERT   │ ACCEPTANCE  │
├─────────────────────┼──────────┼─────────┼──────────┼──────────┼─────────────┤
│ RULES (0.50-0.74)   │          │         │          │          │             │
│ RULES (0.75-0.89)   │          │         │          │          │             │
│ RULES (0.90-1.00)   │          │         │          │          │             │
│ RULES (TOTAL)       │          │         │          │          │             │
├─────────────────────┼──────────┼─────────┼──────────┼──────────┼─────────────┤
│ HISTORICAL_EXACT    │          │         │          │          │             │
├─────────────────────┼──────────┼─────────┼──────────┼──────────┼─────────────┤
│ HISTORICAL_CONSENS  │          │         │          │          │             │
├─────────────────────┼──────────┼─────────┼──────────┼──────────┼─────────────┤
│ AGENT               │          │         │          │          │             │
└─────────────────────┴──────────┴─────────┴──────────┴──────────┴─────────────┘
```

---

## Investigación del Caso AGENT Invalid

**Caso**: AGENT_9

**Descripción original**: "Pago - Otro (descripción incompleta)"

**Categoría sugerida**: `[NO_SUGERENCIA_VÁLIDA]`

**Confianza**: 0.33

**Razonamiento registrado**: "❌ INVALID_AGENT_CATEGORY - Descripción insuficiente; categoría sugerida no existe en catálogo actual"

### Preguntas a resolver:

1. **¿Error de schema?**
   - ¿Se pasó lista cerrada de categoryIds válidos al LLM?
   - ¿O el LLM inventó una categoría?

2. **¿Error de validación?**
   - La validación JSON Schema debería rechazar cualquier categoryId que no esté en la lista
   - ¿Se aplicó esta validación?

3. **¿Error del modelo?**
   - ¿El ibm-ica realmente no respeta enums en JSON Schema?
   - Implicación para FASE 07C4: agregar validación de server-side

### Resolución Propuesta

Si fue error del modelo:
- FASE 07C4 debe incluir validación de server-side
- JSON Schema enum por sí solo no es suficiente

Si fue error de validación:
- Verificar que se pasó schema correctamente
- Considerar validación más estricta en herramienta backend

---

## Restricciones Estrictas de FASE 07C3

### ✅ Permitido

- [x] Leer transacciones de Firebase
- [x] Analizar datos EN MEMORIA
- [x] Generar propuestas sin persistencia
- [x] Registrar feedback humano EN ARCHIVO LOCAL
- [x] Calcular métricas
- [x] Documentar hallazgos

### ❌ PROHIBIDO

- [ ] Modificar Firebase
- [ ] Crear endpoints
- [ ] Crear UI de batch approval
- [ ] Cambiar thresholds
- [ ] Auto-aplicar sugerencias
- [ ] Persistir decisions en transacciones
- [ ] Iniciar FASE 07C4

---

## Decisiones Esperadas de FASE 07C3

### 1. Por cada fuente: STRONG_SUGGESTION o REVIEW_REQUIRED o LOW_CONFIDENCE

**Criterios**:

- **STRONG_SUGGESTION**: acceptanceRate >= 90% + confidence >= 0.75
  - Puede mostrarse en UI con poca fricción
  - Ejemplo: HISTORICAL_EXACT si acceptance = 100%

- **REVIEW_REQUIRED**: acceptanceRate 50-89%
  - Mostrar en UI pero requiere confirmación manual
  - Ejemplo: Muchas fuentes probablemente aquí

- **LOW_CONFIDENCE**: acceptanceRate < 50%
  - No mostrar automáticamente
  - Ej: AGENT si tiene muchos rechazos

### 2. RULES: ¿Threshold = 0.5 es óptimo?

Analizar acceptance por bucket:
- Si 0.50-0.74 tiene < 70% acceptance: raise threshold a 0.75
- Si 0.90-1.00 tiene 100% acceptance: considerar special handling

### 3. Nuevas categorías necesarias?

Del análisis de rechazos (INCORRECT):
- ¿Categorías que sugirió el agente pero no existen?
- ¿Categorías insuficientes en current schema?

### 4. Patrones de error

Por cada fuente, documentar:
- ¿Cuándo se equivoca cada mecanismo?
- ¿Hay transacciones que todas las fuentes rechazan?
- ¿Hay categorías que se confunden frecuentemente?

---

## Próximos Pasos

### Inmediato (esta sesión)

1. [x] Preparar script `scripts/validate-07c3.ts`
2. [ ] Ejecutar script → generar `FASE_07C3_VALIDATION_DATA.json`
3. [ ] Crear Canvas interactivo para revisión
4. [ ] Usuario revisa y completa decisiones
5. [ ] Script calcula métricas finales

### FASE 07C4 (diseño solamente, NO implementación)

Según evidencia, diseñar:
- UI de batch approval
- Thresholds por fuente
- Integración en clasificación workflow
- Strategy de nuevas categorías

### FASE 07C5+ (después de aprobación)

- Implementación de UI
- Integración de decisiones
- Testing end-to-end
- Rollout gradual

---

## Archivos de FASE 07C3

| Archivo | Contenido | Rol |
|---------|-----------|-----|
| `scripts/validate-07c3.ts` | Script de extracción | Genera muestras |
| `FASE_07C3_VALIDATION_DATA.json` | Muestras preparadas | Input para revisión |
| `FASE_07C3_HUMAN_FEEDBACK.json` | Decisiones humanas | Temporal, local |
| `FASE_07C3_VALIDACION_HUMANA.md` | Este documento | Guía + reportes |
| `FASE_07C3_RESULTADOS_FINALES.md` | Análisis + conclusiones | Decisiones para 07C4 |

---

## Estado

### ACTUAL
- **FASE 07C3**: PREPARATION PHASE
- **Scripts**: Listos para ejecución
- **Awaiting**: Validación humana de muestras

### PRÓXIMO
- Ejecutar `scripts/validate-07c3.ts` en VPS
- Revisar muestras en Canvas interactivo
- Calcular métricas finales

---

**FASE 07C3 DOCUMENT**  
*Última actualización: Oct 3, 2026*
