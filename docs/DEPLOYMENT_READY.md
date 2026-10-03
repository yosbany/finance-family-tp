# ✅ FASE 04D - DEPLOYMENT READY

**Estado:** PREPARACIÓN COMPLETA  
**Fecha:** Octubre 2, 2026  
**Objetivo:** Desplegar backend real en producción  
**Servidor:** https://service.nrdonline.site

---

## 🎯 RESUMEN EJECUTIVO

La infraestructura de despliegue está **100% lista**. Solo necesitamos:

1. **Firebase Service Account JSON** ← BLOQUEANTE
2. SSH confirmado
3. Ejecutar scripts

---

## 📦 QUÉ ESTÁ LISTO

### Backend
- ✅ Compilado: `dist/` (204 KB, 48 archivos)
- ✅ Dependencias: package.json + package-lock.json
- ✅ **NO incluye** node_modules (se instala en Linux con `npm ci --omit=dev`)
- ✅ Entry point: `dist/server.js`
- ✅ Systemd service: `finance-family-api.service`

### Frontend
- ✅ Build completado
- ✅ VITE_FINANCE_API_URL=https://service.nrdonline.site configurado
- ✅ import.meta.env utilizado correctamente

### Seguridad & Operaciones
- ✅ Firebase Admin SDK integrado
- ✅ CORS configurado: https://yosbany.github.io
- ✅ Usuario de servicio: `finance-api` (no root)
- ✅ Permisos documentados

### Documentación Generada
- ✅ DEPLOYMENT_PLAN_FASE_04D.md (paso a paso)
- ✅ FIREBASE_DEPLOYMENT_GUIDE.md (credenciales)
- ✅ NGINX_HTTPS_GUIDE.md (proxy + HTTPS)

### Scripts Automatizados
- ✅ `deploy-backend.sh` - Deploy en un comando
- ✅ `test-deployment.sh` - Tests completos
- ✅ `finance-family-api.service` - Systemd unit
- ✅ `nginx-service.conf` - Nginx config

---

## 🚀 PARA EJECUTAR DEPLOYMENT

### Paso 1: OBTENER FIREBASE SERVICE ACCOUNT

**Ubicación:** Firebase Console

```
Firebase Console → Proyecto "finance-family-tp"
  → ⚙️ Project Settings
    → "Service Accounts" tab
      → "Generate New Private Key"
```

**Alternativa:** Si ya tienes el archivo JSON en tu máquina local:
```bash
ls ~/firebase-service-account.json  # ← Verificar que existe
```

### Paso 2: EJECUTAR DESPLIEGUE

```bash
cd /Users/yosbanytejas/Documents/finance-family/server

# Ejecutar deployment automatizado
./deploy-backend.sh openclaw-vps-root ~/firebase-service-account.json
```

**El script hace automáticamente:**
1. ✅ Verifica compilación local
2. ✅ Copia dist/, package.json, package-lock.json a VPS
3. ✅ Ejecuta `npm ci --omit=dev` en Ubuntu (instala nativo)
4. ✅ Configura permisos de usuario (finance-api)
5. ✅ Mueve credenciales Firebase a /etc/finance-family-api/
6. ✅ Crea archivo .env con variables
7. ✅ Instala systemd service
8. ✅ Inicia backend

**Salida esperada:**
```
✅ Backend deployment complete!
✓ Backend test passed
Next steps:
1. Configure Nginx proxy
2. Set up HTTPS certificate
3. Test from outside VPS
```

### Paso 3: CONFIGURAR NGINX Y HTTPS (EN VPS)

```bash
# En VPS como root:

# 1. Crear config Nginx
sudo tee /etc/nginx/sites-available/service.nrdonline.site << 'EOF'
# [Contenido de nginx-service.conf desde el repo]
EOF

# 2. Activar
sudo ln -sf /etc/nginx/sites-available/service.nrdonline.site \
            /etc/nginx/sites-enabled/

# 3. Validar
sudo nginx -t

# 4. Recargar
sudo systemctl reload nginx

# 5. HTTPS (Certbot)
sudo certbot certonly --nginx -d service.nrdonline.site

# 6. Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Paso 4: VALIDAR DESPLIEGUE

```bash
# Desde tu máquina local:

# Test 1: Health check
curl -i https://service.nrdonline.site/health
# Esperado: HTTP/2 200

# Test 2: Sin token (debe rechazar)
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
# Esperado: 401

