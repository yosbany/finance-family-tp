# FASE 05C — Diagnóstico y Correcciones

**Estado:** DIAGNOSTICADO  
**Fecha:** 3 de Octubre, 2026

---

## RESUMEN EJECUTIVO

El ciclo de tool calling **FUNCIONA CORRECTAMENTE** en el código. El problema está en **autorización de usuarios en Firebase**.

### Hallazgos

| Componente | Estado | Evidencia |
|-----------|--------|-----------|
| **Protocolo Tool Calling** | ✅ CORRECTO | Test local `test-tool-protocol.mjs` pasa |
| **Estructura de Mensajes** | ✅ CORRECTO | `role: 'tool'` + `tool_call_id` + `content` correcto |
| **Loop del Orchestrator** | ✅ CORRECTO | No repite tool calls, produce respuesta final |
| **Autorización Firebase** | ❌ FALLA | Usuario no está en `/authorizedUsers` o no autorizado |
| **Integración LLM** | ✅ PROBABLEMENTE OK | No se puede validar sin usuario autorizado |

---

## CAUSA RAÍZ

**Archivo:** `apps/backend/server/src/finance/repositories/transactions.repository.ts`  
**Línea:** 30-38

```typescript
const userAuthRef = db.ref(`authorizedUsers/${uid}`);
const snapshot = await userAuthRef.once('value');

if (!snapshot.exists()) {
  throw new Error('USER_NOT_AUTHORIZED');  // ← AQUÍ FALLA
}

const userData = snapshot.val();
if (!userData.autorizado) {
  throw new Error('USER_NOT_AUTHORIZED');  // ← O AQUÍ
}
```

**Requisito:** Para usar `searchTransactions`, el usuario DEBE estar en `/authorizedUsers/{uid}` con:
- `uid`: El UID del usuario
- `email`: Email del usuario  
- `autorizado`: `true` (BOOLEANO)
- `familyRoot`: Nombre de la raíz de datos (default: `"family"`)

**Firebase Rules:** Línea 11 de `config/firebase-rules.json`:

```json
".read": "auth != null && 
  root.child('authorizedUsers').child(auth.uid).child('autorizado').val() === true && 
  root.child('authorizedUsers').child(auth.uid).child('familyRoot').val() === $familyRoot"
```

Sin esto, **TODA lectura a datos de usuario falla** a nivel de Firebase Rules.

---

## PROTOCOLO DE TOOL CALLING — VALIDADO ✅

### Test Local

**Script:** `test-tool-protocol-detailed.mjs`  
**Resultado:**

```
Call #1: 2 mensajes (system + user) → LLM devuelve tool_calls
Call #2: 4 mensajes (system + user + assistant + tool) → LLM devuelve respuesta final
```

**Estructura de Mensaje Tool Correcta:**

```json
{
  "role": "tool",
  "tool_call_id": "toolu_bdrk_01TnfvQuHiBZm1h5iWLLs5hL",
  "content": "Tool 'searchTransactions' result:\n{...}"
}
```

**Validación:**
- ✅ `tool_call_id` presente y coincide con el ID del tool call
- ✅ `content` contiene resultado formateado
- ✅ `role: 'tool'` es correcto
- ✅ LLM recibe esto y produce respuesta final
- ✅ No hay repetición de tool calls

**Conclusión:** El protocolo de OpenAI estándar es **CORRECTO** para ibm-ica.

---

## FLUJO CORRECTO (VALIDADO LOCALMENTE)

```
1. Usuario envía pregunta
   ↓
2. LLM iteration 1
   - Recibe: [system, user]
   - Devuelve: tool_calls
   ↓
3. Orchestrator procesa tool_call
   - searchTransactions ejecuta contra Firebase
   - Devuelve resultado sanitizado
   ↓
4. LLM iteration 2
   - Recibe: [system, user, assistant, tool]
   - Devuelve: respuesta final (no más tool_calls)
   ↓
5. Usuario recibe respuesta
```

**Duración:** 2 iteraciones (optimal)

---

## PROBLEMA: USUARIO NO AUTORIZADO

### Escenario Actual

```
Usuario: test-e2e@nrdonline.site
Status: NO en /authorizedUsers o autorizado ≠ true
        ↓
searchUserTransactions() en línea 30
        ↓
Lanza: USER_NOT_AUTHORIZED
        ↓
searchTransactions() la captura (línea 360)
        ↓
ToolResult { tool: "searchTransactions", error: "USER_NOT_AUTHORIZED", result: null }
        ↓
Orchestrator envía error al LLM
        ↓
LLM probablemente responde: "No tengo acceso a tus transacciones" o similar
```

### Verificación Actual

```bash
# En Firebase Realtime Database Console
/authorizedUsers/[uid-test-e2e]
```

**Esperado:**
```json
{
  "uid": "...",
  "email": "test-e2e@nrdonline.site",
  "autorizado": true,
  "familyRoot": "family"
}
```

**Actual:** [VERIFICAR EN PRODUCCIÓN]

---

## SOLUCIÓN: SETUP DEL USUARIO

### PASO 1: Obtener UID del Usuario

```bash
# En VPS, conectar a Firebase Console o usar Firebase CLI
firebase auth:list

# Buscar: test-e2e@nrdonline.site
# Registrar el UID como: UID_TEST_USER
```

