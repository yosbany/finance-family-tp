# Agent API - Development Guide

## Overview

FASE 04: Frontera server-side segura con `searchTransactions`.

Arquitectura:
```
React (Frontend)
    ↓ Firebase ID Token
Server-side Agent API (Cloud Functions)
    ↓ Verifica token
AuthenticatedContext
    ↓
searchTransactions()
    ↓ uid del contexto
Firebase Admin SDK
    ↓
Transacciones del usuario (aisladas por UID)
```

## Estructura

```
functions/
  src/
    firebase-admin.ts          # Inicialización Firebase Admin
    auth/
      context.ts               # AuthenticatedContext + verificación token
    agent/
      tools/
        searchTransactions.ts   # Primera herramienta implementada
        __tests__/
          searchTransactions.security.test.ts  # Tests de seguridad
    data/
      repository.ts            # Capa de acceso a datos (aislamiento UID)
    types/
      transaction.ts           # Tipos compartidos (backend)
    index.ts                    # Endpoints HTTP (Cloud Functions)
  package.json
  tsconfig.json
  .env.example
```

## Desarrollo Local

### 1. Instalar dependencias

```bash
cd functions
npm install
```

### 2. Firebase Emulator

```bash
# En la raíz del proyecto
firebase emulators:start --only functions,auth,database
```

Esto inicia:
- Functions emulator: `http://localhost:5001`
- Auth emulator: `http://localhost:9099`
- Database emulator: `http://localhost:9000`
- Emulator UI: `http://localhost:4000`

### 3. Configurar frontend para conectar a emulator

En `.env.local`:
```
VITE_AGENT_API_URL=http://localhost:5001/finance-family-tp/us-east1
VITE_FIREBASE_EMULATOR_AUTH_URL=http://localhost:9099
VITE_FIREBASE_EMULATOR_DB_URL=http://localhost:9000
```

### 4. Desarrollo del frontend

```bash
npm run dev
```

## Seguridad - Puntos críticos

### 1. Autenticación

El contexto autenticado se construye SOLO del token verificado:

```typescript
// ✅ CORRECTO
const context = verifyIdToken(token);  // uid del token
searchTransactions(context, params);

// ❌ INCORRECTO
const context = { uid: params.uid };   // uid del cliente
```

### 2. Aislamiento de datos

El repositorio NUNCA construye paths desde argumentos:

```typescript
// ✅ CORRECTO - path derivado del UID del contexto
const familyRoot = await getFamilyRootForUser(context.uid);
const txRef = database.ref(`${familyRoot}/transactions`);

// ❌ INCORRECTO - path desde argumentos
const txRef = database.ref(params.firebasePath);
```

### 3. Validación de argumentos

Toda entrada se valida server-side:

```typescript
// ✅ CORRECTO - valida antes de usar
const validated = validateSearchInput(params);

// ❌ INCORRECTO - acepta cualquier cosa
const tx = repository.search(params);
```

### 4. Parámetros prohibidos

Estos parámetros NUNCA deben aceptarse:

```
uid, userId, familyId, firebasePath, path
```

Se rechazan con `SECURITY_VIOLATION`.

## Testing de seguridad

### Unit tests

```bash
cd functions
npm test
```

Prueba:

1. **Sin autenticación** → rechazado
2. **UID en parámetros** → rechazado con SECURITY_VIOLATION
3. **firebasePath en parámetros** → rechazado con SECURITY_VIOLATION
4. **Argumentos desconocidos** → rechazado con INVALID_ARGUMENT
5. **Limit excesivo** → capped a MAX_SEARCH_LIMIT
6. **Valores inválidos** → rechazado con INVALID_ARGUMENT

### Integración manual

#### Test 1: Autenticación requerida

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -d '{"from": 1000000}'
```

Esperado: `401 UNAUTHENTICATED`

#### Test 2: Token válido

```bash
# Obtener token del usuario en auth emulator
# Luego:

curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{"from": 1000000}'
```

Esperado: `200 OK` con transacciones del usuario

#### Test 3: UID en parámetros → rechazado

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{"uid": "otro-usuario"}'
```

Esperado: `400 INVALID_ARGUMENT: Parameter 'uid' is not allowed`

#### Test 4: Limit excesivo

```bash
curl -X POST http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <idToken>" \
  -d '{"limit": 100000}'
```

Esperado: `400 INVALID_ARGUMENT: limit must be between 1 and 500`

## searchTransactions - Contrato

### Input

```typescript
{
  from?: number;              // Timestamp (ms) inicio
  to?: number;                // Timestamp (ms) fin
  accountId?: string;         // ID de cuenta
  categoryId?: string;        // ID de categoría
  type?: 'income' | 'expense' | 'transfer';
  currency?: 'UYU' | 'USD';
  description?: string;       // Búsqueda en descripción (case-insensitive)
  minAmount?: number;         // Valor absoluto mínimo
  maxAmount?: number;         // Valor absoluto máximo
  status?: 'pending' | 'classified' | 'verified';
  limit?: number;             // (1 - 500, default 50)
  offset?: number;            // Para paginación (default 0)
}
```

### Output

```typescript
{
  transactions: [
    {
      id: string;
      accountId: string;
      date: number;
      description: string;
      amount: number;
      currency: string;
      type: string;
      category?: string;
      status: string;
    }
  ],
  pagination: {
    total: number;        // Total de transacciones del usuario
    matched: number;      // Transacciones que coinciden con filtros
    offset: number;
    limit: number;
    truncated: boolean;   // Si hay más resultados
  }
}
```

### Errores

```
UNAUTHENTICATED: Invalid or expired token
INVALID_ARGUMENT: Parámetro inválido
SECURITY_VIOLATION: Intento de parámetro prohibido
PERMISSION_DENIED: Usuario no autorizado
INTERNAL: Error del servidor
```

## Flujo desde Frontend

```typescript
// 1. Usuario autenticado
const user = auth.currentUser;

// 2. Llamar searchTransactions desde frontend
const result = await callSearchTransactions({
  from: 1000000,
  to: 2000000,
  limit: 50
});

// 3. Frontend
//    - Obtiene ID Token (verificado por Firebase)
//    - Envía parámetros
//    - El servidor extrae UID del token
//    - Ejecuta searchTransactions
//    - Retorna resultado sanitizado

// 4. Resultado
console.log(result.transactions);      // Transacciones del usuario
console.log(result.pagination);        // Info paginación
```

## Deployment

### Cloud Functions (Producción)

```bash
cd functions
npm run build
firebase deploy --only functions
```

Variables de entorno (Google Cloud Secret Manager):
- `NRD_LLM_API_KEY` - Clave LLM (FASE 05)

### Endpoints en producción

```
https://us-east1-finance-family-tp.cloudfunctions.net/searchTransactionsEndpoint
https://us-east1-finance-family-tp.cloudfunctions.net/health
```

## Próximas fases

- **FASE 05**: Conectar al LLM (NRD Online)
- **FASE 06**: Implementar las 7 herramientas restantes
- **FASE 07**: Integración de agente en frontend

## Notas

- Firebase Admin SDK bypassa las reglas de seguridad
- El aislamiento por UID se garantiza en el código (repository.ts)
- Todos los parámetros se validan server-side
- El token ID es la única fuente de verdad para la identidad
- Los resultados se sanitizan antes de retornar

---

Made with Bob
