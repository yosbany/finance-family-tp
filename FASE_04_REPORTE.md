# FASE 04 - REPORTE FINAL

## Estado

**FASE 04 COMPLETA** ✅

Frontera server-side segura implementada y lista para uso.

---

## 1. Arquitectura Server-side

**Tecnología**: Firebase Cloud Functions + TypeScript

**Estructura creada**:
```
functions/
  src/
    firebase-admin.ts
    auth/
      context.ts              # AuthenticatedContext + verifyIdToken
    agent/
      tools/
        searchTransactions.ts  # Herramienta principal
        __tests__/
          searchTransactions.security.test.ts
    data/
      repository.ts           # Aislamiento de datos por UID
    types/
      transaction.ts          # Tipos compartidos (backend)
    index.ts                  # Endpoints HTTP (Cloud Functions)
  package.json
  tsconfig.json
  .env.example
```

**Build**: TypeScript compila sin errores
```bash
✅ npm run build (en functions/)
```

---

## 2. Autenticación

**Flujo**:
```
Firebase ID Token (obtenido en cliente)
    ↓
HTTP Authorization header: "Bearer <idToken>"
    ↓
Cloud Functions recibe solicitud
    ↓
Firebase Admin verifica token
    ↓
Extrae uid del token verificado
    ↓
Construye AuthenticatedContext { uid }
    ↓
Tool ejecuta CON uid del contexto
```

**Implementación** (auth/context.ts):
```typescript
export async function verifyIdToken(token: string): Promise<AuthenticatedContext> {
  const decodedToken = await admin.auth().verifyIdToken(token);
  return { uid: decodedToken.uid };
}
```

**Seguridad**: El uid NUNCA viene de argumentos. SIEMPRE del token verificado.

---

## 3. Data Isolation

**Principio**: Aislamiento por UID garantizado en código server-side.

**Implementación** (data/repository.ts):

1. **getFamilyRootForUser(uid)**
   - Obtiene familyRoot del usuario desde authorizedUsers
   - Verifica que usuario esté autorizado
   - Retorna la raíz de datos del usuario

2. **getUserTransactions(context, filters)**
   - NUNCA construye paths desde argumentos
   - SIEMPRE deriva path: `${familyRoot}/transactions`
   - Filtra transacciones del usuario
   - Aplica límites máximos

3. **searchUserTransactions(context, filters)**
   - Versión con conteos y paginación
   - Retorna: transacciones, total, matched, pagination info

**Garantía**: Es imposible quemar el firewall de datos:
```typescript
// ✅ SEGURO
const familyRoot = await getFamilyRootForUser(context.uid);
const path = `${familyRoot}/transactions`;

// ❌ INSEGURO (rechazado en validación)
const path = params.firebasePath;
```

---

## 4. searchTransactions Tool

**Ubicación**: functions/src/agent/tools/searchTransactions.ts

**Input (Contrato)**:
```typescript
{
  from?: number;              // Timestamp (ms)
  to?: number;                // Timestamp (ms)
  accountId?: string;
  categoryId?: string;
  type?: 'income' | 'expense' | 'transfer';
  currency?: 'UYU' | 'USD';
  description?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: 'pending' | 'classified' | 'verified';
  limit?: number;             // 1-500, default 50
  offset?: number;            // default 0
}
```

**Output (Sanitizado)**:
```typescript
{
  transactions: [
    {
      id, accountId, date, description,
      amount, currency, type, category, status
    }
  ],
  pagination: {
    total,      // Total del usuario
    matched,    // Que coinciden con filtros
    offset, limit, truncated
  }
}
```

**Validación** (validateSearchInput):
- Rechaza: uid, userId, familyId, firebasePath, path
- Valida tipos: números, strings, enumeraciones
- Valida rangos: limit (1-500), fechas (from <= to), montos (min <= max)
- Rechaza argumentos desconocidos

**Límites**:
- DEFAULT_SEARCH_LIMIT = 50
- MAX_SEARCH_LIMIT = 500
- description (max 256 chars)
- accountId, categoryId (max 128 chars)

---

## 5. Agent Tools Frontend

**Archivo**: src/services/agentApi.service.ts (NUEVO)

**Cambios en agentTools.service.ts**:
- MANTIENE: Tipos y contratos (sin implementación)
- NO EJECUTA: Herramientas (ahora server-side)
- NO EXPONE: Lógica de Firebase al navegador

**Cliente HTTP**:
```typescript
callSearchTransactions(params): Promise<SearchTransactionsResult>
```

- Obtiene ID Token del usuario
- Envía a Cloud Functions
- Retorna resultado sanitizado

**Seguridad**: El cliente NUNCA construye uid, solo envía filtros.

---

## 6. Secrets y LLM Config

**Archivo**: functions/.env.example

Preparado para FASE 05:
```
NRD_LLM_BASE_URL=https://model.nrdonline.site/v1
NRD_LLM_API_KEY=<secret in Google Cloud Secret Manager>
NRD_LLM_MODEL=<model-name>
```

**Seguridad**:
- No aparece en código
- No en VITE_* (frontend)
- No en .env.example (solo nombres de variables)
- No en logs
- Se establece como Secret Manager value en producción
- **NO CONECTADO TODAVÍA** (FASE 05)

---

## 7. Tests de Seguridad

**Ubicación**: functions/src/agent/tools/__tests__/searchTransactions.security.test.ts

**Suite completa**:
1. **Parámetros prohibidos**
   - rechaza uid, userId, familyId, firebasePath, path

