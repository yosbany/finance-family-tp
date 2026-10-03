# FASE 05B — PLAN DE EJECUCIÓN

**Fecha:** Oct 3, 2026  
**Estado:** PREPARACIÓN LISTA  
**Requerimiento crítico:** NRD_LLM_API_KEY para model.nrdonline.site

---

## ✅ VERIFICACIONES COMPLETADAS

### Conectividad VPS
- ✅ SSH funciona: `openclaw-vps-root` (ed25519)
- ✅ Sistema: Ubuntu 22.04.5 LTS
- ✅ Node.js: v22.23.2 (listo para production)
- ✅ npm: 10.9.8 (satisface requirements)
- ✅ Nginx activo
- ✅ DNS: service.nrdonline.site → 179.43.124.107

### Backend Local
- ✅ LLMClient implementado con manejo de errores
- ✅ AgentOrchestrator con loop tool calling (max 3 iteraciones)
- ✅ ToolRegistry con searchTransactions (único tool)
- ✅ AgentRoutes en `/api/agent/query`
- ✅ Validación de seguridad: UID isolation garantizado
- ✅ SearchTransactions valida parámetros prohibidos (uid, firebasePath, etc.)

### Código de Verificación
- ✅ verify-llm-api.mjs (listo para ejecutar en VPS)
- ✅ Test suite preparado

---

## ⏳ REQUERIMIENTOS PENDIENTES

### 1. NRD_LLM_API_KEY
**Necesario para:** Comunicación con `model.nrdonline.site`  
**Ubicación final:** `/etc/finance-family-api/finance-family-api.env`  
**Formato:** Bearer token o API key string  
**Secreto:** NO debe imprimirse en logs, respuestas o documentación

---

## FASE 05B ROADMAP (BLOQUEADO EN PASO 1)

### PASO 1: OBTENER API KEY DEL PUENTE
```bash
# Usuario debe proporcionar:
# - NRD_LLM_API_KEY
# - Confirmación: ¿Qué modelo(s) están disponibles?
```

**Bloqueador:** Sin esto no puedo verificar `/v1/models`

---

### PASO 2: VERIFICAR MODELO REAL (AUTOMÁTICO CUANDO TENGA KEY)
```bash
# En VPS:
ssh openclaw-vps-root

export NRD_LLM_BASE_URL="https://model.nrdonline.site/v1"
export NRD_LLM_API_KEY="<KEY-AQUI>"

# Ejecutar script de verificación
cd /Users/yosbanytejas/Documents/finance-family/apps/backend/server
node verify-llm-api.mjs

# Esperado output:
# ✅ /v1/models → [lista de modelos]
# ✅ /v1/chat/completions → funciona
# ✅ Tool calling → soportado
```

---

### PASO 3: CONSTRUIR BACKEND
```bash
cd /Users/yosbanytejas/Documents/finance-family/apps/backend/server

npm install
npm run build

# Output: dist/ generado
ls -la dist/
```

---

### PASO 4: COPIAR A VPS
```bash
scp -r dist/ package.json package-lock.json \
  -i ~/.ssh/openclaw_vps_ed25519 \
  openclaw-vps-root:/tmp/finance-family-build/
```

---

### PASO 5: CONFIGURAR ENVIRONMENT EN VPS
```bash
ssh -i ~/.ssh/openclaw_vps_ed25519 openclaw-vps-root

# Crear archivo de configuración
sudo tee /etc/finance-family-api/finance-family-api.env > /dev/null << 'ENVEOF'
NODE_ENV=production
PORT=3001
FIREBASE_PROJECT_ID=nrd-db
FIREBASE_DATABASE_URL=https://nrd-db-default-rtdb.firebaseio.com
ALLOWED_ORIGINS=https://yosbany.github.io
GOOGLE_APPLICATION_CREDENTIALS=/etc/finance-family-api/firebase-service-account.json

# FASE 05 - LLM Integration
NRD_LLM_BASE_URL=https://model.nrdonline.site/v1
NRD_LLM_API_KEY=<SECRET>
NRD_LLM_MODEL=<DETERMINED-FROM-/models>
ENVEOF

# Verificar permisos (solo root puede leer)
sudo chmod 600 /etc/finance-family-api/finance-family-api.env
```

---

### PASO 6: ACTUALIZAR BACKEND EN /opt
```bash
ssh -i ~/.ssh/openclaw_vps_ed25519 openclaw-vps-root

# Backup (optional)
sudo cp -r /opt/finance-family-api /opt/finance-family-api.backup-05

# Actualizar código
sudo cp -r /tmp/finance-family-build/* /opt/finance-family-api/

# Instalar dependencias (sin dev)
cd /opt/finance-family-api
sudo npm ci --omit=dev

# Verificar
ls -la dist/ package.json package-lock.json
```

---

### PASO 7: HEALTHCHECK BÁSICO
```bash
# En VPS
curl -s http://127.0.0.1:3001/health | jq

# Esperado:
# { "status": "ok", "timestamp": 1234567890 }
```

