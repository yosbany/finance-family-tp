# QUICKSTART - FASE 04

## En 60 segundos

### ¿Qué se hizo?

Capa server-side **segura** para el agente financiero con la primera herramienta: `searchTransactions`.

### ¿Por qué?

Para que el agente pueda:
1. **Verificar identidad** del usuario (Firebase ID Token)
2. **Acceder datos** de forma segura (aislamiento por UID)
3. **Ejecutar herramientas** con garantías de seguridad (validación server-side)

### ¿Cómo funciona?

```
Usuario autenticado
        ↓
ID Token (de Firebase Auth)
        ↓
HTTP POST a Cloud Function
        ↓
Servidor verifica token → extrae uid
        ↓
searchTransactions(uid, filtros)
        ↓
Retorna transacciones del usuario (sanitizado)
```

### ¿Está seguro?

✅ SÍ

- Identidad verificada mediante token (no confía en cliente)
- Datos aislados por UID del token
- Todos los argumentos validados server-side
- Parámetros prohibidos (uid, userId, firebasePath) rechazados
- Resultados sanitizados (sin credenciales, paths, etc)

---

## Para Desarrolladores

### Desarrollo Local

```bash
# Terminal 1: Emuladores
firebase emulators:start --only functions,auth,database

# Terminal 2: Frontend
npm run dev
```

Acceder a:
- Frontend: http://localhost:5173
- Functions: http://localhost:5001
- Emulator UI: http://localhost:4000

### Build

```bash
# Frontend
npm run build

# Backend
cd functions && npm run build
```

Ambos compilan sin errores ✅

### Testing

```bash
cd functions
npm test
```

Ejecuta 40+ assertions de seguridad.

---

## Arquitectura

```
functions/
  src/
    firebase-admin.ts              Firebase Admin setup
    auth/context.ts                Verificación de token
    agent/tools/
      searchTransactions.ts         Herramienta principal
    data/repository.ts             Aislamiento de datos
    types/transaction.ts           Tipos compartidos
    index.ts                       Endpoints HTTP
  lib/                             Build compilado

src/services/agentApi.service.ts   Cliente HTTP (frontend)
```

---

## searchTransactions

### Input

```typescript
{
  from?: number;              // Timestamp (ms)
  to?: number;                // Timestamp (ms)
  accountId?: string;         // Filtro
  type?: 'income' | 'expense' | 'transfer';
  currency?: 'UYU' | 'USD';
  description?: string;       // Búsqueda substring
  minAmount?: number;
  maxAmount?: number;
  limit?: number;             // 1-500, default 50
  offset?: number;
}
```

**NUNCA aceptar**: `uid`, `userId`, `familyId`, `firebasePath`

### Output

```typescript
{
  transactions: [{
    id, accountId, date, description,
    amount, currency, type, category, status
  }],
  pagination: {
    total,      // Total del usuario
    matched,    // Con filtros
    offset, limit, truncated
  }
}
```

---

## Security Checks

### Test 1: Sin Auth

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -d '{"from": 1000000}'
```

Esperado: `401 UNAUTHENTICATED` ✅

### Test 2: Con Token

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Authorization: Bearer <idToken>" \
  -d '{"from": 1000000}'
```

Esperado: `200 OK` + transacciones del usuario ✅

### Test 3: UID en Parámetros

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Authorization: Bearer <idToken>" \
  -d '{"uid": "otro-usuario"}'
```

Esperado: `400 SECURITY_VIOLATION` ✅

### Test 4: Limit Excesivo

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Authorization: Bearer <idToken>" \
  -d '{"limit": 100000}'
```

Esperado: `400 INVALID_ARGUMENT` ✅

Ver [SECURITY_TESTS.md](SECURITY_TESTS.md) para suite completa.

---

## Documentación

| Archivo | Contenido |
|---------|----------|
| `AGENT_API_DEV.md` | Guía de desarrollo completa |
| `SECURITY_TESTS.md` | 14 test cases de seguridad |
| `TECHNICAL_VALIDATION.md` | Build status y validaciones |
| `FASE_04_REPORTE.md` | Reporte final detallado |
| Este archivo | Quickstart |

---

## Status

✅ **FASE 04 COMPLETA**

### Incluido

- ✅ Arquitectura server-side (Cloud Functions + TypeScript)
- ✅ Autenticación (Firebase ID Token verificado)
- ✅ Data isolation (por UID del token)
- ✅ searchTransactions (herramienta implementada)
- ✅ Validación (argumentos server-side)
- ✅ Seguridad (parámetros prohibidos rechazados)
- ✅ Tests (suite de 40+ assertions)
- ✅ Documentación (4 archivos)

### NO Incluido (Por Diseño)

- ❌ Conexión LLM (FASE 05)
- ❌ Chat (FASE 07)
- ❌ Otras 7 herramientas (FASE 06)

---

## Próximos Pasos

### FASE 05: LLM Integration
Conectar al modelo NRD Online:
- Obtener API key
- Configurar en Secret Manager
- Crear agente LLM
- Integrar al servidor

### FASE 06: Tools Restantes
Implementar las 7 herramientas:
- getExpenseSummary
- getIncomeSummary
- getCategoryBreakdown
- comparePeriods
- getCashflow
- getNetWorth
- categorizeTransactions

### FASE 07: Chat UI
- Interfaz de chat
- Integración con agente
- Manejo de tools en tiempo real

---

## Troubleshooting

### Error: Port already in use

```bash
# Matar proceso usando el puerto
lsof -i :5001
kill -9 <PID>
```

### Error: Firebase Config not found

Asegurarse de que `.env` tiene:
```
VITE_FIREBASE_PROJECT_ID=finance-family-tp
VITE_FIREBASE_DATABASE_URL=https://finance-family-tp-default-rtdb.firebaseio.com
```

### Error: Functions not deploying

```bash
cd functions
npm run build  # Compilar primero
firebase deploy --only functions
```

---

## Performance

- **Frontend build**: 4.5s
- **Backend build**: 1.9s
- **Function cold start**: 2-5s (normal para CF)
- **Function warm start**: <500ms
- **Query max limit**: 500 resultados

---

## Security Summary

| Aspecto | Status |
|--------|--------|
| Autenticación | ✅ Firebase ID Token |
| Data Isolation | ✅ Por UID del token |
| Input Validation | ✅ Server-side |
| Parameter Blocking | ✅ uid, userId, familyId, firebasePath |
| Output Sanitization | ✅ Campos mínimos |
| Error Messages | ✅ Sin detalles sensibles |
| Limits | ✅ MAX=500 |
| Rate Limiting | ⏸️ Adicional (FASE 05+) |
| Encryption | ✅ HTTPS en producción |
| Logging | ⏸️ Cloud Logging (Firebase) |

---

## Made with Bob

Más info: ver [FASE_04_REPORTE.md](FASE_04_REPORTE.md)
