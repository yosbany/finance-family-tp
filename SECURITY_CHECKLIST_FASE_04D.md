# SECURITY CHECKLIST - FASE 04D DEPLOYMENT

**Criticidad:** MÁXIMA  
**Responsabilidad:** Verificar ANTES de ir a producción

---

## 🔒 CREDENCIALES

### Firebase Service Account JSON

- [ ] Archivo NO está en .gitignore → añadir a .gitignore
- [ ] Archivo NO está en Git → `git log --all --name-status | grep firebase`
- [ ] Archivo NO aparece en logs de deployment
- [ ] Archivo almacenado en: `/etc/finance-family-api/firebase-service-account.json`
- [ ] Permisos: `640` (rw-r-----)
- [ ] Owner: `root:finance-api`
- [ ] Solo `finance-api` puede leer
- [ ] Otros usuarios NO pueden leer: `sudo -u nobody test -r /etc/finance-family-api/firebase-service-account.json` → FAIL
- [ ] Verificar integridad SHA256 antes/después de transfer

### Environment Variables

- [ ] `.env` NO está en Git
- [ ] `/etc/finance-family-api/finance-family-api.env` NO contiene secretos directamente
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` apunta a archivo (no a contenido)
- [ ] `NRD_LLM_API_KEY` NO configurado (FASE 05+)
- [ ] Variables NO imprimidas en logs

---

## 🔐 BACKEND SECURITY

### Firebase Admin SDK

- [ ] Usa `admin.credential.applicationDefault()` (respeta GOOGLE_APPLICATION_CREDENTIALS)
- [ ] **NO** hardcodea rutas de archivos
- [ ] **NO** imprime `private_key` en logs
- [ ] Inicialización falla gracefully si credenciales inválidas

### Authentication

- [ ] Todo endpoint `/api/*` valida Firebase ID Token
- [ ] `/health` es público (sin auth requerido)
- [ ] ID Token se valida contra Firebase Admin SDK
- [ ] UID se extrae de `decodedToken.uid` (no de request body)

### Authorization

- [ ] Usuario solo puede acceder a su propio `/users/{uid}/transactions`
- [ ] **NO** se puede cambiar UID vía parámetro
- [ ] **NO** se pueden inyectar UIDs ajenos
- [ ] Validación: `decodedToken.uid === requestedUid` es obligatoria

### Input Validation

```javascript
// ✓ CORRECTO
const { limit, startDate, endDate } = req.body;
// Validar que solo estas propiedades existen
// Rechazar: { uid: "other" }, { foo: "bar" }, etc

// ✗ INCORRECTO
const params = req.body;  // Aceptar cualquier parámetro
```

- [ ] Solo propiedades permitidas en request
- [ ] Parámetros unknowns → 400 Bad Request
- [ ] Limit máximo >= 100 (documentado)
- [ ] Dates validan formato ISO 8601

### Logging

- [ ] Logs NO contienen: `private_key`, `Authorization` header, `id_token`
- [ ] Logs NO contienen transacciones completas (user PII)
- [ ] Logs SÍ contienen: timestamp, endpoint, HTTP code, error messages (no sensitive)
- [ ] Revisar: `sudo journalctl -u finance-family-api | grep -i "private\|token\|authorization"`

---

## 🌐 CORS & NETWORK

### CORS Configuration

- [ ] `ALLOWED_ORIGINS=https://yosbany.github.io` (exacto)
- [ ] **NO** usar `Access-Control-Allow-Origin: *`
- [ ] `credentials: true` en backend (permite cookies)
- [ ] Métodos: `['GET', 'POST', 'OPTIONS']` (solo necesarios)
- [ ] Headers permitidos documentados

### Network Security

- [ ] Backend escucha **solo** en 127.0.0.1:8030 (NO 0.0.0.0)
- [ ] Acceso desde internet solo vía Nginx proxy HTTPS
- [ ] Firewall bloquea puerto 8030 desde exterior
- [ ] Verificar: `sudo ss -tlnp | grep 8030`
  - Expected: `127.0.0.1:8030 LISTEN`
  - NOT: `0.0.0.0:8030 LISTEN`

---

## 🔒 NGINX & HTTPS

### SSL/TLS

- [ ] Certificado válido para `service.nrdonline.site` exacto
- [ ] TLS 1.2+ solamente (`ssl_protocols TLSv1.2 TLSv1.3`)
- [ ] Ciphers fuertes configurados
- [ ] HSTS header presente: `Strict-Transport-Security: max-age=31536000`
- [ ] Auto-renewal de certificado configurado (Certbot)
- [ ] Certificado expira en ~90 días (verificar)

### HTTP/HTTPS Redirect

- [ ] HTTP (puerto 80) → HTTPS (443) redirect configurado
- [ ] **NO** servir contenido vía HTTP sin protección
- [ ] Certbot challenge en `/.well-known/acme-challenge/`

### Security Headers

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
add_header X-Content-Type-Options "nosniff";
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
```

- [ ] Headers presentes en respuesta
- [ ] Verificar: `curl -I https://service.nrdonline.site/health`

---

## 👤 USER & PERMISSIONS

### Service User

- [ ] Usuario `finance-api` existe: `id finance-api`
- [ ] Backend corre como `finance-api`: `ps aux | grep "node.*server.js"`
- [ ] NO corre como `root`
- [ ] NO corre como `nobody`

### File Permissions

```bash
# Backend files
-rw-r--r-- finance-api:finance-api /opt/finance-family-api/

# Firebase credentials
-rw-r----- root:finance-api /etc/finance-family-api/firebase-service-account.json

# Environment file
-rw-r----- root:finance-api /etc/finance-family-api/finance-family-api.env
```

- [ ] `/opt/finance-family-api/` propiedad de `finance-api`
- [ ] `/etc/finance-family-api/` archivos propiedad de `root:finance-api` con permisos 640
- [ ] Otros usuarios NO pueden leer credenciales

---

## 🚨 SYSTEMD SERVICE

- [ ] Servicio corre como usuario `finance-api` (no root)
- [ ] `EnvironmentFile` apunta a `/etc/finance-family-api/finance-family-api.env`
- [ ] `ExecStart` apunta a `/opt/finance-family-api/dist/server.js` (compilado, no TypeScript)
- [ ] `Restart=on-failure` configurado (reinicia automáticamente)
- [ ] `NoNewPrivileges=true` (previene escalation)
- [ ] `ProtectSystem=strict` (filesys read-only excepto WritePaths)
- [ ] `ReadWritePaths=/opt/finance-family-api` (solo necesario)

---

## 🔍 TESTING DE SEGURIDAD

### Authentication

```bash
# Test 1: Sin token → 401
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
# Esperado: 401 UNAUTHENTICATED

# Test 2: Token inválido → 401
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer invalid.token" \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'
# Esperado: 401 UNAUTHENTICATED

# Test 3: Token expirado → 401
# Usar token Firebase que ya expiró
# Esperado: 401 UNAUTHENTICATED
```

- [ ] Todos los tests devuelven 401

### Authorization

```bash
TOKEN_USER_A="<token-de-usuario-A>"
TOKEN_USER_B="<token-de-usuario-B>"

# Test: Usuario A intenta acceder a datos de Usuario B
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN_USER_A" \
  -H "Content-Type: application/json" \
  -d '{"uid": "<uid-de-usuario-B>", "limit": 5}'
# Esperado: 400 Bad Request o 403 Forbidden
```

- [ ] Acceso cruzado RECHAZADO

### Injection Attacks

```bash
TOKEN="<valid-firebase-token>"

# Test 1: UID injection
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uid": "../../../etc/passwd", "limit": 5}'
# Esperado: 400 Bad Request

# Test 2: SQL injection (si aplica)
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": "5; DROP TABLE users;", ...}'
# Esperado: 400 Bad Request

# Test 3: Unknown parameter
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"foo": "bar", "limit": 5}'
# Esperado: 400 Bad Request
```

- [ ] Todos los injections rechazados

### Limit Validation

```bash
# Test 1: Limit excesivo
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 999999}'
# Esperado: 400 Bad Request o limitado a máximo

# Test 2: Limit negativo
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": -5}'
# Esperado: 400 Bad Request
```

- [ ] Limits validados correctamente

### CORS

```bash
# Test: Origin no permitido
curl -X OPTIONS https://service.nrdonline.site/api/tools/search-transactions \
  -H "Origin: https://attacker.com" \
  -H "Access-Control-Request-Method: POST"
# Esperado: 200 OK pero SIN header "Access-Control-Allow-Origin"

# Test: Origin permitido
curl -X OPTIONS https://service.nrdonline.site/api/tools/search-transactions \
  -H "Origin: https://yosbany.github.io" \
  -H "Access-Control-Request-Method: POST"
# Esperado: 200 OK CON header "Access-Control-Allow-Origin: https://yosbany.github.io"
```

- [ ] CORS allow-list respetado
- [ ] NO usar `*`

---

## 📊 LOGS & MONITORING

### Sanitización de Logs

```bash
# Buscar datos sensibles
sudo journalctl -u finance-family-api | grep -E "private_key|Authorization|Bearer|token|secret"
# Esperado: (sin resultados)

# Buscar transacciones completas
sudo journalctl -u finance-family-api | grep -E "amount|description" | grep -v "^INFO"
# Esperado: (sin resultados) o solo debug messages controladas
```

- [ ] Logs NO contienen credenciales
- [ ] Logs NO contienen transacciones completas
- [ ] Logs contienen: timestamps, endpoints, HTTP codes, errores genéricos

### Monitoring

- [ ] Backend responde health checks cada 5-10 segundos
- [ ] Alertas configuradas para:
  - Service down
  - Error rate > 1%
  - Response time > 5s
  - Certificado expira en < 30 días

---

## ✅ FINAL CHECKLIST

Marcar TODO antes de considerar listo:

### Credenciales
- [ ] Firebase JSON no en Git
- [ ] Firebase JSON en /etc/ con permisos 640
- [ ] Environment .env no en Git
- [ ] No hay hardcoded secretos

### Backend
- [ ] Auth obligatorio para /api/*
- [ ] Auth bypass imposible
- [ ] UID injection imposible
- [ ] Input validation completa
- [ ] Logs sanitizados

### Network
- [ ] Backend en 127.0.0.1:8030 (no 0.0.0.0)
- [ ] Acceso externo solo vía Nginx HTTPS
- [ ] Firewall bloquea 8030
- [ ] CORS allow-list respetado

### Nginx
- [ ] HTTPS válido
- [ ] Security headers presentes
- [ ] HTTP→HTTPS redirect
- [ ] TLS 1.2+

### Runtime
- [ ] Service user: finance-api
- [ ] Service user: no root
- [ ] Systemd: Restart on failure
- [ ] Systemd: NoNewPrivileges=true

### Testing
- [ ] Auth tests pasan (401 sin token)
- [ ] Authorization tests pasan (no cross-access)
- [ ] Injection tests pasan (rechazados)
- [ ] CORS tests pasan (allow-list respected)

---

## 🎯 ANTES DE IR A PRODUCCIÓN

**TODOS los items marcados = GO**  
**Alguno sin marcar = STOP y corregir**

---

**Documento crítico. Revisar antes de cada deployment.**