---

### PASO 8: RESTART SERVICE
```bash
sudo systemctl restart finance-family-api

# Wait 2 seconds
sleep 2

# Check status
sudo systemctl status finance-family-api

# View logs
sudo journalctl -u finance-family-api -n 50
```

---

### PASO 9: HEALTHCHECK EXTERNO
```bash
# Desde tu máquina local
curl -i https://service.nrdonline.site/health

# Esperado:
# HTTP/2 200
```

---

### PASO 10: TEST SIN TOOL (Paso 6 de requirements)
```bash
# Necesitas: Firebase ID Token válido para usuario de prueba

TOKEN="<valid-firebase-id-token>"

curl -X POST https://service.nrdonline.site/api/agent/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Qué tipo de información podés consultar sobre mis finanzas?"
  }' | jq

# Esperado:
# {
#   "answer": "[respuesta del modelo]",
#   "toolsUsed": [],
#   "toolIterations": 1,
#   "requestId": "uuid"
# }
```

---

### PASO 11: TEST CON TOOL REAL (Paso 7 de requirements)
```bash
# Mismo token

curl -X POST https://service.nrdonline.site/api/agent/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Mostrame mis transacciones de septiembre de 2026."
  }' | jq '.toolsUsed, .pagination'

# Esperado:
# {
#   "toolsUsed": ["searchTransactions"],
#   "pagination": {
#     "total": N,
#     "matched": N,
#     "truncated": false
#   }
# }
```

---

### PASO 12: TESTS ADICIONALES (8-20 de requirements)

Completar secuencialmente:

- [ ] 8. Validar argumentos generados (from, to timestamps válidos)
- [ ] 9. Filtro por monto > $10.000
- [ ] 10. Búsqueda por descripción "supermercado"
- [ ] 11. Sin resultados (período sin movimientos)
- [ ] 12. Total de gastos (limitaciones)
- [ ] 13. Paginación
- [ ] 14. Prompt injection
- [ ] 15. Unknown tool
- [ ] 16. UID injection
- [ ] 17. Aislamiento de contexto
- [ ] 18. Logs (sin secrets)
- [ ] 19. Frontend dev `/dev/agent`
- [ ] 20. Errores del LLM

---

## REPORTE FINAL (Requirements 1-12)

Cuando completes PASO 11:

### 1. Modelo
Model ID exacto utilizado y detectado de `/v1/models`

### 2. Compatibilidad API
- Endpoints: `/models`, `/chat/completions` funcionan ✓
- Tool calling: Soportado ✓

### 3. Deployment
- Backend actualizado en `/opt/finance-family-api` ✓
- Archivos: dist/, package.json, package-lock.json ✓

### 4. Test sin tool
- HTTP 200 ✓
- toolsUsed = [] ✓
- answer != vacío ✓

### 5. Test tool real
- HTTP 200 ✓
- toolsUsed = ["searchTransactions"] ✓
- toolIterations >= 1 ✓
- Cantidad de resultados: [N]

### 6. Filtros
- Período sept 2026: [resultado]
- Monto > $10.000: [resultado]
- Descripción "supermercado": [resultado]

### 7. Cero resultados
- Comportamiento: [descripción]

### 8. Totales y paginación
- Limitaciones observadas: [descripción]

### 9. Seguridad
- Prompt injection: ✓ Rechazado
- Unknown tool: ✓ Rechazado
- UID injection: ✓ Rechazado

### 10. Errores
- Timeout/auth/tool args: [comportamiento]

### 11. Frontend
- `/dev/agent` contra backend productivo: [resultado]

### 12. Logs
- Secrets ausentes: ✓
- Datos sensibles ausentes: ✓

### 13. Estado Final
- [ ] FASE 05 COMPLETA
- [ ] FASE 05 COMPLETA CON OBSERVACIONES
- [ ] FASE 05 BLOQUEADA

---

## BLOQUEADORES ACTUALES

1. **NRD_LLM_API_KEY** - Necesaria para validar modelo real
   - Solicitada al usuario
   - Una vez obtenida: procede automáticamente

2. **Firebase ID Token válido** - Necesario para tests autenticados
   - Puede generarse con script `get-id-token.mjs`
   - Usuario debe tener cuenta de prueba en Firebase

3. **Transacciones reales en Firebase** - Necesarias para tests end-to-end
   - Deben existir en la DB para septiembre 2026

---

## SIGUIENTES PASOS

1. **Proporcionar NRD_LLM_API_KEY**
   - Confirmar exactitud
   - Confirmar modelo(s) disponibles

2. **Ejecutar PASO 2-4** 
   - Verificación de modelo
   - Build del backend
   - Copia a VPS

3. **Ejecutar PASO 5-9**
   - Configuración de environment
   - Deploy y restart
   - Healthchecks

4. **Ejecutar PASO 10-20**
   - Tests progresivos
   - Reporte final
   - CIERRE DE FASE 05

---

