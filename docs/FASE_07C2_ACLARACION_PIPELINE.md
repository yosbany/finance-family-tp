# FASE 07C2 - ACLARACIÓN DE PIPELINE IMPLEMENTADO (HOY)

**Fecha:** 3 de Octubre 2026
**Objetivo:** Clarificar exactamente qué etapas del pipeline están implementadas y cuáles son declarativas.

---

## 📋 TABLA COMPARATIVA: DISEÑO vs REALIDAD

| Etapa | Diseño Declarado | ¿REALMENTE IMPLEMENTADO? | Estado | Notas |
|-------|------------------|--------------------------|--------|-------|
| **RULES** | Sí, threshold 0.5 | **❌ NO** | Pendiente | `categorizeTransaction()` existe solo en frontend |
| **HISTORICAL_EXACT** | Sí | ✅ SÍ | Completo | Backend: `suggestFromHistoricalExact()` en service |
| **HISTORICAL_CONSENSUS** | Sí | ✅ SÍ | Completo | Backend: `suggestFromHistoricalConsensus()` en service |
| **AGENT** | Fallback LLM | **❌ NO** | No iniciado | Pipeline aún no integra LLM |
| **NONE** | Default | ✅ SÍ | Completo | Retorna cuando no hay sugerencia |

---

## 🔍 ANÁLISIS DETALLADO

### 1. RULES - ❌ PENDIENTE

#### Código Existe:
- **Ubicación:** `apps/frontend/src/utils/categorization.ts`
- **Función:** `categorizeTransaction(description, categories)`
- **Lógica:** 
  - Tokenización avanzada
  - N-gramas
  - Extracción de entidades
  - Scoring ponderado
  - Resultado: `{ categoryId, confidence >= 0.5, matchedKeywords }`

#### ¿Por qué NO está integrado en FASE 07C?

```typescript
// apps/backend/server/src/finance/services/classificationSuggestion.service.ts

async function suggestFromHistory(
  transaction: any,
  historicalTransactions: any[]
): Promise<ClassificationSuggestion | null> {
  // 1. EXACT
  const exactSuggestion = await suggestFromHistoricalExact(...);
  if (exactSuggestion) return exactSuggestion;

  // 2. CONSENSUS
  const consensusSuggestion = await suggestFromHistoricalConsensus(...);
  if (consensusSuggestion) return consensusSuggestion;

  // FALTA AQUÍ: Motor de RULES no se llama
  // En comentario: "(RULES y AGENT se implementan en el llamador, fuera del servicio)"
  
  return null; // Retorna NONE sin evaluar RULES
}
```

#### Pipeline Actual Real:

```
TRANSACCIÓN PENDIENTE
  ↓
HISTORICAL_EXACT → Resolver con confidence 1.0
  ├─ NO → HISTORICAL_CONSENSUS
  │ ├─ Resolver con consensus %
  │ ├─ NO → NONE (source: 'none')
  │
  └─ (RULES NUNCA SE EVALÚA)
  └─ (AGENT NUNCA SE EVALÚA)
```

#### Qué Se Necesita:
1. Importar `categorizeTransaction` del frontend al backend
2. O reimplementar el motor de reglas en backend TypeScript
3. Llamar a RULES **antes** que HISTORICAL_EXACT
4. Si `rulesConfidence >= 0.5`: retornar `{ source: 'rules', confidence }`

---

### 2. HISTORICAL_EXACT - ✅ IMPLEMENTADO

#### Código:
```typescript
// apps/backend/server/src/finance/services/classificationSuggestion.service.ts (líneas 80-120)

export function normalizeMerchant(description: string): string {
  // Elimina prefijos: REDIVA, COMPRA, PAGO, TRF
  // Elimina números al inicio (códigos de ref)
  // Normaliza espacios
}

async function suggestFromHistoricalExact(
  transaction: any,
  historicalTransactions: any[]
): Promise<ClassificationSuggestion | null> {
  const merchantNorm = normalizeMerchant(transaction.description);
  
  const matches = historicalTransactions.filter(tx => {
    const txMerchantNorm = normalizeMerchant(tx.description);
    return txMerchantNorm === merchantNorm;
  });

  if (matches.length === 0) return null;

  const categories = new Set(matches.map(m => m.category).filter(c => c));
  
  if (categories.size === 1) {
    // TODAS las apariciones tienen la misma categoría
    return {
      transactionId: transaction.id,
      suggestedCategoryId: [...categories][0],
      source: 'historical_exact',
      confidence: 1.0,
      metadata: {
        merchantNormalized: merchantNorm,
        sampleSize: matches.length
      }
    };
  }
  
  return null; // Si hay múltiples categorías, ir a CONSENSUS
}
```