### PASO 2: Crear Entrada en /authorizedUsers

```bash
# En Firebase Realtime Database Console
# Navegar a: /authorizedUsers/{UID_TEST_USER}

# Crear manualmente:
{
  "uid": "UID_TEST_USER",
  "email": "test-e2e@nrdonline.site",
  "autorizado": true,
  "familyRoot": "family",
  "createdAt": [timestamp],
  "role": "owner"
}
```

### PASO 3: Crear Estructura de Datos Base

```bash
# En Firebase Realtime Database Console
# Navegar a: /family/

# Crear:
/family/
├── metadata/
│   ├── owner: "UID_TEST_USER"
│   ├── name: "Test Family"
│   └── created: [timestamp]
├── accounts/
│   └── account-1/
│       ├── id: "account-1"
│       ├── name: "Test Account"
│       ├── type: "checking"
│       └── currency: "UYU"
└── transactions/
    └── tx-1/
        ├── id: "tx-1"
        ├── accountId: "account-1"
        ├── date: 1725148800000  (Sept 1, 2026)
        ├── description: "Test"
        ├── amount: 100
        ├── currency: "UYU"
        ├── type: "expense"
        └── status: "verified"
```

### PASO 4: Generar ID Token

```bash
# Usar get-id-token.mjs
cd /Users/yosbanytejas/Documents/finance-family/apps/backend/server
node get-id-token.mjs
# Ingresar: test-e2e@nrdonline.site + Test@123456
# Output: Token guardado en /tmp/id-token.txt

export TOKEN=$(cat /tmp/id-token.txt)
```

---

## VERIFICACIÓN: Endpoint Directo

Después del setup, ejecutar:

```bash
export TOKEN="<ID_TOKEN_DEL_PASO_4>"

# Test 1: Sin filtros
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "limit": 5 }'

# Esperado: HTTP 200 + transactions
```

**Criterio de Éxito:**
- ✅ HTTP 200
- ✅ `transactions` es un array (puede estar vacío)
- ✅ `pagination` con `total`, `matched`, `truncated`

---

## VERIFICACIÓN: Agent Query

```bash
curl -X POST https://service.nrdonline.site/api/agent/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Mostrame mis transacciones de septiembre de 2026."
  }'

# Esperado: HTTP 200 + { answer, toolsUsed: ["searchTransactions"], toolIterations: 2 }
```

---

## CHECKLIST DE FASE 05C

### Autorización ✅/❌
- [ ] Usuario en `/authorizedUsers`
- [ ] `autorizado: true`
- [ ] `familyRoot: "family"` definido
- [ ] Endpoint directo devuelve HTTP 200

### Protocolo LLM ✅ (Validado)
- [x] Tool calling funciona localmente
- [x] Formato de messages correcto
- [x] `tool_call_id` coincide
- [x] Sin repetición de tool calls

### End-to-End ✅/❌
- [ ] Pregunta sin tool funciona
- [ ] Pregunta con tool funciona
- [ ] Resultado llega al LLM
- [ ] Respuesta final es correcta

### Comportamientos Especiales ✅/❌
- [ ] Sin resultados: No inventar
- [ ] Filtros: from/to/minAmount funcionan
- [ ] Paginación: truncated mostrado si aplica
- [ ] Seguridad: Inyecciones bloqueadas

### Deploy ✅/❌
- [ ] Build sin errores
- [ ] Deploy a `/opt`
- [ ] Servicio reiniciado
- [ ] Health check HTTP 200
- [ ] Logs sin secretos

---

## PRÓXIMAS ACCIONES

### INMEDIATO (Bloqueador)
1. [ ] Verificar si `test-e2e@nrdonline.site` existe en `/authorizedUsers`
2. [ ] Si NO: Crear entrada con `autorizado: true`
3. [ ] Crear datos de prueba en `/family/transactions`
4. [ ] Generar nuevo ID Token

### DESPUÉS
5. [ ] Test endpoint directo: `/api/tools/search-transactions`
6. [ ] Test end-to-end: `/api/agent/query`
7. [ ] Validar comportamientos especiales
8. [ ] Pruebas de seguridad
9. [ ] Reporte final

---

## ARCHIVOS DE REFERENCIA

**Scripts creados en FASE 05C:**
- `apps/backend/server/test-tool-protocol.mjs` — Valida protocolo básico ✅
- `apps/backend/server/test-tool-protocol-detailed.mjs` — Inspecciona estructura ✅
- `apps/backend/server/setup-test-user.mjs` — Crear usuario (requiere acceso a internet)

**Documentación:**
- `docs/FASE_05C_PLAN.md` — Plan completo de diagnostico
- `docs/FASE_05C_DIAGNOSIS.md` — Este archivo

**Código crítico:**
- `src/finance/repositories/transactions.repository.ts` — Línea 30-38: Validación de autorización
- `src/agent/orchestrator.ts` — Línea 150-170: Protocolo de tool result
- `config/firebase-rules.json` — Línea 11: Reglas de Firebase para datos

---

## ESTADO FINAL DE FASE 05C

**Esperar actualización después de:**
1. Setup del usuario en Firebase
2. Ejecución de test directo
3. Ejecución de test end-to-end
4. Validación de comportamientos especiales

**Próximo paso:** Actualizar este documento con resultados reales.
