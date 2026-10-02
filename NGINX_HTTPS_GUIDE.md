# Nginx + HTTPS - Deployment Guide

## OBJETIVO

Configurar Nginx como reverse proxy para `service.nrdonline.site`:

```
https://service.nrdonline.site/
  ↓ (Nginx reverse proxy)
http://127.0.0.1:8030 (Backend)
```

---

## PASO 1: Verificar Nginx

```bash
# En VPS:

# ¿Nginx instalado?
nginx -v
# Esperado: nginx version: nginx/1.x.x

# ¿Nginx corriendo?
sudo systemctl status nginx
# Esperado: active (running)

# ¿Nginx puede escuchar?
sudo ss -tlnp | grep nginx
# Esperado: 0.0.0.0:80 y 0.0.0.0:443

# Validar configuración
sudo nginx -t
# Esperado: "test is successful"
```

---

## PASO 2: Crear Configuración del Proxy

Crear archivo de configuración de Nginx:

```bash
# En VPS, como root:

sudo cat > /etc/nginx/sites-available/service.nrdonline.site << 'EOF'
# Upstream backend
upstream finance_backend {
    server 127.0.0.1:8030;
    keepalive 32;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name service.nrdonline.site;

    # Certbot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name service.nrdonline.site;

    # SSL Certificate paths (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/service.nrdonline.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/service.nrdonline.site/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/service.nrdonline.site.access.log;
    error_log /var/log/nginx/service.nrdonline.site.error.log;

    # Limits
    client_max_body_size 10M;

    # Health check endpoint (public)
    location /health {
        proxy_pass http://finance_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        access_log off;
    }

    # API endpoints
    location /api {
        proxy_pass http://finance_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
    }

    # Deny everything else
    location / {
        return 404;
    }
}
EOF
```

---

## PASO 3: Activar el Virtual Host

```bash
# En VPS, como root:

# 1. Crear symbolic link (si no está ya en sites-enabled)
sudo ln -sf /etc/nginx/sites-available/service.nrdonline.site \
            /etc/nginx/sites-enabled/service.nrdonline.site

# 2. Verificar sintaxis (IMPORTANTE - siempre antes de reload)
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# 3. Recargar Nginx
sudo systemctl reload nginx

# 4. Verificar que está activo
sudo systemctl status nginx
```

---

## PASO 4: Configurar HTTPS con Certbot

### Opción A: Certbot ya configurado en VPS

```bash
# En VPS:

# Si Certbot ya existe y maneja otros dominios:
sudo certbot certonly --nginx -d service.nrdonline.site

# Responder preguntas:
# - Email: tu-email@example.com
# - Agree to terms: Y
# - Share email: N (opcional)

# El certificado se creará en:
# /etc/letsencrypt/live/service.nrdonline.site/
```

### Opción B: Certbot no instalado

```bash
# En Ubuntu 22.04:
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Luego ejecutar:
sudo certbot certonly --nginx -d service.nrdonline.site
```

### Opción C: Usar certificado existente

Si ya hay un certificado wildcard o para el dominio:

```bash
# Verificar certificados existentes
sudo certbot certificates

# Si existe, solo refrescar:
sudo certbot renew --dry-run
```

---

## PASO 5: Configurar Auto-Renewal

```bash
# En VPS:

# 1. Habilitar servicio de renovación
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 2. Verificar que está activo
sudo systemctl status certbot.timer

# 3. Test de renewals (simular)
sudo certbot renew --dry-run

# Expected output:
# Account registered.
# Simulating renewal of an existing certificate...
# The dry run was successful.
```

---

## PASO 6: Verificar Certificado

```bash
# En VPS:

# Ver detalles del certificado
sudo certbot certificates

# Output esperado:
# Certificate Name: service.nrdonline.site
#   Domains: service.nrdonline.site
#   Expiry Date: YYYY-MM-DD (dentro de ~90 días)

# Verificar con OpenSSL
openssl s_client -connect service.nrdonline.site:443 -servername service.nrdonline.site

# Press CTRL+C después de ver los detalles
```

---

## PASO 7: Test Externo

```bash
# DESDE TU MÁQUINA LOCAL (no desde el VPS):

# Test 1: Health check HTTPS
curl -v https://service.nrdonline.site/health

# Esperado:
# * Connected to service.nrdonline.site
# * SSL certificate verify ok.
# HTTP/2 200

# Test 2: Certificado válido
curl -I https://service.nrdonline.site/health

# Esperado:
# HTTP/2 200
# Strict-Transport-Security: max-age=31536000
```

---

## PASO 8: Verificar Proxy Funciona

```bash
# En VPS:

# Test 1: Backend responde internamente
curl http://127.0.0.1:8030/health

# Esperado:
# {"status":"ok","timestamp":1234567890}

# Test 2: Nginx recibe la petición
curl -i http://127.0.0.1/health

# Esperado:
# HTTP/1.1 200 OK

# Test 3: Ver logs de Nginx
sudo tail -f /var/log/nginx/service.nrdonline.site.access.log

# Expected (mientras haces requests):
# 127.0.0.1 - - [02/Oct/2026:...] "GET /health HTTP/1.1" 200 45
```

