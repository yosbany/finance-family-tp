# Firebase Admin SDK - Deployment Guide

## RESUMEN CRÍTICO

La conexión con Firebase en producción requiere:

```
React Frontend 
  ↓ (obtiene ID Token)
Firebase Authentication
  ↓ (verifica usuario)
REST Backend (service.nrdonline.site)
  ↓ (valida ID Token)
Firebase Admin SDK
  ↓ (acceso administrativo)
Realtime Database
  ↓ (searchTransactions)
React (datos)
```

---

## PASO 1: Obtener Service Account Credentials

### Localización en Firebase Console

1. Ve a **Firebase Console** → Proyecto **finance-family-tp**
2. Menú lateral: **⚙️ Project Settings** (engranaje)
3. Tab: **Service Accounts**
4. Click: **Generate New Private Key** (o descargar uno existente)
5. Se descarga un archivo JSON como:
   ```
   finance-family-tp-xxxxx.json
   ```

### Contenido del JSON

```json
{
  "type": "service_account",
  "project_id": "finance-family-tp",
  "private_key_id": "xxxxxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@finance-family-tp.iam.gserviceaccount.com",
  "client_id": "11111111111111111111",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

⚠️ **NUNCA**:
- Guardar en Git
- Imprimir en logs
- Compartir por email
- Incluir en código fuente

---

## PASO 2: Transferir a VPS de Forma Segura

### Opción A: Usar SCP (RECOMENDADO)

```bash
# En tu máquina local
scp ~/firebase-service-account.json root@openclaw-vps:/tmp/

# En el VPS (como root)
sudo mkdir -p /etc/finance-family-api
sudo mv /tmp/firebase-service-account.json /etc/finance-family-api/

# Verificar integridad
sudo cat /etc/finance-family-api/firebase-service-account.json | jq '.project_id'
# Debe devolver: "finance-family-tp"
```

### Opción B: Paste manualmente (si no puedes usar SCP)

```bash
# En VPS como root
cat > /tmp/firebase-service-account.json << 'EOF'
{
  "type": "service_account",
  "project_id": "finance-family-tp",
  ...
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIB...\n-----END PRIVATE KEY-----\n",
  ...
}
EOF

# Mover a ubicación segura
sudo mkdir -p /etc/finance-family-api
sudo mv /tmp/firebase-service-account.json /etc/finance-family-api/

# Eliminar copia en /tmp
rm -f /tmp/firebase-service-account.json
```

---

## PASO 3: Configurar Permisos Seguros

**CRÍTICO:** El usuario de servicio `finance-api` DEBE poder leer el archivo, pero otros usuarios NO.

```bash
# En VPS, como root:

# 1. Crear usuario finance-api (si no existe)
sudo useradd -r -s /bin/false finance-api 2>/dev/null || true

# 2. Verificar que el archivo existe
sudo ls -la /etc/finance-family-api/firebase-service-account.json

# 3. Configurar propietario
sudo chown root:finance-api /etc/finance-family-api/firebase-service-account.json

# 4. Configurar permisos (640 = rw- r-- ---)
#    - Owner (root): lectura/escritura
#    - Group (finance-api): lectura
#    - Others: nada
sudo chmod 640 /etc/finance-family-api/firebase-service-account.json

# 5. Verificar
sudo ls -la /etc/finance-family-api/firebase-service-account.json
# Debe mostrar: -rw-r----- 1 root finance-api ...
```

---

## PASO 4: Verificar Acceso del Servicio

```bash
# En VPS:

# Test 1: ¿Puede el usuario finance-api leer el archivo?
sudo -u finance-api test -r /etc/finance-family-api/firebase-service-account.json && \
  echo "✓ finance-api CAN READ" || \
  echo "✗ finance-api CANNOT READ"

# Test 2: Verificar contenido desde el usuario de servicio
sudo -u finance-api cat /etc/finance-family-api/firebase-service-account.json | head -5

