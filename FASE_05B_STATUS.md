# FASE 05B — ESTADO ACTUAL Y PRÓXIMOS PASOS

**Fecha:** Oct 3, 2026, 8:45 AM  
**Estado:** ⏳ BLOQUEADO EN REQUERIMIENTO CRÍTICO  
**Progreso:** 85% completado (falta API key)

---

## ✅ COMPLETADO

### Infraestructura VPS
- ✅ Conectividad SSH verificada (openclaw-vps-root funciona)
- ✅ Sistema: Ubuntu 22.04.5 LTS (satisface requirements)
- ✅ Node.js v22.23.2 (satisface requirements)
- ✅ npm v10.9.8
- ✅ Nginx activo
- ✅ DNS resolviendo correctamente: service.nrdonline.site → 179.43.124.107

### Backend FASE 05
- ✅ LLMClient implementado (`src/llm/client.ts`)
  - Detección dinámica de modelos vía `/models`
  - Manejo de errores (timeout, auth, rate limit)
  - API key NUNCA se expone en logs
  
- ✅ AgentOrchestrator implementado (`src/agent/orchestrator.ts`)
  - Loop de tool calling (max 3 iteraciones)
  - System prompt en español
  - Sanitización de respuestas
  
- ✅ ToolRegistry implementado (`src/agent/toolRegistry.ts`)
  - searchTransactions único tool disponible
  - Solo herramientas explícitamente registradas pueden ejecutarse
  - Rechazo de herramientas desconocidas
  
- ✅ SearchTransactions validación de seguridad
  - Rechaza uid, userId, familyId, firebasePath
  - Valida todos los parámetros
  - UID aislado del AuthenticatedContext (Firebase token)
  
- ✅ Agent Routes (`POST /api/agent/query`)
  - Require Firebase ID Token
  - Input: { message: string }
  - Output: { answer, toolsUsed, toolIterations, requestId }
  
- ✅ Frontend dev component (`/dev/agent`)
  - UI mínima de desarrollo
  - Listo para testing

### Build Local
- ✅ TypeScript compilado sin errores
- ✅ dist/ generado y actualizado
- ✅ package.json y package-lock.json listos
- ✅ node_modules completo

### Automatización
- ✅ FASE_05B_DEPLOY.sh creado
  - Automatiza TODO el proceso de deploy
  - Verifica modelo real
  - Build, copia a VPS, configuración
  - Restart y healthchecks
  - Listo para ejecutar

### Documentación
- ✅ FASE_05B_EXECUTION_PLAN.md
- ✅ FASE_05B_STATUS.md (este archivo)
- ✅ Guías paso a paso

---

## ⏳ BLOQUEADO POR

### 1. NRD_LLM_API_KEY (CRÍTICO)
**Por qué:** Sin esta clave no puedo:
- Acceder a `https://model.nrdonline.site/v1/models`
- Verificar qué modelos están disponibles
- Hacer llamadas de test al LLM
- Completar el deploy en producción

**Necesario:**
```bash
export NRD_LLM_API_KEY="<your-api-key-here>"
```

**Ubicación final en VPS:**
```
/etc/finance-family-api/finance-family-api.env
NRD_LLM_API_KEY=<secret>
```

**Validación:**
```bash
curl -H "Authorization: Bearer $NRD_LLM_API_KEY" \
  https://model.nrdonline.site/v1/models | jq '.'
```

---

## 🚀 CÓMO PROCEDER

### FASE 1: Obtener API Key
**Acción requerida:** Proporcionar `NRD_LLM_API_KEY`

Una vez tengas la clave:

```bash
export NRD_LLM_API_KEY="<your-api-key>"
```

### FASE 2: Ejecutar Deploy Automático
**Comando único que hace TODO:**

```bash
cd /Users/yosbanytejas/Documents/finance-family
./FASE_05B_DEPLOY.sh
```

**El script hace automáticamente:**
1. ✅ Verifica modelo real en `/v1/models`
2. ✅ Compila backend
3. ✅ Copia a VPS
4. ✅ Configura environment
5. ✅ Instala dependencias en VPS
6. ✅ Restart service
7. ✅ Healthcheck interno
8. ✅ Healthcheck externo
9. ✅ Verifica conectividad LLM

**Tiempo estimado:** 5-10 minutos

### FASE 3: Obtener Firebase ID Token
Una vez que el deploy sea exitoso, necesitamos tokens para testing.

**Script disponible:**
```bash
cd apps/backend/server
node get-id-token.mjs
```

**Necesitarás:**
- Email de usuario Firebase
- Contraseña del usuario

### FASE 4: Ejecutar Tests Progresivos

**Test 1: Sin tool**
```bash
TOKEN="<from-step-3>"

curl -X POST https://service.nrdonline.site/api/agent/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Qué tipo de información podés consultar sobre mis finanzas?"
  }' | jq
```

**Test 2: Con tool**
```bash
curl -X POST https://service.nrdonline.site/api/agent/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Mostrame mis transacciones de septiembre de 2026."
  }' | jq
```

**Test 3-20:** Referir a FASE_05B_EXECUTION_PLAN.md

### FASE 5: Completar Reporte Final

Una vez pasen todos los tests, generar reporte con:
- Modelo exacto utilizado
- Compatibilidad API verificada
- Deployment confirmado
- Resultados de tests
- Estado de seguridad
- Estado de logs
- Estado final: COMPLETA / CON OBSERVACIONES / BLOQUEADA

