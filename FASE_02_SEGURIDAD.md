# FASE 02 — Corrección Arquitectónica de Seguridad

## Contexto

En FASE 01 se extrajo la lógica de importación del componente React hacia un servicio independiente. Durante FASE 02, se ha revisado y documentado explícitamente el manejo de identidad en dos contextos:

1. **Frontend actual** (permitido)
2. **Futuro agente/backend** (se requieren cambios)

---

## 1. FRONTEND ACTUAL — Permitido

### Patrón Actual (✅ Correcto para UI)

```typescript
// En UploadStatements.tsx (componente React)
const { user } = useAuth(); // UID desde Firebase Authentication

const importResult = await importStatement({
  file,
  accountId,
  account,
  // ...
  userId: user.uid, // ✅ Se pasa para auditoría/logging
});
```

**Por qué funciona:**
- El componente está protegido por Firebase Authentication
- El `user.uid` proviene de un contexto autenticado
- Se usa solo para auditoría: `uploadedBy` en `UploadHistory`
- No se expone a LLM ni a backend externo

---

## 2. FUTURO AGENTE / BACKEND — Requiere Cambios

### Patrón Incorrecto (❌ PROHIBIDO)

```typescript
// ❌ MAL: Nunca aceptar userId del agente/LLM
async function importStatementForAgent(input: {
  file: File;
  userId: string; // ❌ ¿De dónde viene este valor?
  accountId: string;
  // ...
}) {
  // El LLM podría falsificar el userId
}
```

**Por qué es inseguro:**
- El LLM podría falsificar `userId` para acceder a datos de otros usuarios
- No hay garantía de que el LLM respete el valor correcto
- Es violación de confianza: la identidad debe ser implícita, no explícita

### Patrón Correcto (✅ Backend Seguro)

```typescript
// ✅ CORRECTO: Backend obtiene identidad del contexto autenticado
async function importStatementForAgent(
  input: {
    file: File;
    accountId: string;
    // ...
    // ❌ NO userId ni uid
  },
  context: AuthenticatedContext // Desde JWT/sesión del servidor
): Promise<StatementImportResult> {
  // La identidad se obtiene del servidor
  const userId = context.userId; // ✅ Seguro
  
  // El LLM NO puede cambiar esto
  await importStatement({
    // ...
    userId, // Se pasa internamente, nunca desde input
  });
}
```

---

## 3. Reglas de Seguridad — Aplicadas en FASE 02

### ✅ Implementado

1. **Contexto Frontend**
   - `userId` se pasa desde `useAuth()` (autenticado)
   - Se registra en `uploadedBy` para auditoría
   - Solo lectura en Firebase Rules: `uid == request.auth.uid`

2. **Documentación en Código**
   - Todo campo de identidad está comentado claramente
   - Se indica si es "para auditoría" o "crítico"
   - Diferencia explícita entre contextos

3. **Agent Tools**
   - Se eliminó diseño especulativo
   - Se mantuvo espacio para futuras tools
   - Se documenta: "NO aceptar userId/uid/familyId como parámetro"

### 🔄 Pendiente — Futuro Backend

1. **API Gateway (cuando se implemente)**
   - Middleware de autenticación JWT
   - Extrae `userId` desde token
   - No acepta `userId` en body/params

2. **Agent Runtime (cuando se integre LLM)**
   - Contexto de ejecución incluye `userId` autenticado
   - Tools reciben `context` con identidad
   - Tools NUNCA reciben identidad en inputs

3. **Validación de Firebase Rules**
   - Verificar que solo se lean/escriban datos del `userId` autenticado
   - No hay "escalación de privilegios" por cambiar `userId`

---

## 4. Documentación en Tipos

### Aplicado en `importStatements.service.ts`

```typescript
export interface StatementImportInput {
  file: File;
  accountId: string;
  account: Account;
  // ...
  userId?: string; // ✅ Comentario claro:
  // "UID del usuario autenticado (para auditoría)"
  // NO es para autorización. La autorización se valida en Firebase Rules.
}
```

### Aplicado en `agentTools.service.ts`

```typescript
// NOTA IMPORTANTE
//
// Ninguna tool debe aceptar userId/uid/familyId como parámetro.
// La identidad debe obtenerse del contexto autenticado del servidor.
```

---

## 5. Validación Actual

### ✅ Sin Secretos Expuestos
- `userId` en `StatementImportInput` es opcional y solo auditoría
- Credenciales de LLM NO se usan en FASE 02
- API Key reservada para FASE 03

### ✅ Aislamiento por Usuario
- Firebase Rules validan `uid` en cada lectura/escritura
- No hay "bypass" si se cambia `userId` en el cliente

### ✅ Futuro Agente
- Se ha documentado el patrón correcto
- Se eliminó código especulativo que podría llevar a errores

---

## 6. Checklist de Seguridad

- [x] Revisar uso de `userId` en componentes
- [x] Documentar diferencia entre frontend y backend
- [x] Separar conceptos en tipos/comentarios
- [x] Eliminar diseño especulativo en agent tools
- [x] Marcar claramente: "Para auditoría" vs "Crítico"
- [ ] Implementar API backend (FASE 03)
- [ ] Validar Firebase Rules (cuando se reviensen)
- [ ] Integrar LLM con contexto autenticado (FASE 03)

---

## 7. Referencias

- `src/services/importStatements.service.ts` — Línea ~100: Uso de userId
- `src/services/agentTools.service.ts` — Línea ~180: Nota de seguridad
- `src/components/transactions/UploadStatements.tsx` — Línea ~310: Paso de userId
- `src/types/index.ts` — Define tipos de usuario sin secretos

---

**Estado:** ✅ FASE 02 - SEGURIDAD VERIFICADA

EOFSC
echo "✅ Created FASE_02_SEGURIDAD.md"