#### Status: ✅ Completo y funcional

---

### 3. HISTORICAL_CONSENSUS - ✅ IMPLEMENTADO

#### Código:
```typescript
// apps/backend/server/src/finance/services/classificationSuggestion.service.ts (líneas 122-190)

async function suggestFromHistoricalConsensus(
  transaction: any,
  historicalTransactions: any[]
): Promise<ClassificationSuggestion | null> {
  const merchantNorm = normalizeMerchant(transaction.description);
  
  const matches = historicalTransactions.filter(tx => {
    const txMerchantNorm = normalizeMerchant(tx.description);
    return txMerchantNorm === merchantNorm;
  });

  if (matches.length < 2) return null; // Necesita mínimo 2

  // Contar por categoría
  const categoryCounts = new Map<string, number>();
  matches.forEach(m => {
    if (m.category) {
      categoryCounts.set(m.category, (categoryCounts.get(m.category) || 0) + 1);
    }
  });

  // Encontrar categoría con más apariciones
  let maxCategory = '';
  let maxCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > maxCount) {
      maxCategory = cat;
      maxCount = count;
    }
  }

  const consensus = maxCount / matches.length;
  
  // Sugerir si consensus > 50%
  if (consensus > 0.5) {
    return {
      transactionId: transaction.id,
      suggestedCategoryId: maxCategory,
      source: 'historical_consensus',
      confidence: consensus,
      metadata: {
        merchantNormalized: merchantNorm,
        sampleSize: matches.length,
        consensusPercentage: Math.round(consensus * 100)
      }
    };
  }

  return null;
}
```

#### Status: ✅ Completo y funcional

---

### 4. AGENT (Fallback LLM) - ❌ NO IMPLEMENTADO

#### Código: INEXISTENTE

El servicio de sugerencias NO contiene lógica de LLM:

```typescript
// apps/backend/server/src/finance/services/classificationSuggestion.service.ts

// Línea 200-230:
async function suggestFromHistory(transaction: any, historicalTransactions: any[]) {
  // 1. EXACT
  // 2. CONSENSUS
  // 3. ... nada más. No hay AGENT
  return null; // NONE
}

export async function generateSuggestion(
  context: AuthenticatedContext,
  transactionId: string,
  allTransactions: any[]
): Promise<ClassificationSuggestion> {
  // ... obtiene sugerencia del historial
  // No hay LLM
  return {
    // ... retorna resultado
  };
}
```

#### Qué Falta:
1. **No existe `callLLMForClassification()`** en backend
2. **No existe integración con OpenAI/LLM client**
3. **La orquestación no llama a LLM**
4. El comentario en el código dice: `"(RULES y AGENT se implementan en el llamador, fuera del servicio)"`

---

## 📊 RESUMEN: PIPELINE REAL HOY

