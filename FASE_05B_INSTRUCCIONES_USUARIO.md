# FASE 05B — Instrucciones para Continuar

**Estado Actual:** ⚠️ Bloqueado en 2 puntos de verificación críticos  
**Lo que verificamos:** Backend compilado, seguridad OK, VPS accesible  
**Lo que falta:** SSH access y/o NRD_LLM_API_KEY  

---

## 🚨 PROBLEMA ACTUAL

He ejecutado la FASE 05B pero encontré 2 bloqueadores:

### 1. SSH NO ACCESIBLE
```
ssh: connect to host service.nrdonline.site port 22: Operation timed out
```
**Por qué es importante:** Sin SSH, no puedo:
- Acceder a `/etc/finance-family-api/finance-family-api.env`
- Copiar el build compilado a `/opt/finance-family-api/`
- Reiniciar el servicio
- Revisar logs

### 2. NRD_LLM_API_KEY NO DISPONIBLE
```
curl https://model.nrdonline.site/v1/models -H "Authorization: Bearer INVALID"
{"error": {"message": "API key del puente incorrecta"}}
```
**Por qué es importante:** Sin ella, no puedo:
- Verificar qué modelos LLM están disponibles
- Confirmar que `/v1/chat/completions` funciona
- Verificar que tool calling es soportado
- Completar la configuración

---

## ✅ LO QUE SÍ VERIFICUÉ (SIN NECESIDAD DE SSH/API KEY)

```
✅ Backend compila correctamente
✅ Componentes LLM compilados sin errores
✅ Seguridad: uid parameter RECHAZADO (crítico)
✅ Tool Registry: searchTransactions es el único tool permitido
✅ VPS accesible por red (ping OK, HTTPS 200)
✅ Health endpoint responde correctamente
```

---

## 🎯 PRÓXIMOS PASOS (ELIGE UNA OPCIÓN)

### OPCIÓN 1: Restaurar SSH (RECOMENDADO)

**1. Verificar conectividad SSH:**
```bash
# En tu máquina (macOS):
nslookup service.nrdonline.site
# Debe mostrar: 179.43.124.107

netstat -an | grep 22
# O si tienes nmap:
nmap -p 22 service.nrdonline.site
```

**2. Si tienes acceso a panel VPS web (consola/terminal web):**
```bash
# En la terminal del panel VPS:
sudo systemctl status ssh
# Si no está corriendo:
sudo systemctl restart ssh

# Verificar puerto 22 escucha:
sudo netstat -tuln | grep 22
# Debe mostrar: tcp 0 0 0.0.0.0:22 LISTEN
```

**3. Una vez SSH funciona, verifica la clave:**
```bash
# En tu máquina:
ssh -i ~/.ssh/id_ed25519 root@service.nrdonline.site

# En VPS, verifica la clave API:
source /etc/finance-family-api/finance-family-api.env
test -n "$NRD_LLM_API_KEY" && echo "✅ EXISTE" || echo "❌ NO EXISTE"

# Si existe, verifica formato:
echo $NRD_LLM_API_KEY | head -c 20
```

**4. Una vez verificado, ejecuta deployment automático:**
```bash
# En tu máquina local:
cd /Users/yosbanytejas/Documents/finance-family
export NRD_LLM_API_KEY="<la-clave-que-verificaste>"
./FASE_05B_DEPLOY.sh
```

---

### OPCIÓN 2: Proporcionar NRD_LLM_API_KEY Manualmente

Si tienes la clave (en Google Cloud Secret Manager, o anotada en otro lugar):

**1. Configura la variable:**
```bash
export NRD_LLM_API_KEY="sk-..."
```

**2. Ejecuta diagnóstico:**
```bash
cd /Users/yosbanytejas/Documents/finance-family/apps/backend/server
node diagnose-llm-setup.mjs
```

Este comando verificará:
- ✅/❌ Endpoint `/v1/models` accesible
- ✅/❌ Cuál es el modelo real disponible
- ✅/❌ `/v1/chat/completions` funciona
- ✅/❌ Tool calling es soportado

**3. Si diagnóstico pasa, actualiza configuración VPS:**

Con SSH funcionando:
```bash
ssh -i ~/.ssh/id_ed25519 root@service.nrdonline.site
cat >> /etc/finance-family-api/finance-family-api.env << EOF
NRD_LLM_BASE_URL=https://model.nrdonline.site/v1
NRD_LLM_API_KEY=$NRD_LLM_API_KEY
NRD_LLM_MODEL=gpt-4-turbo  # O el modelo que detect diagnóstico
EOF
```

**4. Luego ejecuta deployment:**
```bash
cd /Users/yosbanytejas/Documents/finance-family
./FASE_05B_DEPLOY.sh
```

---

### OPCIÓN 3: Deploy Manual (Sin SSH, Con Panel Web)

Si no puedes restaurar SSH pero tienes acceso a panel VPS web:

**1. Prepara el build localmente:**
```bash
cd /Users/yosbanytejas/Documents/finance-family/apps/backend/server
npm run build  # Si no está hecho

# Esto genera dist/
ls dist/
```

