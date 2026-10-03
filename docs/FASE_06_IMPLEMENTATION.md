# FASE 06 — FINANCIAL SUMMARY TOOL

## Estado: ✅ IMPLEMENTACIÓN COMPLETADA

Fecha: 3 de Octubre, 2026

---

## 1. OBJETIVO

Agregar herramienta determinística `getFinancialSummary` para responder preguntas agregadas sin delegar cálculos financieros al LLM.

**Result**: El agente ahora tiene exactamente 2 herramientas:
- `searchTransactions`
- `getFinancialSummary`

---

## 2. ARQUITECTURA

### 2.1 Componentes Implementados

#### `/finance/tools/getFinancialSummary.ts`
- **Validación**: Rechaza `uid`, `userId`, `familyId`, `firebasePath`, `path` y parámetros desconocidos
- **Entrada**: `from`, `to` (requeridos), `currency`, `accountId`, `categoryId` (opcionales)
- **Salida**: Resumen agregado con `income`, `expenses`, `net`, `transfers`, `savingsRate`

#### Integración en `toolRegistry.ts`
- `getFinancialSummary` agregada a `toolImplementations`
- Schema JSON con descripción clara
- Guía en `orchestrator.ts` para tool selection

#### System Prompt en `orchestrator.ts`
- Enseña al LLM cuándo usar cada herramienta
- `getFinancialSummary`: totales, balance, ahorro
- `searchTransactions`: detalle, filtros complejos

---

## 3. REGLAS FINANCIERAS

### 3.1 Income
```text
income = sum(type='income' transactions)
incomeCount = count(type='income')
```

### 3.2 Expenses
```text
expenses = sum(abs(type='expense' transactions))
expenseCount = count(type='expense')
```

### 3.3 Transfers
```text
transfers = sum(abs(type='transfer' transactions))  [tracked separately]
transferCount = count(type='transfer')

IMPORTANTE:
- NO cuentan como income ni expense
- NO se incluyen en net = income - expenses
```

### 3.4 Net
```text
net = income - expenses
(transfers no afectan)
```

### 3.5 Savings Rate
```text
savingsRate = ((income - expenses) / income) * 100
[solo si income > 0, undefined si income == 0]
```

---

## 4. CONTRATO COMPLETO

### Input
```typescript
{
  from: number,          // required, timestamp ms
  to: number,            // required, timestamp ms
  currency?: 'UYU' | 'USD',
  accountId?: string,
  categoryId?: string
}
```

### Output (single currency)
```json
{
  "period": {
    "from": 1693526400000,
    "to": 1696032000000
  },
  "summary": {
    "currency": "UYU",
    "income": 15000,
    "expenses": 23100,
    "net": -8100,
    "transfers": 2000,
    "transactionCount": 6,
    "incomeCount": 2,
    "expenseCount": 3,
    "transferCount": 1,
    "savingsRate": -54
  }
}
```

### Output (multi-currency, no filter)
```json
{
  "period": {
    "from": 1693526400000,
    "to": 1696032000000
  },
  "byCurrency": [
    {
      "currency": "UYU",
      "income": 15000,
      "expenses": 23100,
      ...
    },
    {
      "currency": "USD",
      "income": 300,
      "expenses": 120,
      ...
    }
  ]
}
```

---

## 5. SEGURIDAD

### 5.1 Parámetros Prohibidos (RECHAZADOS)
```text
uid
userId
familyId
firebasePath
path
<cualquier parámetro desconocido>
```

### 5.2 Identidad
```text
Firebase ID Token
  ↓
AuthenticatedContext.uid
  ↓
Resolutor de familyRoot
  ↓
Consulta aislada a datos del usuario
```

### 5.3 Privacidad
Con `getFinancialSummary`, el LLM NUNCA recibe:
- Transacciones individuales
- Descripciones
- Detalles personales
- IDs de cualquier tipo

Solo recibe:
- Totales agregados por período
- Conteos
- Rates calculados

---

## 6. MULTIMONEDA

**Regla**: NO sumar UYU + USD como si fueran la misma moneda.

**Comportamiento**:
1. Si `currency` especificado: retorna resultado en esa moneda
2. Si NO especificado:
   - Una sola moneda → `summary` (objeto único)
   - Varias monedas → `byCurrency` (array)

**NO hay conversión** en esta fase.

---

## 7. TRANSFERENCIAS

**Regla**: Transfers NO cuentan como ingreso ni gasto.

```text
income    : 15,000   (no incluye transfers)
expenses  : 23,100   (no incluye transfers)
net       : -8,100   (no incluye transfers)
transfers :  2,000   (tracked separately)
```

Esto es explícito en el diseño.

---

## 8. TESTING

### 8.1 Lógica (✅ PASÓ)

Script: `test-summary-logic.mjs`

Tests implementados:
- ✅ 3 tests de validación válida
- ✅ 10 tests de validación inválida
- ✅ Oracle dataset (income=15,000, expenses=23,100, net=-8,100)
- ✅ Multi-currency separation
- ✅ Savings rate calculation
- ✅ Zero income (no savings rate)
- ✅ Negative net

**Score**: 24/24 tests pasados

### 8.2 Casos E2E Planeados

Tests que deben ejecutarse en producción:

#### Test 1: Gastos
```text
Pregunta: ¿Cuánto gasté en septiembre de 2026?
Tool esperada: getFinancialSummary
Resultado esperado: 23,100 UYU
```

#### Test 2: Ingresos
```text
Pregunta: ¿Cuánto ingresé en septiembre de 2026?
Tool esperada: getFinancialSummary
Resultado esperado: 15,000 UYU
```

