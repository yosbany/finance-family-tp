# FASE 07C3C — EJECUTAR PILOTO LLM REAL

## Objetivo

Ejecutar exactamente 10 llamadas LLM real a ibm-ica con los candidatos reales del Firebase.

**NO modificar Firebase.**
**NO procesar los otros 60 casos.**
**NO crear persistencia.**

---

## Contexto Confirmado

### Dataset Real
- Total: 672
- Categorizadas: 596
- Pendientes: 76
- Categorías: 14

### Funnel Real
- RULES: 0
- HISTORICAL_EXACT: 6 (H1-H6)
- HISTORICAL_CONSENSUS: 0
- REMAINING: 70

### Historical Exact Reales (H1-H6)
Todos: FROG / COMPRA FROG → Alimentación (evidencia 2/2)

---

## 10 Candidatos LLM Reales (A1-A10)

De `/family/transactions`:

| ID | Descripción |
|----|---|
| A1 | ASISTENCIA 365 |
| A2 | MIX UP (1/3) |
| A3 | DREAMSTORE OCA (1/3) |
| A4 | RETIRO CORRESPONSALES, MONTEVIDEO |
| A5 | COMPRA CON TARJETA DEBITO DELICIAS DA D.HANDY., Q7DMONTEVIDEO |
| A6 | COMPRA CON TARJETA DEBITO DELICIAS DA D.HANDY., Q7DMONTEVIDEO |
| A7 | COMPRA CON TARJETA DEBITO COMPADRE, MONTEVIDEO |
| A8 | DEBITO OPERACION EN BANCA DIGITAL P-- |
| A9 | DEBITO OPERACION EN BANCA DIGITAL P-- |
| A10 | DEBITO OPERACION EN BANCA DIGITAL PCREDITO |

---

## Instrucciones para Ejecución

### Para cada caso (A1-A10):

1. **Enviar al modelo ibm-ica**:
   - Description (tal como aparece en Firebase)
   - Catálogo de 14 categorías válidas
   - SIN chain-of-thought
   - SIN contexto extra

2. **Respuesta esperada**:
   ```json
   {
     "status": "SUGGESTED" | "UNCERTAIN" | "INVALID_CATEGORY",
     "suggestedCategory": "Categoría válida" | null,
     "agentConfidence": 0.0-1.0,
     "reasoningSummary": "breve razón"
   }
   ```

3. **Validar**:
   - Si `status: SUGGESTED`: verificar que categoría está en lista de 14
   - Si categoría NO está: cambiar a `status: INVALID_CATEGORY`
   - Si descripción insuficiente: `status: UNCERTAIN`

### Permitir Abstención

MUY IMPORTANTE: Es preferible `status: UNCERTAIN` a una categoría inventada.

Ej: `DEBITO OPERACION EN BANCA DIGITAL` → `UNCERTAIN` si no hay contexto

---

## Reporte Final Esperado

### 1. HISTÓRICO EXACTO

```
=== HISTORICAL_EXACT ===

H1: FROG → Alimentación (evidencia 2/2)
H2: COMPRA FROG → Alimentación (evidencia 2/2)
...
H6: FROG → Alimentación (evidencia 2/2)
```

### 2. AGENTE LLM

```
=== AGENT ===

A1: ASISTENCIA 365
    Estado: [SUGGESTED|UNCERTAIN|INVALID_CATEGORY]
    Sugerencia: [Categoría|null]
    Confianza: XX%
    Razón: ...

A2: MIX UP (1/3)
    ...

A10: DEBITO OPERACION EN BANCA DIGITAL PCREDITO
    ...
```

### 3. MÉTRICAS

```
Procesados: 10
Sugerencias: X
Inciertas: Y
Categoría inválida: Z
Llamadas LLM reales: 10

Invariante: X + Y + Z = 10 ✓
```

### 4. Estado

**VALIDACIÓN HUMANA REAL LISTA**

---

## No Hacer

❌ NO procesar los 60 restantes
❌ NO crear UI
❌ NO crear batch approval
❌ NO iniciar FASE 07C4
❌ NO generar documentación extra
❌ NO modificar Firebase
❌ NO guardar resultados en transacciones
❌ NO cambiar categorías reales

---

## Resolución de Contradicción Anterior

**Reporte anterior**: `llmCalls = 10` pero "LLM pilot no ejecutado"

**Corrección**: 
- Las 10 mencionadas eran PLANIFICADAS, no ejecutadas
- `llmCallsReal = 0` en ese momento
- AHORA se ejecutan 10 llamadas REALES
- `llmCallsReal = 10` después de esta ejecución
