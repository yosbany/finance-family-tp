# DEPLOYMENT CHECKLIST — Finance Family v1.0

**Última actualización**: 14 Oct 2026  
**Status**: READY FOR DEPLOYMENT ✅

---

## ✅ Pre-Deployment Verificado

- [x] Compilación exitosa (npm run build)
- [x] Sin errores TypeScript
- [x] Tests de validación PASSED (7/7)
- [x] Seguridad validada
- [x] Tools registradas en agent
- [x] Git commit finalizado
- [x] Documentación completa

---

## 📋 Pasos para Hacer Deploy

### 1️⃣ Frontend Deployment (Hosting)

**Ubicación del build**: `apps/frontend/dist/`

**Opción A: Firebase Hosting**
```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy
firebase deploy --only hosting
```

**Opción B: Vercel / Netlify**
```bash
# Vercel
vercel --prod

# Netlify
netlify deploy --prod
```

**Opción C: Servidor Estático (NGINX)**
```bash
# Copiar dist/ a servidor
scp -r apps/frontend/dist/* user@server:/var/www/finance-family/
```

---

### 2️⃣ Backend Deployment (Cloud Functions / Server)

**Ubicación del código**: `apps/backend/server/src/`

#### Opción A: Firebase Cloud Functions

```bash
# Deploy functions
firebase deploy --only functions

# Verifica en Firebase Console
# - Logs
# - Cold start times
# - Memory usage
```

#### Opción B: Google Cloud Run

```bash
# Construir imagen Docker
docker build -t finance-family-backend .

# Push a Google Container Registry
docker push gcr.io/PROJECT_ID/finance-family-backend

# Deploy
gcloud run deploy finance-family-backend \
  --image gcr.io/PROJECT_ID/finance-family-backend \
  --platform managed \
  --region us-central1
```

#### Opción C: Servidor Tradicional

```bash
# 1. Build
npm run build

# 2. Copiar a servidor
scp -r apps/backend/dist/* user@server:/opt/finance-family/

# 3. Instalar dependencias en servidor
cd /opt/finance-family
npm install --production

# 4. Iniciar con PM2/systemd
pm2 start apps/backend/server/dist/index.js
```

---

### 3️⃣ Verificaciones Post-Deploy

```bash
# 1. Frontend
curl https://finance-family.app
# Verificar que carga sin errores

# 2. Backend API
curl https://api.finance-family.app/health
# Debe retornar { status: "ok" }

# 3. Tools registradas
curl -X POST https://api.finance-family.app/agent/tools \
  -H "Authorization: Bearer TOKEN" \
  -d '{"tool": "findSimilarTransactions"}'
# Debe retornar schema de la tool

# 4. Firebase Firestore
# - Verificar que acepta conexiones
# - Verificar índices creados
# - Verificar reglas de seguridad

# 5. Logs
firebase functions:log
# Verificar sin errores críticos
```

---

## 🔐 Variables de Entorno Requeridas

### Production Frontend (`.env.production`)
```
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
VITE_API_URL=https://api.finance-family.app
```

### Production Backend (Firebase functions config)
```bash
firebase functions:config:set \
  serviceaccount.project_id="YOUR_PROJECT_ID" \
  serviceaccount.private_key="YOUR_PRIVATE_KEY"
```

---

## 📊 Monitoreo Post-Deploy

### Métricas a Monitorear
- [ ] API response time (< 1s)
- [ ] LLM calls success rate (> 95%)
- [ ] Tool `findSimilarTransactions` latency (< 500ms)
- [ ] Firestore read/write costs
- [ ] Cold start times (Functions)
- [ ] Error rates (< 1%)
- [ ] User classification confidence (> 70% promedio)

### Dashboards
- Firebase Console: https://console.firebase.google.com
- Cloud Monitoring: https://console.cloud.google.com/monitoring
- Logs: Firebase Functions tab

---

## 🐛 Rollback Plan

Si algo sale mal:

```bash
# 1. Revert commit si no está en main
git revert COMMIT_HASH

# 2. Revert deployment (si es Firebase)
firebase deploy --only hosting --version VERSION_ANTERIOR

# 3. Escalar a equipo de infraestructura
```

---

## 📞 Contacto / Soporte

Si tienes problemas en deploy:

1. **Revisar logs**:
   ```bash
   firebase functions:log
   # o
   gcloud functions describe FUNCTION_NAME --log
   ```

2. **Common issues**:
   - Falta variable de entorno → revisar `.env.production`
   - Build error → `npm run build` local para reproducir
   - Auth error → revisar Firebase config
   - Tool no encontrada → revisar toolRegistry.ts

---

## ✅ Deployment Completado

Una vez hayas completado todos los pasos:

```bash
# Crear tag de release
git tag -a v1.0-production -m "Finance Family v1.0 - Production Release"
git push origin v1.0-production

# Crear GitHub Release (opcional)
gh release create v1.0-production --title "Finance Family v1.0 Production"
```

---

**Finance Family v1.0 está completamente listo para llevar a producción.** 🚀

Elige la opción de deployment que mejor se adapte a tu infraestructura y sigue los pasos correspondientes.