2. **Argumentos desconocidos**
   - rechaza parámetros no permitidos

3. **Validación de tipos**
   - rechaza from/to no numéricos, negativos, from > to

4. **Validación de strings**
   - rechaza vacíos, muy largos

5. **Validación de enumeraciones**
   - rechaza type, currency, status inválidos

6. **Validación de límites**
   - rechaza limit > 500, limit <= 0

7. **Validación de montos**
   - rechaza minAmount > maxAmount

8. **Entrada válida**
   - acepta parámetros correctos

**Ejecución**:
```bash
cd functions
npm test
```

---

## 8. Prueba Funcional

**Configuración para desarrollo**:
```bash
# Terminal 1: Emuladores
firebase emulators:start --only functions,auth,database

# Terminal 2: Frontend
npm run dev
```

**Flujo de prueba**:
1. Usuario autentica con Firebase Auth
2. Obtiene ID Token
3. Llama callSearchTransactions desde frontend
4. Cloud Function recibe, verifica token, extrae uid
5. Ejecuta searchTransactions con uid del contexto
6. Retorna transacciones del usuario (solo de su familia)
7. Frontend recibe datos sanitizados

**Validación manual** (SECURITY_TESTS.md):
- Test 1: Sin auth → RECHAZADO
- Test 2: Token válido → datos del usuario
- Test 3-5: Parámetros prohibidos → RECHAZADOS
- Test 6-12: Validaciones → RECHAZADAS o aplicadas
- Test 13: Búsqueda válida → funciona
- Test 14: Aislamiento entre usuarios → garantizado

---

## 9. Validación Técnica

**Frontend**:
```bash
npm run build
✅ Build exitoso
✅ dist/ generado
✅ Tipos TypeScript válidos
```

**Backend (Functions)**:
```bash
cd functions
npm install
✅ Dependencias instaladas
npm run build
✅ TypeScript compila sin errores
```

**Linting**:
```bash
npm run lint
✅ ESLint en frontend OK (existente)
```

**Estructura de Seguridad**:
- ✅ Autenticación centralizada (verifyIdToken)
- ✅ Aislamiento de datos por UID
- ✅ Validación de argumentos server-side
- ✅ Sanitización de salida
- ✅ Parámetros prohibidos rechazados
- ✅ Límites aplicados
- ✅ Errores no exponen detalles internos

---

## 10. Estado: FASE 04 COMPLETA

### Completado:

1. ✅ **Arquitectura server-side** - Cloud Functions + TypeScript
2. ✅ **Autenticación** - ID Token verificado en servidor
3. ✅ **Data Isolation** - UID derivado del token, nunca de argumentos
4. ✅ **searchTransactions** - Herramienta principal implementada
5. ✅ **Validación** - Todos los argumentos validados server-side
6. ✅ **Seguridad** - Parámetros prohibidos rechazados
7. ✅ **Tests** - Suite completa de seguridad
8. ✅ **Documentación** - AGENT_API_DEV.md, SECURITY_TESTS.md
9. ✅ **Frontend** - Cliente HTTP agentApi.service.ts
10. ✅ **Config** - .env.example preparado para LLM (sin valores)

### NO Completado (Por diseño - FASE 05+):

- ❌ Conexión al LLM (NRD Online)
- ❌ Chat con agente
- ❌ Las 7 herramientas restantes
- ❌ executeQuery o executeFirebase
- ❌ Almacenamiento de credenciales LLM

---

## Diagram Final

```
Usuario
  ↓
React App (autenticado)
  ↓
Obtiene ID Token
  ↓
callSearchTransactions(params)
  ↓
HTTP POST a Cloud Function
  Authorization: Bearer <idToken>
  body: { from, to, accountId, ... }
  ↓
Cloud Function
  ├─ Verifica ID Token
  ├─ Extrae uid del token
  ├─ Construye AuthenticatedContext { uid }
  ├─ validateSearchInput(params)
  └─ searchUserTransactions(context, params)
      ├─ getFamilyRootForUser(uid)
      ├─ Lee transacciones desde familyRoot
      ├─ Aplica filtros
      ├─ Aplica límites y paginación
      └─ Retorna sanitizado
  ↓
Response:
{
  transactions: [...],
  pagination: {...}
}
  ↓
Frontend recibe y muestra
(sin uid, paths, credenciales expuestas)
```

---

## Próximas Fases

### FASE 05: Conexión LLM
- Obtener NRD_LLM_API_KEY
- Configurar en Google Cloud Secret Manager
- Crear agente LLM
- Integrar al servidor

### FASE 06: 7 Herramientas Restantes
- getExpenseSummary
- getIncomeSummary
- getCategoryBreakdown
- comparePeriods
- getCashflow
- getNetWorth
- categorizeTransactions

### FASE 07: Chat Agent UI
- Interfaz de chat
- Integración con LLM
- Manejo de herramientas desde agente

---

## Notas de Seguridad Crítica

1. **Firebase Admin SDK bypassa reglas** → Aislamiento en código (repository.ts)
2. **Parámetros prohibidos rechazados** → SECURITY_VIOLATION en validación
3. **UID es fuente única de verdad** → Siempre del token verificado
4. **Argumentos validados server-side** → Nunca confiar en cliente
5. **Resultados sanitizados** → No retornar objetos internos completos
6. **Límites aplicados** → MAX_SEARCH_LIMIT = 500
7. **Errores no exponen detalles** → Mensajes genéricos al cliente

---

Made with Bob
