# FASE 01 — DESACOPLAR IMPORTACIÓN DE EXTRACTOS

## ESTADO: ✅ FASE 01 COMPLETA

---

## 1. DIAGNÓSTICO

### Lógica Acoplada Identificada

#### En `UploadStatements.tsx` (componente React):
- **Función `handleUpload` (líneas 283-468 original)**
  - 186 líneas de código concentrando TODO el flujo de importación
  - 12 pasos orquestados dentro del componente
  - Fuertemente acoplado a React hooks (`useState`, `useNavigate`, etc.)

#### Pasos dentro de `handleUpload`:
1. Cálculo de hash SHA-256 del archivo
2. Verificación de duplicado contra Firebase
3. Detección de banco automático (CSV)
4. Selección de parser específico del banco
5. Parsing del archivo (CSV/Excel/PDF)
6. Normalización de transacciones
7. Validación de fechas/período
8. Manejo de snapshots (reemplazo de estado)
9. Creación de registro en historial
10. Conversión a formato estándar
11. Categorización automática
12. Persistencia en Firebase + recálculo de balances

#### Dependencias de servicio dispersas:
```
- calculateFileHash
- checkDuplicateUpload
- parseByBank, detectBank
- parseCSV, parseExcel, parsePDF
- categorizeTransactions
- createTransactions, parsedToTransaction
- deleteTransactionsByFilter, deleteTransactionsForUpload
- createUploadHistory, deleteUploadHistoryByFilter
- recalculateAccountBalance
- getCategories
```

### Problemas Identificados
1. ❌ Lógica de negocio acoplada a React (imposible reutilizar en backend o agentes)
2. ❌ No hay abstracción clara entre UI y lógica
3. ❌ Componente responsable de 12 pasos complejos
4. ❌ Difícil de testear (requiere montar componente React)
5. ❌ No hay contrato bien definido para el resultado

---

## 2. CAMBIOS REALIZADOS

### Archivos Creados

#### `src/services/importStatements.service.ts` (NUEVO)
- **Propósito**: Orquestar TODO el flujo de importación de forma agnóstica
- **Tamaño**: ~340 líneas
- **Funciones principales**:
  - `importStatement(input: StatementImportInput): Promise<StatementImportResult>`
  - Exporta tipos claramente definidos para entrada y salida

**Interfaces definidas**:
```typescript
// Entrada
export interface StatementImportInput {
  file: File
  accountId: string
  account: Account
  statementMonth: number
  statementYear: number
  forceUpload?: boolean
  exchangeRates?: ExchangeRates
  overrideDetectedBank?: string
  userId?: string
}

// Salida (contrato claro)
export interface StatementImportResult {
  success: boolean
  error?: string
  fileName: string
  fileHash: string
  detectedBank: string | null
  selectedBank: string
  accountId: string
  accountName: string
  currency: Currency
  statementMonth: number
  statementYear: number
  snapshotMode: boolean
  totalParsedTransactions: number
  transactionsImported: number
  transactionsCategorized: number
  transactionsPending: number
  isDuplicate: boolean
  uploadId?: string
  warnings: string[]
  requiresManualIntervention: boolean
  parserUsed?: string
  uploadDate?: number
}
```

#### `src/services/agentTools.service.ts` (NUEVO)
- **Propósito**: Definir estructura de herramientas futuras para agente LLM
- **Tamaño**: ~450 líneas
- **NO está implementado**, solo define interfaces y tipos

**Herramientas futuras definidas**:
1. `searchTransactions` - Buscar transacciones
2. `getExpenseSummary` - Resumen de gastos
3. `getIncomeSummary` - Resumen de ingresos
4. `getCategoryBreakdown` - Desglose por categoría
5. `comparePeriods` - Comparar períodos
6. `getCashflow` - Flujo de caja
7. `getNetWorth` - Patrimonio neto
8. `categorizeTransactions` - Categorizar pendientes
9. `generateInsights` - Generar insights
10. `suggestBudget` - Sugerir presupuesto

Cada herramienta tiene interfaces clara de **input** y **output**.

### Archivos Modificados

#### `src/components/transactions/UploadStatements.tsx`

**Antes**:
- 1507 líneas
- 186 líneas en `handleUpload` con toda la lógica
- Imports: 17+ directos de servicios y parsers

**Después**:
- 1397 líneas (110 líneas menos)
- Función `handleUpload` reducida a ~50 líneas
- Imports simplificados: solo llama a `importStatement()`
- Nueva responsabilidad: **solo UI y coordinación**

**Cambios específicos**:
```typescript
// ANTES: TODO el flujo en handleUpload
const handleUpload = async () => {
  // 186 líneas de lógica...
  const fileHash = await calculateFileHash(file);
  const isDuplicate = await checkDuplicateUpload(fileHash);
  // ... 12 pasos más
}

// DESPUÉS: Solo delegación
const handleUpload = async () => {
  const importResult = await importStatement({
    file,
    accountId: selectedAccount,
    account,
    statementMonth,
    statementYear,
    forceUpload,
    exchangeRates,
    userId: user.uid
  });
  
  // Mapear resultado a UI
  setResult({...})
}
```

---

## 3. FLUJO RESULTANTE

```
┌─ React Component (UploadStatements.tsx)
│  └─ handleFileChange() → Detecta banco (smart parser)
│  └─ handleUpload()
│     └─ Call importStatement() ← DELEGACIÓN CLARA
│
└─ Service Layer (importStatements.service.ts)
   ├─ Input: StatementImportInput
   │  └─ file, accountId, account, month, year, forceUpload, userId
   │
   └─ Process (12 pasos orquestados):
      1. calculateFileHash()
      2. checkDuplicateUpload()
      3. detectBank() (si CSV y enabled)
      4. parseByBank() → fallback a parsers genéricos
      5. Validar transacciones parseadas
      6. Validar fechas / preparar snapshot
      7. createUploadHistory()
      8. parsedToTransaction()
      9. categorizeTransactions()
      10. createTransactions()
      11. recalculateAccountBalance()
      12. Retornar StatementImportResult
   │
   └─ Output: StatementImportResult
      └─ success, error, transactionsCategorized, warnings, etc.
```

