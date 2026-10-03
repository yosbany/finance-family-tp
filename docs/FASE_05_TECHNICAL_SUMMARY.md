# FASE 05 — Resumen Técnico Ejecutivo

## Estado: FASE 05 LISTA PARA DEPLOY

### Archivos Agregados

```
server/src/llm/
  ├── types.ts              # LLM type definitions y error classes
  └── client.ts             # LLM HTTP client con manejo de errores

server/src/agent/
  ├── toolRegistry.ts       # Registry de herramientas disponibles
  └── orchestrator.ts       # Orquestador del ciclo LLM→tool→LLM

server/src/routes/
  └── agent.routes.ts       # Endpoint POST /api/agent/query

src/components/agent/
  └── AgentQueryDev.tsx     # UI de desarrollo en /dev/agent

server/
  ├── verify-llm-api.mjs    # Script para verificar API real
  ├── test-agent-local.mjs  # Script para probar agent localmente
  ├── FASE_05_IMPLEMENTATION.md
  └── FASE_05_TECHNICAL_SUMMARY.md
```

### Archivos Modificados

```
server/src/app/app.ts       # +registerAgentRoutes
server/src/config/env.ts    # Ya tiene NRD_LLM_* vars (no requiere cambio)
src/App.tsx                 # +ruta /dev/agent
```

## LLM Client Implementation

### API Compatibility

```typescript
// El cliente detecta dinámicamente:
await llmClient.getAvailableModels() // Fetches /v1/models
await llmClient.getDefaultModel()    // Retorna primer modelo disponible

// Request format:
{
  model: string,
  messages: Array<{ role: 'system'|'user'|'assistant', content: string }>,
  tools: Array<LLMToolDefinition>,
  tool_choice: 'auto'|'none',
  temperature: number,
  max_tokens: number
}

// Response format (OpenAI compatible):
{
  id: string,
  model: string,
  choices: [{
    message: {
      role: 'assistant',
      content: string | null,
      tool_calls?: Array<{
        id: string,
        function: { name: string, arguments: string }
      }>
    },
    finish_reason: 'stop' | 'tool_calls'
  }]
}
```

### Error Handling

| Error | HTTP | Description |
|-------|------|-------------|
| LLMTimeoutError | 504 | Timeout > 30s |
| LLMAuthError | 401 | Auth failed |
| LLMRateLimitError | 429 | Rate limited |
| LLMInvalidResponseError | 500 | Bad response format |
| LLMError (generic) | 500 | Other errors |

## Agent Orchestrator

### Tool Loop Algorithm

```
1. LLM responde con o sin tool_calls
2. Si sin tool_calls → retorna answer
3. Si con tool_calls:
   - Para cada tool_call:
     - Validar nombre (registry check)
     - Parse JSON arguments
     - Ejecutar tool
     - Capturar resultado/error
   - Agregar resultados a conversation
   - Volver a paso 1
4. Si iterations > MAX_TOOL_ITERATIONS → error
```

### System Prompt

```
Sos un asistente de finanzas personales.

Usá las herramientas disponibles para consultar datos reales 
antes de afirmar montos, movimientos o fechas.

No inventes información financiera.
No afirmes un dato si no lo verificaste con una herramienta.

Si los datos disponibles no alcanzan, indicalo.

No tenés acceso directo a la base de datos.
Solo podés usar las herramientas que te están disponibles.

En esta etapa todas las consultas son de solo lectura.
```

## Tool Registry

### Disponibles Actualmente

```typescript
{
  name: 'searchTransactions',
  description: 'Search financial transactions with optional filters',
  schema: {
    type: 'object',
    properties: {
      from: { type: 'number', description: 'Start timestamp (ms)' },
      to: { type: 'number', description: 'End timestamp (ms)' },
      accountId: { type: 'string' },
      categoryId: { type: 'string' },
      type: { enum: ['income', 'expense', 'transfer'] },
      currency: { enum: ['UYU', 'USD'] },
      description: { type: 'string' },
      minAmount: { type: 'number' },
      maxAmount: { type: 'number' },
      status: { enum: ['pending', 'classified', 'verified'] },
      limit: { type: 'number', max: 500 },
      offset: { type: 'number' }
    }
  }
}
```

**Prohibido:** uid, userId, familyId, firebasePath, path

## API Endpoint

### POST /api/agent/query

**Request:**
```json
{
  "message": "string (required, max 1000 chars)"
}
```

**Response (200):**
```json
{
  "answer": "string",
  "toolsUsed": ["searchTransactions"],
  "toolIterations": 2,
  "requestId": "uuid"
}
```

**Errors:**
- 400: INVALID_ARGUMENT (empty message, too long)
- 401: UNAUTHENTICATED (no token)
- 403: PERMISSION_DENIED (user not authorized)
- 504: LLM service unavailable
- 500: Internal error

## Security Guarantees

### UID Isolation

```typescript
// ✅ Seguro
const auth = await extractAuthContext(request.headers.authorization);
// auth.uid viene SOLO del token verificado
const result = await searchTransactions(auth, userInput);

// ❌ NUNCA
const uid = request.body.uid; // PROHIBITED
```

### Información Enviada al LLM