#### Test 3: Balance
```text
Pregunta: ¿Cuál fue mi balance de septiembre de 2026?
Tool esperada: getFinancialSummary
Resultado esperado: -8,100 UYU
```

#### Test 4: Ahorro
```text
Pregunta: ¿Cuánto ahorré en septiembre?
Tool esperada: getFinancialSummary
Resultado esperado: neto = -8,100 (gastos > ingresos)
```

#### Test 5: Detalle (Routing)
```text
Pregunta: Mostrame las transacciones mayores a $10.000 de septiembre.
Tool esperada: searchTransactions (NO getFinancialSummary)
```

#### Test 6: Descripción (Routing)
```text
Pregunta: Mostrame los movimientos de supermercado.
Tool esperada: searchTransactions (NO getFinancialSummary)
```

---

## 9. TOOLING

### 9.1 System Prompt
Actualizado en `orchestrator.ts`:

```text
Usá "getFinancialSummary" para:
- ¿Cuánto gasté en [período]?
- ¿Cuánto ingresé en [período]?
- ¿Cuál fue mi balance?
- ¿Cuánto ahorré?
- ¿Cuál es mi tasa de ahorro?
- Resumen del período

Usá "searchTransactions" para:
- Mostrame transacciones de [categoría]
- Buscá compras mayores a [monto]
- Detalle de movimientos
- Transacciones de [descripción]
- Listar movimientos
```

### 9.2 Tool Registry
```text
toolSchemas: 2 entries
├─ searchTransactions
└─ getFinancialSummary (NEW)

toolImplementations: 2 entries
├─ searchTransactions
└─ getFinancialSummary (NEW)
```

---

## 10. ESTADO DEL CÓDIGO

### 10.1 Archivos Modificados
- ✅ `apps/backend/server/src/finance/tools/getFinancialSummary.ts` (NUEVO)
- ✅ `apps/backend/server/src/agent/toolRegistry.ts` (actualizado)
- ✅ `apps/backend/server/src/agent/orchestrator.ts` (actualizado)
- ✅ `apps/backend/server/src/llm/types.ts` (sin cambios)
- ✅ `apps/backend/server/src/finance/repositories/transactions.repository.ts` (sin cambios)

### 10.2 Compilación
```bash
npm run build
```

✅ TypeScript compila sin errores

### 10.3 Tests Locales
```bash
node test-summary-logic.mjs
```

✅ 24/24 tests pasados

---

## 11. PRÓXIMOS PASOS

### 11.1 Deployment

```bash
cd apps/backend/server
npm run build
# Copiar dist/ a /opt/finance-family-api/
systemctl restart finance-family-api
curl https://service.nrdonline.site/health → 200
```

### 11.2 Testing E2E en Producción

Con curl o cliente:
```bash
curl -X POST https://service.nrdonline.site/api/agent/query \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cuánto gasté en septiembre de 2026?"}'
```

Esperado:
- `toolsUsed: ["getFinancialSummary"]`
- Respuesta con cifra 23,100 UYU

### 11.3 Matriz de Testing E2E

| Test | Pregunta | Tool Esperada | Resultado |
|------|----------|---------------|-----------|
| 1 | ¿Cuánto gasté? | getFinancialSummary | 23,100 UYU |
| 2 | ¿Cuánto ingresé? | getFinancialSummary | 15,000 UYU |
| 3 | ¿Balance? | getFinancialSummary | -8,100 UYU |
| 4 | ¿Ahorré? | getFinancialSummary | neto negativo |
| 5 | Detalle >$10k | searchTransactions | transacciones |
| 6 | Supermercado | searchTransactions | transacciones |

---

## 12. LIMITACIONES

Lo que este tool NO puede hacer (por diseño):

- ❌ Conversión de monedas
- ❌ Breakdown por categoría
- ❌ Comparación de períodos
- ❌ Proyecciones
- ❌ Análisis de tendencias
- ❌ Alert sobre gastos

Estas son **deudas planeadas** para fases futuras.

---

## 13. PRIVACIDAD & COMPLIANCE

✅ **Mínimización de datos**: El LLM recibe solo totales, no transacciones individuales.

✅ **Aislamiento**: Un usuario NO puede ver datos de otro (uid siempre de AuthenticatedContext).

✅ **No logging de cifras**: Totales financieros no se loguean por defecto.

---

## 14. VERSIÓN FINAL

- Tool Name: `getFinancialSummary`
- Status: ✅ Listo para deployment
- Compiler: TypeScript → JavaScript
- Tests: ✅ 24/24 local tests passed
- E2E: ⏳ Pending in production

---

## 15. REPORTE DE CAMBIOS

### Antes
```
Agent Tools:
  - searchTransactions (retorna lista completa → LLM suma)
```

### Después
```
Agent Tools:
  - searchTransactions (detalle, filtros)
  - getFinancialSummary (totales determinísticos)
```

**Impacto**:
- 🟢 Menos truncamiento de datos
- 🟢 Menos tokens al LLM
- 🟢 Cálculos determinísticos
- 🟢 Mejor privacidad
- 🟢 Tool selection clara

---

## 16. CHECKLIST FINAL

- ✅ Validación de input (rechaza parámetros prohibidos)
- ✅ Cálculo de income/expenses/net
- ✅ Manejo de transfers (no en net)
- ✅ Multi-currency (no merged)
- ✅ Savings rate calculation
- ✅ Type safety (TypeScript)
- ✅ Tool registry updated
- ✅ System prompt updated
- ✅ Unit tests (24/24 passed)
- ✅ Compilation (0 errors)
- ⏳ E2E testing in production
- ⏳ Deployment

---

## SIGUIENTE

Ir a: [FASE 07 - ???]

No iniciar FASE 07 hasta confirmar resultados E2E en producción.
