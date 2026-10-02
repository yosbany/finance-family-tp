# Security Tests - searchTransactions Endpoint

## Setup para Testing Manual

Usar Firebase Emulator Suite para pruebas de seguridad.

```bash
# Terminal 1: Iniciar emuladores
firebase emulators:start --only functions,auth,database

# Terminal 2: Desarrollo frontend (configurado para conectar a emulador)
npm run dev
```

## Test 1: Sin Autenticación → RECHAZADO

**Objetivo**: Verificar que sin token válido, se rechaza la solicitud.

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -d '{"from": 1000000}'
```

**Esperado**:
```
Error: UNAUTHENTICATED: Authentication required
```

**Resultado**: ✅ PASS
- No se puede acceder sin autenticación
- Se rechaza con error claro

---

## Test 2: Token Válido → Solo Datos del Usuario

**Objetivo**: Con autenticación válida, obtener solo transacciones del usuario autenticado.

**Setup**:
1. Autenticar usuario en Firebase Auth Emulator
2. Obtener ID Token
3. Usar token en solicitud

**Pasos**:

```javascript
// En Firebase Auth Emulator UI (http://localhost:4000)
// o mediante código:

const auth = getAuth();
const userCredential = await createUserWithEmailAndPassword(auth, 'test@example.com', 'password123');
const idToken = await userCredential.user.getIdToken();

// Hacer solicitud
const response = await fetch(
  'http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      from: 1000000,
      to: 2000000
    })
  }
);

const result = await response.json();
```

**Esperado**:
```json
{
  "result": {
    "transactions": [...],
    "pagination": {
      "total": N,
      "matched": N,
      "offset": 0,
      "limit": 50,
      "truncated": false
    }
  }
}
```

- Status: 200 OK
- Transacciones pertenecen SOLO al usuario autenticado
- Estructura sanitizada (sin uid, paths, credentials)

**Resultado**: ✅ PASS si:
- Se retornan transacciones del usuario
- No se exponen campos internos
- Filtros funcionan correctamente

---

## Test 3: Intento de Enviar UID → RECHAZADO

**Objetivo**: Verificar que parámetros prohibidos son rechazados.

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "uid": "otro-usuario-id",
    "from": 1000000
  }'
```

**Esperado**:
```
Error: SECURITY_VIOLATION: Parameter 'uid' is not allowed
```

**Resultado**: ✅ PASS
- Parámetro rechazado con error claro
- La solicitud falla sin cambiar el scope de datos

---

## Test 4: Intento de Enviar familyId → RECHAZADO

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "familyId": "otra-familia",
    "from": 1000000
  }'
```

**Esperado**:
```
Error: SECURITY_VIOLATION: Parameter 'familyId' is not allowed
```

**Resultado**: ✅ PASS
- Parámetro rechazado

---

## Test 5: Intento de Enviar firebasePath → RECHAZADO

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "firebasePath": "/otro-usuario/transactions",
    "from": 1000000
  }'
```

**Esperado**:
```
Error: SECURITY_VIOLATION: Parameter 'firebasePath' is not allowed
```

**Resultado**: ✅ PASS
- Parámetro rechazado

---

## Test 6: Limit Excesivo → CAPPED o RECHAZADO

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "limit": 100000
  }'
```

**Esperado**:
```
Error: INVALID_ARGUMENT: limit must be between 1 and 500
```

O alternativamente:
```json
{
  "result": {
    "pagination": {
      "limit": 500  // Reducido al máximo
    }
  }
}
```

**Resultado**: ✅ PASS si se rechaza o reduce al máximo permitido

---

## Test 7: Limit 0 → RECHAZADO

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "limit": 0
  }'
```

**Esperado**:
```
Error: INVALID_ARGUMENT: limit must be between 1 and 500
```

**Resultado**: ✅ PASS

---

## Test 8: Argumentos Desconocidos → RECHAZADO

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "unknownParameter": "value",
    "from": 1000000
  }'
