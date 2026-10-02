# PLAN DE DESPLIEGUE FASE 04D

**Fecha:** Octubre 2, 2026  
**Estado:** PREPARACIÓN  
**Objetivo:** Desplegar backend en producción (service.nrdonline.site)

---

## 📋 PRE-REQUISITOS VERIFICADOS

✅ Backend compilado (dist/ listo)  
✅ Frontend build listo  
✅ agentApi.service.ts configurado  
✅ SSH funcional a openclaw-vps-root  
✅ Node.js 20 en VPS (verificar)  
✅ Nginx activo en VPS  
✅ Docker NO instalado (como se requiere)

⏳ PENDIENTE: Firebase Service Account JSON

---

## 🎯 ETAPAS DE DEPLOYMENT

### ETAPA 1: PREPARACIÓN LOCAL (AHORA)

**Tareas:**
1. ✅ Build frontend + backend completado
2. ✅ agentApi.service validado
3. ⏳ Confirmar Firebase Service Account está disponible
4. ⏳ Generar documentación de seguridad
5. ⏳ Crear scripts automatizados

**Archivos generados:**
- `deploy-backend.sh` - Deploy automatizado
- `test-deployment.sh` - Tests post-deploy
- `finance-family-api.service` - Systemd unit
- `nginx-service.conf` - Reverse proxy config
- `FIREBASE_DEPLOYMENT_GUIDE.md` - Guía de credenciales
- `NGINX_HTTPS_GUIDE.md` - Guía de proxy

---

### ETAPA 2: ACCESO VPS (T+15 min)

**Conexión SSH:**
```bash
ssh openclaw-vps-root
```

**Verificaciones iniciales:**
```bash
# System
lsb_release -a        # → Ubuntu 22.04.5
node --version        # → v20.x.x
npm --version         # → 10.x.x

# Services
sudo systemctl status nginx
sudo systemctl status docker  # → inactive (expected)

# Ports
sudo ss -tlnp | grep -E ':80|:443|:8030'

# DNS
nslookup service.nrdonline.site  # → 179.43.124.107
```

**CHECKPOINT:** Todos los requisitos presentes → CONTINUAR

---

### ETAPA 3: FIREBASE SETUP (T+30 min)

**CRÍTICO: Sin esto, el backend no funcionará**

```bash
# Local machine:
scp ~/firebase-service-account.json openclaw-vps-root:/tmp/

# En VPS:
ssh openclaw-vps-root

# Crear usuario service
sudo useradd -r -s /bin/false finance-api 2>/dev/null || true

# Mover credenciales a ubicación segura
sudo mkdir -p /etc/finance-family-api
sudo mv /tmp/firebase-service-account.json \
        /etc/finance-family-api/firebase-service-account.json

# Configurar permisos (CRÍTICO)
sudo chown root:finance-api /etc/finance-family-api/firebase-service-account.json
sudo chmod 640 /etc/finance-family-api/firebase-service-account.json

# Verificar acceso
sudo -u finance-api test -r /etc/finance-family-api/firebase-service-account.json && \
  echo "✓ finance-api puede leer" || \
  echo "✗ ERROR: finance-api no puede leer"
```

**CHECKPOINT:** Permisos verificados → CONTINUAR

---

### ETAPA 4: DEPLOY BACKEND (T+45 min)

**En VPS:**
```bash
# Crear directorio de deploy
sudo mkdir -p /opt/finance-family-api
sudo mkdir -p /etc/finance-family-api

# Crear usuario de servicio (si no existe)
sudo useradd -r -s /bin/false finance-api 2>/dev/null || true
```

**Desde local:**
```bash
# En directorio /server
cd /Users/yosbanytejas/Documents/finance-family/server

# Ejecutar deploy script
./deploy-backend.sh openclaw-vps-root ~/firebase-service-account.json
```

**Script hace automáticamente:**
1. Compila backend
2. Copia dist/, package.json, package-lock.json
3. Ejecuta `npm ci --omit=dev` en VPS (Ubuntu native)
4. Configura permisos
5. Crea archivo .env en /etc/finance-family-api/
6. Instala systemd service
7. Inicia backend

**Salida esperada:**
```
✓ Backend deployment complete!
Next steps:
1. Configure Nginx proxy
2. Set up HTTPS certificate
3. Test from outside VPS
```

**CHECKPOINT:** Backend iniciado sin errores → CONTINUAR

---

### ETAPA 5: HEALTH CHECK INTERNO (T+60 min)

**En VPS:**
```bash
# Test 1: Backend responde
curl -i http://127.0.0.1:8030/health

# Esperado:
# HTTP/1.1 200 OK
# {"status":"ok","timestamp":1234567890}

# Test 2: Ver logs
sudo journalctl -u finance-family-api -n 30

# Esperado:
# 🚀 Starting Finance Family REST API Backend...
# 📋 Validating configuration...
# 🔥 Initializing Firebase Admin SDK...
# ⚙️  Creating Fastify application...
# ✅ Server is running on http://127.0.0.1:8030

# Test 3: Sin token → 401
curl -X POST http://127.0.0.1:8030/api/tools/search-transactions \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'

# Esperado: 401 UNAUTHENTICATED
```