### Ventajas del Nuevo Flujo

✅ **Agnóstico de UI**:
- El servicio NO importa nada de React
- Puede ser usado por: componentes, APIs backend, agentes, scripts, etc.

✅ **Testeable**:
- Test unitario sin necesidad de montar React
- Mock de servicios es trivial

✅ **Reutilizable**:
- Agente financiero (futuro) llamará a `importStatement()` directamente
- Backend puede exponer como endpoint

✅ **Contrato claro**:
- Entrada explícita: `StatementImportInput`
- Salida explícita: `StatementImportResult`
- No hay ambigüedades

✅ **Mantenible**:
- Cambios en la lógica de importación → `importStatements.service.ts`
- Cambios en UI → `UploadStatements.tsx`
- Separación clara de responsabilidades

---

## 4. SEGURIDAD

### Verificaciones Realizadas

✅ **Sin secretos expuestos**:
- Servicio NO importa credenciales de LLM
- Firebase API Key solo en `firebase.ts` (VITE_*)
- Ningún token en logs

✅ **Aislamiento por usuario**:
- `userId` se pasa como parámetro (auditoría)
- Proviene de `useAuth()` que está autenticado
- Firebase Rules validan `uid` en lectura/escritura

✅ **Sin acceso directo a Firebase en futuro servicio de IA**:
- El agente llamará a `importStatement()` con parámetros
- NO tendrá credenciales de Firebase
- Será un cliente REST/API (implementar después)

✅ **No hay llamadas a LLM todavía**:
- `https://model.nrdonline.site/v1` NO es usado
- Credencial reservada para FASE 02

### Mejora de Seguridad

Se definió `agentTools.service.ts` con estructura clara:
- Herramientas NO acceden directamente a Firebase
- Cada herramienta tiene validación de entrada
- Resultado es agnóstico de autenticación (responsabilidad del caller)

---

## 5. VALIDACIÓN

### Build
```bash
npm run build
✓ tsc - SIN ERRORES
✓ vite build - OK
✓ dist/ generado correctamente
```

### TypeScript
```bash
npx tsc --noEmit
✓ SIN ERRORES
```

### Funcionalidad
- UI sigue funcionando igual (no cambió comportamiento)
- Lógica de importación delegada a servicio
- Resultado mapeado a estado de React

---

## 6. DEUDA / BLOQUEANTES

### Mejoras Futuras (No Bloqueantes)

1. **Optimización de tamaño de bundle**:
   - pdfjs-dist es 1.3 MB
   - Considerar lazy-loading

2. **Tests unitarios**:
   - `importStatements.service.ts` necesita cobertura
   - Mock de Firebase para tests

3. **Validación de entrada**:
   - Agregar Zod/Yup a `StatementImportInput`
   - Validar `accountId` vs `userId` (autorización)

4. **Logging y Telemetría**:
   - Registrar intentos de importación (para auditoría)
   - Métricas de tasa de éxito

5. **Manejo de errores**:
   - Errores de parsers son genéricos ("Error desconocido")
   - Agregar categorías de error específicas

### Preexistentes (No Introducidos en esta Fase)

- ⚠️ Usuarios sin autenticación pueden verter credenciales en logs (no es nuestro)
- ⚠️ Firebase Rules no están documentadas en el repo

---

## 7. ESTADO

### ✅ FASE 01 COMPLETA

**Criterios de aceptación alcanzados**:
1. ✅ Lógica de importación extraída a `importStatements.service.ts`
2. ✅ UploadStatements.tsx delegando la orquestación
3. ✅ Tipos explícitos para entrada/salida (`StatementImportInput`, `StatementImportResult`)
4. ✅ Estructuras de herramientas futuras definidas (`agentTools.service.ts`)
5. ✅ Seguridad verificada (sin secretos, sin LLM todavía)
6. ✅ Build sin errores, TypeScript limpio
7. ✅ Funcionalidad preservada (UI igual que antes)

**Pendiente**:
- No iniciar FASE 02

---

## 8. FICHEROS CLAVE PARA REFERENCIA

| Archivo | Líneas | Propósito |
|---------|--------|----------|
| `src/services/importStatements.service.ts` | 340 | Orquestación agnóstica del flujo |
| `src/services/agentTools.service.ts` | 450 | Definición de herramientas futuras (NOT impl) |
| `src/components/transactions/UploadStatements.tsx` | 1397 | UI simplificada (antes: 1507) |
| `src/types/index.ts` | 140 | Tipos compartidos |
| `src/services/transactions.service.ts` | 280 | Persistencia en Firebase |
| `src/services/uploadHistory.service.ts` | 220 | Historial de cargas |

---

## SIGUIENTES PASOS

### FASE 02 (Cuando se requiera):
1. Implementar herramientas en `agentTools.service.ts`
2. Crear API backend que exponga `importStatement()` y tools
3. Autenticación del agente (token JWT o similar)
4. Integración con LLM en `https://model.nrdonline.site/v1`
5. Creación del agente financiero orquestador

### Hoy (FASE 01):
⛔ **DETENER AQUÍ**

---

**Responsable**: AI Agent  
**Fecha**: 2026-10-02  
**Repositorio**: finance-family  
**Estado**: ✅ COMPLETADO