```
✅ ENVIADO:
- Pregunta del usuario
- Tool schemas
- Resultados de tools

❌ NUNCA ENVIADO:
- uid, userId, familyId
- Firebase paths/tokens
- LLM API key
- Account metadata innecesaria
```

### Validation Layers

```
1. HTTP Endpoint:
   - Check Firebase ID Token validity
   - Validate message format

2. Orchestrator:
   - Validate message length
   - Check tool names against registry

3. Tool Registry:
   - Validate tool exists
   - Parse arguments

4. searchTransactions:
   - Reject prohibited parameters (uid, familyId, etc.)
   - Validate all filter parameters
   - Apply limits (max offset, limit)
```

## Testing

### Local Testing

```bash
# 1. Verificar LLM API
export NRD_LLM_BASE_URL=https://model.nrdonline.site/v1
export NRD_LLM_API_KEY=<key>
node server/verify-llm-api.mjs

# 2. Obtener Firebase token
node server/get-id-token.mjs
export FIREBASE_ID_TOKEN=<token>

# 3. Probar agent
npm run dev  # backend
npm run dev  # frontend (otra terminal)
# Navega a http://localhost:5173/dev/agent
```

### Test Cases Checklist

- [ ] Caso 1: Sin tool (responde sobre capacidades)
- [ ] Caso 2: Tool real (query septiembre 2026)
- [ ] Caso 3: Filtros (transacciones > $10k)
- [ ] Caso 4: Description (buscar supermercado)
- [ ] Caso 5: Sin resultados (período vacío)
- [ ] Caso 6: Agregación (¿cuánto gasté?)

### Security Tests

- [ ] Prompt injection (pedirle UID)
- [ ] Unknown tool (executeFirebase)
- [ ] UID injection en tool args
- [ ] Token inválido
- [ ] User no autorizado

## Production Deployment

### VPS Configuration

```bash
# /etc/finance-family-api/finance-family-api.env
NRD_LLM_BASE_URL=https://model.nrdonline.site/v1
NRD_LLM_API_KEY=<secret-key>
NRD_LLM_MODEL=gpt-4-turbo  # Detectado automáticamente
```

### Deployment Steps

```bash
# 1. Build
cd server && npm run build

# 2. Deploy (manual o CI/CD)
systemctl stop finance-family-api
cp -r dist/* /etc/finance-family-api/
systemctl start finance-family-api

# 3. Verify
curl https://service.nrdonline.site/health
curl -H "Authorization: Bearer <token>" \
  https://service.nrdonline.site/api/agent/query \
  -d '{"message":"Hola"}'
```

## Metrics & Monitoring

### Logging Format

```json
{
  "timestamp": "2026-10-03T12:00:00Z",
  "requestId": "uuid",
  "event": "agent.query.complete",
  "duration": 1234,
  "llmDuration": 800,
  "toolExecutions": [
    { "tool": "searchTransactions", "duration": 150 }
  ],
  "toolIterations": 2,
  "status": "success"
}
```

### Alerts to Configure

- LLM timeout rate > 5%
- Tool execution error rate > 2%
- Response time > 10s
- LLM API availability < 95%

## Known Limitations

### FASE 05 Scope

- ✅ 1 tool (searchTransactions)
- ❌ No streaming
- ❌ No persistent memory
- ❌ No conversation history
- ❌ No budget limits
- ❌ No write operations

### What to Expect

- LLM response time: 1-3s typical
- Cold start: 2-5s (detecting models)
- Max query time: ~30s (LLM timeout)

### Future Work (FASE 06+)

- [ ] Multiple tools (aggregation, categorization)
- [ ] Streaming responses
- [ ] Persistent conversation history
- [ ] Context memory
- [ ] Cost analysis tools
- [ ] Write operations (categorize, bulk edit)

## Sign-Off

### Pre-Deploy Checklist

- [x] Backend compiles without errors
- [x] TypeScript strict mode
- [x] Security validation layer complete
- [x] Error handling comprehensive
- [x] Logging configured
- [ ] LLM API verified on production VPS
- [ ] Firebase auth working
- [ ] All 6 test cases pass
- [ ] Security tests pass
- [ ] Load test complete (if applicable)

### Documentation

- [x] FASE_05_IMPLEMENTATION.md
- [x] FASE_05_TECHNICAL_SUMMARY.md
- [ ] Post-deployment report

## Reporte Final

**Completar después de deployment:**

1. **API NRD**: 
   - [ ] Endpoint `/models` disponible
   - [ ] Compatibilidad tool calling confirmada
   - [ ] Modelo utilizado: ___________

2. **Test Funcionales**:
   - [ ] Caso 1: PASS / FAIL
   - [ ] Caso 2: PASS / FAIL
   - [ ] Caso 3: PASS / FAIL
   - [ ] Caso 4: PASS / FAIL
   - [ ] Caso 5: PASS / FAIL
   - [ ] Caso 6: PASS / FAIL

3. **Seguridad**:
   - [ ] Prompt injection: BLOCKED
   - [ ] UID injection: BLOCKED
   - [ ] Unknown tool: BLOCKED

4. **Estado Final**: 
   - [ ] FASE 05 COMPLETA
   - [ ] FASE 05 COMPLETA CON OBSERVACIONES
   - [ ] FASE 05 BLOQUEADA