**CHECKPOINT:** Health check OK → CONTINUAR

---

### ETAPA 6: NGINX + HTTPS (T+75 min)

**En VPS:**
```bash
# 1. Crear config Nginx
sudo tee /etc/nginx/sites-available/service.nrdonline.site << 'EOF'
# [Contenido de nginx-service.conf]
EOF

# 2. Activar virtual host
sudo ln -sf /etc/nginx/sites-available/service.nrdonline.site \
            /etc/nginx/sites-enabled/

# 3. Validar config
sudo nginx -t

# 4. Recargar Nginx
sudo systemctl reload nginx

# 5. Generar certificado HTTPS
sudo certbot certonly --nginx -d service.nrdonline.site

# 6. Verificar certificado
sudo certbot certificates

# 7. Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

**CHECKPOINT:** Nginx válido y HTTPS activado → CONTINUAR

---

### ETAPA 7: TESTS EXTERNOS (T+90 min)

**DESDE TU MÁQUINA LOCAL:**

```bash
# Test 1: Health HTTPS
curl -i https://service.nrdonline.site/health

# Esperado: HTTP/2 200

# Test 2: Sin token → 401
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'

# Esperado: 401

# Test 3: Token inválido → 401
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer invalid.token" \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'

# Esperado: 401

# Test 4: Security - UID injection
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uid": "other_user", "limit": 5}'

# Esperado: 400 (forbidden/rejected)
```

**Usar script:**
```bash
./test-deployment.sh https://service.nrdonline.site
# o con token:
./test-deployment.sh https://service.nrdonline.site $FIREBASE_ID_TOKEN
```

**CHECKPOINT:** Tests externos pasan → CONTINUAR

---

### ETAPA 8: E2E REAL (T+105 min)

**ESTE ES EL TEST MÁS IMPORTANTE**

Necesitamos:
1. Usuario real en Firebase Authentication
2. Valid Firebase ID Token
3. Transactions en Realtime Database

**Proceso:**

**Paso 1:** Obtener ID Token
```typescript
// En navegador o Node.js:
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const user = await signInWithEmailAndPassword(auth, email, password);
const idToken = await user.user.getIdToken();
console.log('ID Token:', idToken);
```

**Paso 2:** Hacer request real
```bash
ID_TOKEN="<token-obtenido-arriba>"

curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "limit": 5
  }'
```

**Paso 3:** Verificar respuesta
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "date": "2024-01-15",
      "description": "...",
      "amount": 100,
      "category": "..."
    }
  ],
  "count": 5
}
```

**CHECKPOINT:** E2E funciona → FASE 04 COMPLETA

---

## ⚠️ PUNTOS CRÍTICOS

### 1. Firebase Service Account
- **NO** guardar en Git
- **NO** imprimir en logs
- **NO** compartir por email
- Permisos: 640, owner=root, group=finance-api

### 2. Certificado HTTPS
- Válido para `service.nrdonline.site` exactamente
- Auto-renewal configurado
- Expira en ~90 días

### 3. Usuario de Servicio
- Backend corre como `finance-api` (no root)
- `finance-api` puede leer credenciales Firebase
- Otros usuarios no pueden

### 4. CORS
- Frontend: https://yosbany.github.io
- Backend: ALLOWED_ORIGINS configurado
- NO usar `*` en producción

### 5. Environment Variables
- NODE_ENV=production
- PORT=8030
- FIREBASE_PROJECT_ID=finance-family-tp
- FIREBASE_DATABASE_URL=https://finance-family-tp.firebaseio.com
- GOOGLE_APPLICATION_CREDENTIALS=/etc/finance-family-api/firebase-service-account.json
- ALLOWED_ORIGINS=https://yosbany.github.io

---

## 📊 TIMELINE ESTIMADO

| Etapa | Tiempo | Acumulado |
|-------|--------|-----------|
| 1. Preparación local | 15 min | 15 min |
| 2. Acceso VPS | 15 min | 30 min |
| 3. Firebase setup | 15 min | 45 min |
| 4. Deploy backend | 15 min | 60 min |
| 5. Health check | 15 min | 75 min |
| 6. Nginx + HTTPS | 15 min | 90 min |
| 7. Tests externos | 15 min | 105 min |
| 8. E2E real | 15 min | 120 min |

**TOTAL ESTIMADO: 2 horas**

---

## 🚨 ROLLBACK

Si algo falla:

```bash
# En VPS:
sudo systemctl stop finance-family-api
sudo systemctl disable finance-family-api

# Limpiar
sudo rm -rf /opt/finance-family-api
sudo rm -f /etc/systemd/system/finance-family-api.service
sudo systemctl daemon-reload
```

---

## ✅ CRITERIO DE CIERRE

FASE 04 está completa SI y SOLO SI:

```bash
# Test 1: Health check
curl https://service.nrdonline.site/health
# → HTTP 200

# Test 2: E2E real con usuario + Firebase
# Usuario inicia sesión → ID Token → searchTransactions → Datos
# → HTTP 200 con transacciones reales
```

---

## 📝 SIGUIENTE PASO

1. Confirmar Firebase Service Account está disponible
2. Ejecutar despliegue según plan
3. Generar reporte final con todos los tests