---

## ESTRUCTURA DE ARCHIVOS GENERADOS

```
/Users/yosbanytejas/Documents/finance-family/
├── FASE_05B_DEPLOY.sh                    ← Script de deploy automático
├── FASE_05B_EXECUTION_PLAN.md            ← Plan detallado paso a paso
├── FASE_05B_STATUS.md                    ← Este archivo
├── apps/backend/server/
│   ├── dist/                             ← Build compilado y listo
│   ├── src/
│   │   ├── llm/
│   │   │   ├── client.ts                 ← LLM API client
│   │   │   └── types.ts                  ← Error types
│   │   ├── agent/
│   │   │   ├── orchestrator.ts           ← Main orchestrator
│   │   │   └── toolRegistry.ts           ← Tool registry
│   │   ├── finance/tools/
│   │   │   └── searchTransactions.ts     ← Transaction search (only tool)
│   │   ├── routes/
│   │   │   └── agent.routes.ts           ← POST /api/agent/query
│   │   ├── auth/
│   │   │   └── authenticatedContext.ts   ← UID isolation
│   │   └── config/
│   │       └── env.ts                    ← Environment configuration
│   ├── verify-llm-api.mjs                ← Verification script
│   ├── get-id-token.mjs                  ← Token generation
│   └── package.json                      ← Dependencies
└── apps/frontend/
    ├── src/components/
    │   └── agent/
    │       └── AgentQueryDev.tsx          ← Dev UI at /dev/agent
```

---

## ARQUITECTURA IMPLEMENTADA

```
Cliente (Browser o curl)
   ↓ Firebase ID Token
   ↓
POST /api/agent/query
   ↓ { message: string }
   ↓
Agent Routes (Fastify)
   ↓ Verify token via Firebase Admin SDK
   ↓
AuthenticatedContext { uid, familyRoot }
   ↓ (UID aislado del request body)
   ↓
AgentOrchestrator
   ↓ Build messages + tools
   ↓
LLMClient
   ↓ callCompletion()
   ↓ Authorization: Bearer NRD_LLM_API_KEY
   ↓ POST https://model.nrdonline.site/v1/chat/completions
   ↓
LLM responde con o sin tool calls
   ↓
[IF tool calls]
   ↓
ToolRegistry.executeToolRegistry()
   ↓ Validate tool name (whitelist)
   ↓ Validate arguments (reject uid, firebasePath)
   ↓
searchTransactions(context, validatedArgs)
   ↓ UID viene del context, NUNCA del args
   ↓
Firebase Realtime Database
   ↓ /families/{familyRoot}/transactions/{uid}/...
   ↓
Sanitized result
   ↓ Vuelve al LLM con contexto
   ↓
[LOOP: Max 3 iteraciones o sin más tool calls]
   ↓
LLM genera respuesta final
   ↓ answer string
   ↓
Agent Routes responde
   ↓ HTTP 200
   ↓ { answer, toolsUsed, toolIterations, requestId }
   ↓
Cliente recibe respuesta
```

---

## SEGURIDAD IMPLEMENTADA

### UID Isolation
✅ UID viene ÚNICAMENTE del Firebase ID Token verificado  
✅ NUNCA del request body  
✅ AuthenticatedContext es la barrera principal  

### Información Sensible
✅ Prohibido enviar al LLM: uid, userId, familyId, tokens, API keys  
✅ Permitido enviar: pregunta del usuario, schemas, resultados sanitizados  

### Injection Prevention
✅ Prompt injection: LLM no tiene acceso a secretos  
✅ Unknown tool: Tool registry rechaza herramientas no registradas  
✅ UID in tool args: validateSearchInput rechaza "uid" parameter  

### Logs
✅ No secrets en logs  
✅ No Firebase tokens en logs  
✅ No transacciones completas en logs  

---

## PRÓXIMOS PASOS

### Inmediato
1. [ ] Proporcionar NRD_LLM_API_KEY
2. [ ] Ejecutar FASE_05B_DEPLOY.sh
3. [ ] Obtener Firebase ID Token
4. [ ] Ejecutar tests progresivos

### Reporte Final
5. [ ] Completar tests 1-20 de requirements
6. [ ] Generar reporte final
7. [ ] Cierre: COMPLETA / CON OBSERVACIONES / BLOQUEADA

### FASE 06 (NO INICIAR)
- ❌ NO crear nuevas tools aún
- ❌ NO crear streaming
- ❌ NO crear historial/memoria
- ❌ NO crear funciones de escritura
- Esperar a cierre completo de FASE 05

---

## CONTACTO / SOPORTE

Si algo falla:

1. **Deploy script falló:**
   - Revisar error message
   - Verificar API key válida
   - Verificar conectividad VPS

2. **Health check falló:**
   ```bash
   ssh -i ~/.ssh/openclaw_vps_ed25519 openclaw-vps-root
   sudo journalctl -u finance-family-api -n 100
   ```

3. **Test falló:**
   - Verificar Firebase ID Token válido
   - Verificar transacciones existen en DB
   - Revisar logs del backend

---

**Status:** ⏳ AWAITING NRD_LLM_API_KEY  
**Next Action:** Proporcionar API key y ejecutar FASE_05B_DEPLOY.sh