**2. Crea tar.gz para transferencia:**
```bash
cd /Users/yosbanytejas/Documents/finance-family/apps/backend/server
tar czf backend-build.tar.gz dist/ package.json package-lock.json
```

**3. Sube backend-build.tar.gz en panel VPS web a `/tmp/`**

**4. En terminal del panel VPS (no SSH):**
```bash
cd /opt/finance-family-api
tar xzf /tmp/backend-build.tar.gz
npm ci --omit=dev
systemctl restart finance-family-api

# Verificar:
curl http://127.0.0.1:3001/health
```

**5. Desde tu máquina, verifica conectividad externa:**
```bash
curl https://service.nrdonline.site/health
# Debe mostrar: {"status":"ok","timestamp":...}
```

---

## 🔍 DIAGNÓSTICO RÁPIDO

Ejecuta esto para obtener información completa:

```bash
cd /Users/yosbanytejas/Documents/finance-family

# Ver estado compilación:
ls -la apps/backend/server/dist/ | head -10

# Ver logs locales de build:
npm run build --verbose 2>&1 | tail -50

# Si tienes API key, verificar LLM:
export NRD_LLM_API_KEY="sk-..."
cd apps/backend/server
node diagnose-llm-setup.mjs

# Verificar conectividad VPS:
curl -v https://service.nrdonline.site/health 2>&1 | grep "< HTTP"
```

---

## 📋 CHECKLIST PARA REANUDAR

Antes de que puedas continuar, necesito:

- [ ] SSH accesible O API key disponible
- [ ] Confirmar que `diagnose-llm-setup.mjs` pasa todos los tests
- [ ] Confirmar que NRD_LLM_API_KEY está configurada en VPS
- [ ] Ejecutar `./FASE_05B_DEPLOY.sh` exitosamente
- [ ] Verificar que POST `/api/agent/query` endpoint existe
- [ ] Ejecutar tests del agente

---

## 📞 INFORMACIÓN ÚTIL

### Archivos Generados
```
/Users/yosbanytejas/Documents/finance-family/
├── FASE_05B_REPORTE_VERIFICACION.md      ← Reporte detallado
├── FASE_05B_EJECUCION_RESUMEN.txt        ← Este resumen
├── FASE_05B_INSTRUCCIONES_USUARIO.md     ← Este archivo
├── FASE_05B_DEPLOY.sh                    ← Script de deployment
├── FASE_05B_STATUS.md                    ← Estado del proyecto
├── apps/backend/server/
│   ├── verify-llm-api.mjs                ← Script verificación LLM
│   ├── diagnose-llm-setup.mjs            ← Script diagnóstico (NUEVO)
│   ├── get-id-token.mjs                  ← Script para testing
│   └── dist/                             ← Build listo para deploy
```

### Comandos Útiles

**Verificar SSH:**
```bash
ssh -i ~/.ssh/id_ed25519 -v root@service.nrdonline.site
```

**Verificar conectividad general:**
```bash
curl -I https://service.nrdonline.site/health
```

**Revisar logs compilación:**
```bash
cd /Users/yosbanytejas/Documents/finance-family
npm run build 2>&1 | grep -i error
```

**Revisar estructura VPS (si SSH funciona):**
```bash
ssh root@service.nrdonline.site "ls -la /opt/finance-family-api"
```

---

## 🚀 SECUENCIA ESPERADA UNA VEZ RESUELTO

1. **Restaurar SSH** → OK SSH funciona
2. **Proporcionar/verificar API key** → OK Clave disponible
3. **Ejecutar verify-llm-api.mjs** → OK Modelo detectado
4. **Ejecutar FASE_05B_DEPLOY.sh** → OK Deploy completado
5. **Obtener Firebase ID Token** → OK Token generado
6. **Ejecutar tests del agente** → OK Tests pasan
7. **Generar reporte final** → ✅ FASE 05B COMPLETADA

---

## ❓ PREGUNTAS FRECUENTES

**P: ¿Puedo usar otro modelo LLM además de gpt-4-turbo?**
R: Sí, `diagnose-llm-setup.mjs` te mostrará la lista de modelos disponibles. Usa el que prefieras.

**P: ¿Qué pasa si SSH es imposible restaurar?**
R: Usa OPCIÓN 3 (Deploy Manual con panel VPS web) o proporciona API key manualmente.

**P: ¿Es seguro proporcionar la API key en terminal?**
R: La API key nunca se expone en logs o respuestas del servidor. Es seguro.

**P: ¿Cuánto tiempo toma todo?**
R: Una vez resueltos los bloqueadores, ~5-10 minutos para todo el deploy.

---

## 📞 SOPORTE

Si algo falla:

1. **Revisa FASE_05B_REPORTE_VERIFICACION.md** → Información detallada
2. **Ejecuta diagnose-llm-setup.mjs** → Identifica dónde falla
3. **Revisa logs SSH** → `journalctl -u finance-family-api` (si SSH funciona)
4. **Verifica firewall VPS** → Puede bloquear puerto 22

---

**Generado:** 3 de Octubre, 2026  
**Status:** AWAITING USER ACTION  
**Próxima Acción:** Restaurar SSH O proporcionar API key