# Test 3: Con token válido
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2024-01-01", "endDate": "2024-01-31", "limit": 5}'
# Esperado: 200 con transacciones
```

**O usar script:**
```bash
./test-deployment.sh https://service.nrdonline.site $FIREBASE_ID_TOKEN
```

---

## 📋 CHECKLIST FINAL

### Antes de ejecutar:
- [ ] Firebase Service Account JSON descargado o ubicado
- [ ] `cat ~/firebase-service-account.json` devuelve JSON válido
- [ ] SSH `ssh openclaw-vps-root` funciona sin problemas
- [ ] Estoy en `/Users/yosbanytejas/Documents/finance-family/server`

### Después de deploy:
- [ ] `curl http://127.0.0.1:8030/health` devuelve 200 (en VPS)
- [ ] `sudo systemctl status finance-family-api` → active
- [ ] `sudo journalctl -u finance-family-api` sin errores
- [ ] `curl https://service.nrdonline.site/health` devuelve 200
- [ ] Certificado HTTPS válido

### E2E:
- [ ] Obtener Firebase ID Token
- [ ] POST /api/tools/search-transactions con token
- [ ] Recibir transacciones reales (HTTP 200)
- [ ] Frontend conecta correctamente

---

## ⚠️ CRÍTICOS

### 1. Firebase Service Account
- **NUNCA** en Git
- **NUNCA** imprimir en logs
- Permisos: `640` (lectura solo para finance-api)

### 2. HTTPS Obligatorio
- Dominio: `service.nrdonline.site` exactamente
- Certificado válido requerido
- Auto-renewal configurado

### 3. Backend Securo
- Corre como `finance-api` (no root)
- Systemd restart on failure
- Logs sanitizados (sin credenciales)

---

## 📊 TIMELINE

```
T+0 min   → Confirmar Firebase JSON disponible
T+5 min   → Ejecutar ./deploy-backend.sh (automatizado)
T+15 min  → Backend running en 127.0.0.1:8030
T+30 min  → Configurar Nginx y HTTPS
T+45 min  → Tests externos
T+60 min  → E2E real
T+75 min  → COMPLETO
```

**Total: ~75 minutos**

---

## 🎓 REFERENCIA RÁPIDA

### Ver logs del backend
```bash
ssh openclaw-vps-root "sudo journalctl -u finance-family-api -f"
```

### Reiniciar backend
```bash
ssh openclaw-vps-root "sudo systemctl restart finance-family-api"
```

### Test local en VPS
```bash
ssh openclaw-vps-root "curl http://127.0.0.1:8030/health"
```

### Ver estado Nginx
```bash
ssh openclaw-vps-root "sudo systemctl status nginx"
```

---

## 📚 DOCUMENTOS DISPONIBLES

En el repositorio:

```
DEPLOYMENT_PLAN_FASE_04D.md
  → Plan ejecutable paso a paso

FIREBASE_DEPLOYMENT_GUIDE.md
  → Seguridad de credenciales

NGINX_HTTPS_GUIDE.md
  → Configuración reverse proxy

server/deploy-backend.sh
  → Script automatizado

server/test-deployment.sh
  → Suite de tests

server/finance-family-api.service
  → Systemd unit

server/nginx-service.conf
  → Nginx configuration
```

---

## ❓ PREGUNTAS FRECUENTES

### ¿Qué pasa si falla el deploy?

```bash
# Rollback (en VPS):
sudo systemctl stop finance-family-api
sudo systemctl disable finance-family-api
sudo rm -rf /opt/finance-family-api
sudo rm -f /etc/systemd/system/finance-family-api.service
sudo systemctl daemon-reload

# Luego reintentar
```

### ¿Dónde se almacenan las credenciales Firebase?

```
/etc/finance-family-api/firebase-service-account.json
```

Permisos: `root:finance-api` 640 (solo finance-api puede leer)

### ¿Qué puerto usa el backend?

- **Interno:** 127.0.0.1:8030 (accesible solo desde Nginx)
- **Externo:** https://service.nrdonline.site (via Nginx proxy)

### ¿Se instala docker?

NO. El VPS está especificado sin Docker. Deployment directo con Node.js + systemd.

### ¿Puedo modificar otros vhosts (model.nrdonline.site, etc)?

NO. Solo configuramos `service.nrdonline.site`.

---

## ✅ CRITERIO DE CIERRE FASE 04

FASE 04D está **COMPLETA** si:

```
✓ GET https://service.nrdonline.site/health → 200
✓ POST /api/tools/search-transactions (sin token) → 401
✓ POST /api/tools/search-transactions (token inválido) → 401
✓ POST /api/tools/search-transactions (token válido) → 200 + datos
✓ E2E: Frontend → Backend → Firebase → Transacciones
✓ Certificado HTTPS válido
✓ Logs sin sensibles (credenciales, tokens, etc)
```

---

## 🎯 SIGUIENTE PASO

**Usuario debe hacer:**
1. Obtener Firebase Service Account JSON
2. Confirmar ubicación: `~/firebase-service-account.json`
3. Ejecutar: `./server/deploy-backend.sh openclaw-vps-root ~/firebase-service-account.json`
4. Reportar resultado

---

**¡Deployment listo! Esperando tu acción.**

