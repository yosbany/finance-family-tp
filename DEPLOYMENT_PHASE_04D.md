# FASE 04D — DEPLOYMENT REAL

**Estado:** En preparación  
**Objetivo:** Desplegar realmente el backend en producción  
**Criterio de cierre:** GET https://service.nrdonline.site/health → 200 + E2E real con Firebase  

---

## CHECKLIST PRE-DEPLOYMENT

### ✓ Frontend
- [ ] .env configurado con VITE_FINANCE_API_URL=https://service.nrdonline.site
- [ ] npm run build exitoso
- [ ] dist/ generado sin errores
- [ ] import.meta.env.VITE_FINANCE_API_URL usado correctamente

### ✓ Backend
- [ ] npm run build exitoso en server/
- [ ] dist/ compilado correctamente
- [ ] package.json + package-lock.json listos
- [ ] NO incluir node_modules en despliegue

### ✓ Firebase
- [ ] Service account JSON disponible (UBICACION: ???)
- [ ] FIREBASE_PROJECT_ID confirmado
- [ ] FIREBASE_DATABASE_URL confirmado
- [ ] Permisos de lectura verificables

### ✓ VPS Infrastructure
- [ ] SSH funcional a openclaw-vps-root
- [ ] Node.js 20 disponible en VPS
- [ ] Puerto 8030 disponible
- [ ] Nginx activo
- [ ] Certificado HTTPS listo para service.nrdonline.site

---

## ETAPAS DE DEPLOYMENT

### 1. Preparación Local (AHORA)
- Build frontend
- Build backend
- Verificar configuración

### 2. Preparación VPS
- Crear usuario finance-api
- Crear directorios /etc/finance-family-api/
- Crear directorios /opt/finance-family-api/
- Copiar Firebase credentials de forma segura

### 3. Deploy Backend
- Copiar dist/, package.json, package-lock.json
- npm ci --omit=dev en Ubuntu
- Verificar permisos

### 4. Systemd Service
- Instalar finance-family-api.service
- Configurar Environment variables
- systemctl start/enable

### 5. Nginx Proxy
- Configurar service.nrdonline.site → localhost:8030
- Verificar HTTPS

### 6. Testing
- Health check interno
- Health check HTTPS externo
- Autenticación real (sin token / inválido / válido)
- searchTransactions real
- Seguridad (injection tests)
- CORS desde frontend real
- E2E React → VPS → Firebase

---

## DOCUMENTACIÓN GENERADA

- `DEPLOYMENT_CHECKLIST.md` - Checklist ejecutable
- `deploy-backend.sh` - Script de deploy automatizado
- `finance-family-api.service` - Systemd service
- `nginx-service.conf` - Nginx proxy config
- `firebase-credentials-setup.sh` - Script de credenciales
- `test-deployment.sh` - Script de validación
- `DEPLOYMENT_LOG.md` - Registro de ejecución

---

## ESTADO ACTUAL

Esperando confirmación de:
1. Ubicación del Firebase Service Account JSON
2. Confirmación de FIREBASE_PROJECT_ID y FIREBASE_DATABASE_URL
3. SSH listo para VPS