# Test 3: ¿Otros usuarios pueden leer?
sudo -u nobody test -r /etc/finance-family-api/firebase-service-account.json && \
  echo "✗ SECURITY ISSUE: nobody can read!" || \
  echo "✓ nobody cannot read (good)"
```

---

## PASO 5: Configurar Variables de Entorno

Crear archivo `/etc/finance-family-api/finance-family-api.env`:

```bash
# En VPS, como root:

sudo cat > /etc/finance-family-api/finance-family-api.env << 'EOF'
NODE_ENV=production
PORT=8030

# Firebase Configuration
FIREBASE_PROJECT_ID=finance-family-tp
FIREBASE_DATABASE_URL=https://finance-family-tp.firebaseio.com

# Path to Firebase Service Account JSON
GOOGLE_APPLICATION_CREDENTIALS=/etc/finance-family-api/firebase-service-account.json

# Frontend Origin (CORS)
ALLOWED_ORIGINS=https://yosbany.github.io

# LLM (FASE 05+, no usar todavía)
NRD_LLM_BASE_URL=https://model.nrdonline.site/v1
# NRD_LLM_API_KEY=... (NO configurar hasta FASE 05)
EOF

# Configurar permisos (como root)
sudo chmod 640 /etc/finance-family-api/finance-family-api.env
sudo chown root:finance-api /etc/finance-family-api/finance-family-api.env
```

---

## PASO 6: Verificar Firebase Admin SDK en Backend

El backend debe estar compilado correctamente:

```bash
# En local (antes de deploy):
cat server/src/firebase/admin.ts | grep -A 10 "initializeFirebase"

# Debe contener algo como:
# admin.initializeApp({
#   credential: admin.credential.applicationDefault(),
#   databaseURL: config.firebaseDatabaseUrl
# });
```

Verificar que usa `GOOGLE_APPLICATION_CREDENTIALS`:

```bash
# En backend compilado
grep -r "GOOGLE_APPLICATION_CREDENTIALS" server/dist/
# Debe encontrar referencias en config/env.js
```

---

## PASO 7: Test de Inicialización en VPS

Después de desplegar, verificar que Firebase se inicializa correctamente:

```bash
# En VPS, como root:

# Ver logs del servicio
sudo journalctl -u finance-family-api -n 20 -f

# Buscar mensajes de Firebase
sudo journalctl -u finance-family-api | grep -i firebase

# Esperados:
# "🔥 Initializing Firebase Admin SDK..."
# ✅ (No debe haber errores)
```

---

## PASO 8: Verificar Conectividad con Database

```bash
# En VPS, como root:

# Hacer test desde la CLI de Node
sudo -u finance-api node -e "
const admin = require('firebase-admin');
const serviceAccount = require('/etc/finance-family-api/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://finance-family-tp.firebaseio.com'
});

admin.database().ref('.info/connected').on('value', snap => {
  console.log('✓ Connected:', snap.val());
  process.exit(0);
});

setTimeout(() => {
  console.log('✗ Timeout: Could not connect');
  process.exit(1);
}, 5000);
"
```

---

## PASO 9: Verificar Acceso a Datos

```bash
# Test de lectura desde /users/{uid}/transactions
sudo -u finance-api node -e "
const admin = require('firebase-admin');
const serviceAccount = require('/etc/finance-family-api/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://finance-family-tp.firebaseio.com'
});

const uid = 'YOUR_TEST_UID'; // Reemplazar con un UID real

admin.database().ref('/users/' + uid + '/transactions').limitToFirst(1).once('value', snap => {
  const data = snap.val();
  console.log('✓ Can read transactions:', !!data);
  process.exit(0);
});

setTimeout(() => {
  console.log('✗ Timeout: Could not read data');
  process.exit(1);
}, 5000);
"
```

---

## TROUBLESHOOTING

### Error: ENOENT: no such file or directory

```
Error: GOOGLE_APPLICATION_CREDENTIALS file not found
```

**Solución:**
```bash
# 1. Verificar ruta
sudo ls -la /etc/finance-family-api/firebase-service-account.json