---

## PASO 9: Verificar no Otros Vhosts están Afectados

```bash
# En VPS:

# Listar todos los vhosts activos
sudo ls -1 /etc/nginx/sites-enabled/

# Debe incluir:
# - service.nrdonline.site ✓ (nuevo)
# - model.nrdonline.site (existente - NO modificar)
# - erp.nrdonline.site (existente - NO modificar)
# - api.nrdonline.site (existente - NO modificar)

# Test 1: Cada dominio sigue funcionando
curl -I https://model.nrdonline.site/
curl -I https://erp.nrdonline.site/
curl -I https://api.nrdonline.site/

# Todos deben devolver HTTP 200 o similar (no 404)
```

---

## PASO 10: Logs de Debugging

```bash
# Ver acceso actual
sudo tail -f /var/log/nginx/service.nrdonline.site.access.log

# Ver errores
sudo tail -f /var/log/nginx/service.nrdonline.site.error.log

# Ver todo de systemd
sudo journalctl -u nginx -f

# Buscar errores de SSL
sudo grep -i ssl /var/log/nginx/service.nrdonline.site.error.log
```

---

## TROUBLESHOOTING

### Error: SSL certificate not found

```
SSL_ERROR_BAD_CERT_DOMAIN
```

**Solución:**
```bash
# Verificar que Certbot creó el certificado
sudo ls -la /etc/letsencrypt/live/service.nrdonline.site/

# Debe haber:
# - fullchain.pem
# - privkey.pem
# - cert.pem

# Si no existen, generar:
sudo certbot certonly --nginx -d service.nrdonline.site
```

### Error: Nginx won't reload

```
nginx: [error] invalid PID number ""
```

**Solución:**
```bash
# Reiniciar Nginx (no solo reload)
sudo systemctl restart nginx

# Si sigue fallando, verificar configuración
sudo nginx -t

# Ver qué está mal
sudo nginx -T
```

### Error: 502 Bad Gateway

```
502 Bad Gateway
```

**Significa:** Backend no está respondiendo

**Solución:**
```bash
# 1. Verificar backend está corriendo
sudo systemctl status finance-family-api

# 2. Verificar puerto 8030
sudo ss -tlnp | grep 8030

# 3. Test local
curl http://127.0.0.1:8030/health

# 4. Revisar logs del backend
sudo journalctl -u finance-family-api -n 50
```

### Error: 404 Not Found

```
404 Not Found
```

**Significa:** Ruta no existe en backend

**Solución:**
```bash
# Verificar que el endpoint existe en backend
# El backend solo expone:
# - GET /health
# - POST /api/tools/search-transactions

# ¿Intentas acceder a otra ruta?
# Nginx devuelve 404 (configurado en location /)

# Ver logs
sudo tail -f /var/log/nginx/service.nrdonline.site.access.log
```

### Error: Too many redirects

```
ERR_TOO_MANY_REDIRECTS
```

**Significa:** HTTP → HTTPS → HTTP → ... bucle infinito

**Solución:**
```bash
# Verificar que X-Forwarded-Proto se pasa correctamente
sudo grep -A 5 "X-Forwarded-Proto" /etc/nginx/sites-enabled/service.nrdonline.site

# Backend debe usar este header para determinar protocolo
# En Fastify con CORS, esto se maneja automáticamente

# Restart:
sudo systemctl restart nginx
```

---

## REFERENCIA RÁPIDA

```bash
# Verificar todo de una vez:
echo "=== Nginx Setup Verification ===" && \
echo "1. Nginx version:" && nginx -v && \
echo "2. Config valid:" && sudo nginx -t && \
echo "3. Backend responds:" && curl -s http://127.0.0.1:8030/health | jq '.' && \
echo "4. Certificate valid:" && sudo certbot certificates && \
echo "5. HTTPS working:" && curl -I https://service.nrdonline.site/health
```

---

## CHECKLIST PRE-PRODUCCIÓN

- [ ] Nginx instalado y corriendo
- [ ] Virtual host configurado en /etc/nginx/sites-available/
- [ ] Symbolic link en /etc/nginx/sites-enabled/
- [ ] `nginx -t` válido
- [ ] Backend escuchando en 127.0.0.1:8030
- [ ] Certificado HTTPS obtenido vía Certbot
- [ ] SSL configurado en Nginx
- [ ] Health check HTTP 200 internamente
- [ ] Health check HTTPS 200 externamente
- [ ] Otros vhosts no afectados
- [ ] Logs de acceso funcionan
- [ ] Certbot auto-renewal configurado
- [ ] Firewall permite 80 y 443

---

**Documento crítico para FASE 04D. Guardar para referencia.**

