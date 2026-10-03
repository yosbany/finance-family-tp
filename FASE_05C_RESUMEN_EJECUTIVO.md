# FASE 05C — RESUMEN EJECUTIVO

**Fecha:** 3 de Octubre, 2026  
**Status:** DIAGNÓSTICO COMPLETADO, READY PARA ACCIÓN

---

## TL;DR

✅ **El código está correcto**  
❌ **El usuario de prueba no está autorizado en Firebase**

### Acción Requerida

1. Verificar `/authorizedUsers/test-e2e@nrdonline.site` en Firebase
2. Si no existe o `autorizado ≠ true`: crear con `autorizado: true`
3. Crear datos de prueba en `/family/transactions`
4. Generar nuevo ID token
5. Ejecutar 2 tests para validar
6. Listo → FASE 05 COMPLETA

**Tiempo estimado:** 30 minutos

---

## HALLAZGOS

### ✅ Validado: Protocolo de Tool Calling

**Test ejecutado:** `test-tool-protocol-detailed.mjs`

El orchestrator maneja correctamente el ciclo completo:

```
Iteración 1:
  Messages enviados: [system, user]
  LLM devuelve: tool_calls
  
Iteración 2:
  Messages enviados: [system, user, assistant, tool]
  LLM devuelve: respuesta final (stop)
```

**Estructura de tool message:**
```json
{
  "role": "tool",
  "tool_call_id": "toolu_bdrk_01TnfvQuHiBZm1h5iWLLs5hL",
  "content": "Tool 'searchTransactions' result:\n{...}"
}
```

✅ Correcto para ibm-ica.

---

### ❌ Causa del Fallo: Autorización Firebase

**Código:** `src/finance/repositories/transactions.repository.ts` línea 30-38

```typescript
const userAuthRef = db.ref(`authorizedUsers/${uid}`);
const snapshot = await userAuthRef.once('value');

if (!snapshot.exists()) {
  throw new Error('USER_NOT_AUTHORIZED');  // ← FALLA AQUÍ
}

const userData = snapshot.val();
if (!userData.autorizado) {
  throw new Error('USER_NOT_AUTHORIZED');  // ← O AQUÍ
}
```

**Requisito:** El usuario DEBE estar en `/authorizedUsers/{uid}` con:
```json
{
  "uid": "...",
  "email": "test-e2e@nrdonline.site",
  "autorizado": true,
  "familyRoot": "family"
}
```

Sin esto: **TODOS los queries a Firebase fallan** (Firebase Rules enforces).

---

## PLAN DE ACCIÓN

### PASO 1: Verificar Usuario en Firebase (2 min)

```bash
# Option A: Firebase Console
# 1. Abre https://console.firebase.google.com
# 2. Selecciona proyecto "nrd-db"
# 3. Ve a Realtime Database
# 4. Busca /authorizedUsers/
# 5. Verifica si existe "test-e2e@nrdonline.site"

# Option B: Firebase CLI (si está instalado)
firebase database:get authorizedUsers/[UID_TEST_USER] --project nrd-db
```

**Si NO existe:**
```bash
# Ir a PASO 2 (crear)

# Si EXISTE pero autorizado ≠ true:
# Ir a PASO 2 (actualizar)

# Si EXISTE y autorizado = true:
# Ir a PASO 3 (crear datos)
```

---

### PASO 2: Crear/Actualizar Entrada en /authorizedUsers (5 min)

**En Firebase Console → Realtime Database:**

1. Navega a `/authorizedUsers/`
2. Click en "+ Add child" o edita el existente
3. Nombre: `[UID_TEST_USER]` (obtener de Firebase Auth Console)
4. Contenido:

```json
{
  "uid": "[UID_TEST_USER]",
  "email": "test-e2e@nrdonline.site",
  "autorizado": true,
  "familyRoot": "family",
  "createdAt": 1727971800000,
  "role": "owner"
}
```

5. Click Save

**Validación:** ✅ Entrada visible en `/authorizedUsers/`

---

### PASO 3: Crear Datos de Prueba (5 min)

**En Firebase Console → Realtime Database:**

1. Navega a raíz `/`
2. Asegúrate de que existe la estructura:

```json
{
  "family": {
    "metadata": {
      "owner": "[UID_TEST_USER]",
      "name": "Test Family",
      "created": 1727971800000
    },
    "accounts": {
      "acc-001": {
        "id": "acc-001",
        "name": "Main Checking",
        "type": "checking",
        "currency": "UYU"
      }
    },
    "transactions": {
      "tx-001": {
        "id": "tx-001",
        "accountId": "acc-001",
        "date": 1725148800000,
        "description": "Test Transaction 1",
        "amount": 250,
        "currency": "UYU",
        "type": "expense",
        "category": "test",
        "status": "verified"
      },
      "tx-002": {
        "id": "tx-002",
        "accountId": "acc-001",
        "date": 1725234000000,
        "description": "Test Transaction 2",
        "amount": 500,
        "currency": "UYU",
        "type": "expense",
        "category": "test",
        "status": "verified"
      }
    }
  }
}
```