# 2. Verificar variable en .env
sudo grep GOOGLE_APPLICATION_CREDENTIALS /etc/finance-family-api/finance-family-api.env

# 3. Reiniciar servicio
sudo systemctl restart finance-family-api
```

### Error: Permission denied

```
Error: Cannot read service account credentials: EACCES: permission denied
```

**Solución:**
```bash
# Revisar permisos
sudo ls -la /etc/finance-family-api/firebase-service-account.json

# Debe ser: -rw-r----- 1 root finance-api
# Si no, ajustar:
sudo chmod 640 /etc/finance-family-api/firebase-service-account.json
sudo chown root:finance-api /etc/finance-family-api/firebase-service-account.json
```

### Error: Invalid service account

```
Error: Service account credentials are invalid or malformed
```

**Solución:**
```bash
# Verificar integridad del JSON
sudo cat /etc/finance-family-api/firebase-service-account.json | jq '.' > /dev/null

# Debe devolver: (sin errores)
# Si hay error, el JSON está corrupto. Descargar nuevamente de Firebase.

# Verificar campos críticos
sudo cat /etc/finance-family-api/firebase-service-account.json | jq '{project_id, private_key_id, client_email}'
```

### Error: Database connection refused

```
Error: Cannot connect to Firebase Realtime Database
```

**Solución:**
```bash
# 1. Verificar que FIREBASE_DATABASE_URL es correcto
sudo grep FIREBASE_DATABASE_URL /etc/finance-family-api/finance-family-api.env

# Debe ser: https://finance-family-tp.firebaseio.com

# 2. Verificar conectividad de red (desde VPS)
curl -I https://finance-family-tp.firebaseio.com

# Debe devolver: HTTP/2 200

# 3. Si está detrás de proxy/firewall, asegurar que HTTPS outbound está habilitado
```

---

## SEGURIDAD: CHECKLIST PRE-PRODUCCIÓN

- [ ] Service account JSON descargado de Firebase Console
- [ ] JSON transferido de forma segura (SCP o similar)
- [ ] JSON en `/etc/finance-family-api/` (NO en /opt/finance-family-api/)
- [ ] Permisos configurados: `640` con owner `root` y group `finance-api`
- [ ] Usuario `finance-api` PUEDE leer el archivo
- [ ] Otros usuarios NO PUEDEN leer el archivo
- [ ] JSON NO aparece en Git
- [ ] JSON NO aparece en logs
- [ ] Variable `GOOGLE_APPLICATION_CREDENTIALS` apunta a la ruta correcta
- [ ] Systemd service corre como usuario `finance-api`
- [ ] Firebase Admin SDK se inicializa sin errores
- [ ] Backend puede leer datos de Realtime Database
- [ ] No hay hardcoding de credenciales en código

---

## REFERENCIA RÁPIDA

```bash
# Verificar todo de una vez:
echo "=== Firebase Setup Verification ===" && \
echo "1. File exists:" && sudo test -f /etc/finance-family-api/firebase-service-account.json && echo "✓" || echo "✗" && \
echo "2. Permissions:" && sudo ls -l /etc/finance-family-api/firebase-service-account.json | awk '{print $1, $3, $4}' && \
echo "3. finance-api can read:" && sudo -u finance-api test -r /etc/finance-family-api/firebase-service-account.json && echo "✓" || echo "✗" && \
echo "4. Project ID:" && sudo cat /etc/finance-family-api/firebase-service-account.json | jq -r '.project_id' && \
echo "5. Environment configured:" && sudo test -f /etc/finance-family-api/finance-family-api.env && echo "✓" || echo "✗"
```

---

**Documento crítico para FASE 04D. Guardar para referencia.**