```
┌─────────────────────────────────────────────────────────┐
│ TRANSACCIÓN PENDIENTE                                   │
└────────────────────┬────────────────────────────────────┘
                     │
    ┌────────────────▼─────────────────┐
    │ 1. RULES                         │
    │ ❌ NO SE EJECUTA                 │
    │ (Motor existe frontend, no conectado) │
    └────────────────┬─────────────────┘
                     │
    ┌────────────────▼─────────────────────────────┐
    │ 2. HISTORICAL EXACT                         │
    │ ✅ Se ejecuta                                │
    │ → Merchant normalizado coincide 100%?       │
    │ → Todos esos históricos = misma cat?        │
    │   ├─ SÍ → Retorna confidence = 1.0          │
    │   └─ NO → Continuar                         │
    └────────────────┬─────────────────────────────┘
                     │
    ┌────────────────▼──────────────────────────────┐
    │ 3. HISTORICAL CONSENSUS                      │
    │ ✅ Se ejecuta                                 │
    │ → Merchant normalizado aparece N veces?      │
    │ → Categoría mayoritaria > 50%?               │
    │   ├─ SÍ → Retorna confidence = consensus %   │
    │   └─ NO → Continuar                          │
    └────────────────┬──────────────────────────────┘
                     │
    ┌────────────────▼──────────────┐
    │ 4. AGENT                      │
    │ ❌ NO SE EJECUTA              │
    │ (No implementado aún)         │
    └────────────────┬──────────────┘
                     │
    ┌────────────────▼──────────────┐
    │ 5. NONE                       │
    │ ✅ Se retorna siempre         │
    │ source = 'none'               │
    │ confidence = 0                │
    └────────────────┬──────────────┘
                     │
    ┌────────────────▼──────────────┐
    │ RESULTADO FINAL               │
    │ (Source: Historical o None)   │
    └───────────────────────────────┘
```

---

## 🔗 PUNTOS DE INTEGRACIÓN

### Tool Registry (Backend)
- ✅ Tiene `suggestTransactionCategory` registrado
- ✅ Importa `generateSuggestion` del servicio
- ✅ Ejecuta correctamente sobre histórico

### Archivo Principal:
- `apps/backend/server/src/finance/services/classificationSuggestion.service.ts`

### Archivo Motor RULES (frontend):
- `apps/frontend/src/utils/categorization.ts`
- NO está conectado al pipeline de sugerencias backend

---

## 🎯 DECISIÓN PARA FASE 07C2

### Opción A: Integrar RULES en esta fase
**Pros:**
- Completa el pipeline determinístico
- Podría resolver ~15-30% adicional de las 76

**Cons:**
- Requiere copiar lógica del frontend o crear puerto backend
- Más líneas de código
- Mayor complejidad

**Esfuerzo:** 1-2 horas

### Opción B: Medir con HISTORICAL solamente
**Pros:**
- Ya está completamente implementado
- Rápido, sin cambios

**Cons:**
- No usamos el motor de RULES
- Resultados parciales

**Esfuerzo:** 0 horas

---

## 📝 CÓDIGO QUE SÍ EXISTE Y FUNCIONA

### 1. Normalización de Merchant (✅)
```typescript
normalizeMerchant("REDIVA 19210SKIN FACTORY") → "SKIN FACTORY"
normalizeMerchant("COMPRA FROG") → "FROG"
```

### 2. Búsqueda Histórica Exacta (✅)
```
Si N apariciones del mismo merchant normalizado
Y TODAS tienen categoría C
→ Retorna sugerencia con confidence = 1.0
```

### 3. Búsqueda Histórica Consenso (✅)
```
Si N apariciones del mismo merchant normalizado
Y categoría C aparece en M de esas N (M/N > 50%)
→ Retorna sugerencia con confidence = M/N
```

### 4. Tool Read-Only (✅)
```typescript
Input: { transactionId }
Output: { suggestion: { categoryId, confidence, reasoningSummary } }
No escribe en Firebase
Rechaza uid, userId, familyId, firebasePath
```

---

## ✋ REQUISITO CRÍTICO PARA FASE 07C2

**Aclarar HOY:**

¿Querés que en FASE 07C2:
1. **Integre RULES** (opción A) → Pipeline COMPLETO (Rules + Historical + Agent)
2. **Mida con lo que existe** (opción B) → Pipeline PARCIAL (Historical + None)

La decisión impacta:
- Números reales esperados
- Cantidad de "restantes para agente"
- Complejidad de FASE 07C3

---

## 🔐 SEGURIDAD CONFIRMADA

✅ `suggestTransactionCategory`:
- No acepta uid, userId, familyId
- No acepta firebasePath, categoryOverride
- No escribe en Firebase
- Validación server-side
- Output sanitizado

---