**Validación:** ✅ Estructura visible en Realtime Database

---

### PASO 4: Generar ID Token (10 min)

```bash
# En tu máquina local (requiere acceso a internet)
cd /Users/yosbanytejas/Documents/finance-family/apps/backend/server

# Ejecutar script de setup
node setup-test-user.mjs
# Ingresar credenciales del usuario
# Token se genera y se guarda en /tmp/test-user-token.txt

export TOKEN="$(cat /tmp/test-user-token.txt)"
```

**Alternativa:** Usar Firebase Console directamente:
1. Ve a Firebase Console
2. Selecciona proyecto "nrd-db"
3. Authentication → Users
4. Busca test-e2e@nrdonline.site
5. Generate custom token manualmente

**Guardar el token en:** `/tmp/test-user-token.txt`

---

### PASO 5: Test Endpoint Directo (2 min)

```bash
export TOKEN="<TOKEN_DEL_PASO_4>"

curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "limit": 5 }'
```

**Esperado:**
```json
{
  "transactions": [
    {
      "id": "tx-001",
      "accountId": "acc-001",
      "date": 1725148800000,
      "description": "Test Transaction 1",
      "amount": 250,
      "currency": "UYU",
      "type": "expense",
      "status": "verified"
    }
  ],
  "pagination": {
    "total": 2,
    "matched": 2,
    "offset": 0,
    "limit": 5,
    "truncated": false
  }
}
```

**Validación:**
- ✅ HTTP 200
- ✅ `transactions` es array
- ✅ `pagination.matched` > 0

---

### PASO 6: Test End-to-End (2 min)

```bash
export TOKEN="<TOKEN_DEL_PASO_4>"

curl -X POST https://service.nrdonline.site/api/agent/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Mostrame mis transacciones de septiembre de 2026."
  }' | jq .
```

**Esperado:**
```json
{
  "answer": "Encontré 2 transacciones en septiembre de 2026 con un total de $750...",
  "toolsUsed": ["searchTransactions"],
  "toolIterations": 2,
  "requestId": "uuid-here"
}
```

**Validación:**
- ✅ HTTP 200
- ✅ `toolsUsed` contiene "searchTransactions"
- ✅ `toolIterations` = 2
- ✅ `answer` contiene datos o explicación

---

## RESULTADO ESPERADO

Después de completar todos los pasos:

```
Usuario en Firebase: ✅ AUTORIZADO
Endpoint directo: ✅ HTTP 200
Agent query: ✅ Tool calling funciona
Respuesta final: ✅ Contiene datos correctos

FASE 05 STATUS: ✅ COMPLETA
```

---

## CHECKLIST RÁPIDO

```
FASE 05C — CHECKLIST FINAL

Protocolo Tool Calling:
  [x] Validado localmente (test-tool-protocol.mjs)
  [x] Estructura de messages correcta
  [x] Sin repetición de tool calls
  [x] Respuesta final generada

Autorización:
  [ ] Usuario en /authorizedUsers
  [ ] autorizado = true
  [ ] Datos de prueba en /family/transactions
  [ ] Token válido generado

Tests:
  [ ] Endpoint directo → HTTP 200
  [ ] Agent query → toolsUsed = ["searchTransactions"]
  [ ] Agent query → toolIterations = 2
  [ ] Answer contiene datos

Resultado:
  [ ] FASE 05 COMPLETA
```

---

## DOCUMENTACIÓN DE REFERENCIA

- **Diagnóstico técnico:** `docs/FASE_05C_DIAGNOSIS.md`
- **Plan detallado:** `docs/FASE_05C_PLAN.md`
- **Test validaciones:** `apps/backend/server/test-tool-protocol*.mjs`
- **Código crítico:** 
  - `src/finance/repositories/transactions.repository.ts` (línea 30-38)
  - `src/agent/orchestrator.ts` (línea 150-170)
  - `config/firebase-rules.json` (línea 11)

---

## PRÓXIMA FASE

Después de validar FASE 05 COMPLETA:

```
NO iniciar:
  ❌ Nuevas herramientas
  ❌ Streaming
  ❌ Memory
  ❌ History
  ❌ Anything not in scope

Mantener:
  ✅ searchTransactions (única tool)
  ✅ Protocolo actual
  ✅ Seguridad UID-level
  ✅ Firebase Rules
```

---

**Status:** Ready for execution  
**Blocker:** Acceso manual a Firebase Console (sandbox limita network)  
**Después:** Validación automática en tests