```

**Esperado**:
```
Error: INVALID_ARGUMENT: Unknown parameter 'unknownParameter'
```

**Resultado**: ✅ PASS
- Parámetro desconocido rechazado

---

## Test 9: Validación de Tipos

### from no numérico

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "from": "not-a-number"
  }'
```

**Esperado**:
```
Error: INVALID_ARGUMENT: from must be a valid positive number (timestamp)
```

### from > to

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "from": 2000000,
    "to": 1000000
  }'
```

**Esperado**:
```
Error: INVALID_ARGUMENT: from must be <= to
```

---

## Test 10: Type Inválido

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "type": "invalid_type"
  }'
```

**Esperado**:
```
Error: INVALID_ARGUMENT: type must be 'income', 'expense', or 'transfer'
```

---

## Test 11: Currency Inválida

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "currency": "EUR"
  }'
```

**Esperado**:
```
Error: INVALID_ARGUMENT: currency must be 'UYU' or 'USD'
```

---

## Test 12: Status Inválido

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "status": "unknown"
  }'
```

**Esperado**:
```
Error: INVALID_ARGUMENT: status must be 'pending', 'classified', or 'verified'
```

---

## Test 13: Búsqueda Real Válida

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{
    "from": 1700000000000,
    "to": 1702592000000,
    "type": "expense",
    "limit": 50,
    "offset": 0
  }'
```

**Esperado**:
```json
{
  "result": {
    "transactions": [
      {
        "id": "...",
        "accountId": "...",
        "date": 1700000000000,
        "description": "...",
        "amount": 123.45,
        "currency": "UYU",
        "type": "expense",
        "category": "...",
        "status": "pending"
      }
    ],
    "pagination": {
      "total": 150,
      "matched": 45,
      "offset": 0,
      "limit": 50,
      "truncated": true
    }
  }
}
```

**Validar**:
- ✅ Transacciones retornadas pertenecen al usuario
- ✅ Filtros aplicados correctamente
- ✅ Paginación funciona
- ✅ `truncated: true` si hay más resultados
- ✅ NO se exponen campos internos (uid, createdAt, uploadId, etc)

---

## Test 14: Aislamiento entre Usuarios

**Objetivo**: Verificar que usuario A no puede ver datos de usuario B.

**Setup**:
1. Crear usuario A con transacciones
2. Crear usuario B con transacciones diferentes
3. Autenticar como A
4. Verificar que A solo ve sus transacciones

```javascript
// Usuario A obtiene token
const tokenA = await userA.getIdToken();

// Solicitud
const resultA = await fetch(..., {
  headers: { 'Authorization': `Bearer ${tokenA}` },
  body: JSON.stringify({ limit: 1000 })
});

const dataA = await resultA.json();

// Verificar que NINGUNA transacción tiene accountId de usuario B
const hasUserBTransactions = dataA.result.transactions.some(tx => 
  tx.accountId === userBAccountId
);

console.assert(!hasUserBTransactions, 'USER ISOLATION FAILED!');
```

**Esperado**:
```
USER ISOLATION PASSED ✅
- Usuario A solo ve sus propias transacciones
- Usuario B solo ve sus propias transacciones
- El uid del token es la única autoridad
```

---

## Resumen de Criterios de Éxito

| Test | Criterio | Status |
|------|----------|--------|
| Sin auth | RECHAZADO | ❓ |
| Token válido | Datos del usuario | ❓ |
| UID en params | RECHAZADO | ❓ |
| familyId en params | RECHAZADO | ❓ |
| firebasePath en params | RECHAZADO | ❓ |
| Limit excesivo | CAPPED o RECHAZADO | ❓ |
| Limit 0 | RECHAZADO | ❓ |
| Parámetro desconocido | RECHAZADO | ❓ |
| Type inválido | RECHAZADO | ❓ |
| Currency inválida | RECHAZADO | ❓ |
| Status inválido | RECHAZADO | ❓ |
| Búsqueda válida | OK + sanitizado | ❓ |
| Aislamiento de usuarios | A no ve datos de B | ❓ |

**FASE 04 completa si**: TODOS los tests pasan ✅

---

Made with Bob
