# VPS Deployment Guide

This guide covers deploying Finance Family Backend to a real VPS.

## Prerequisites

- VPS with SSH access (root or sudo user)
- Domain `service.nrdonline.site` configured in DNS
- Existing reverse proxy infrastructure (Nginx, Caddy, or other)
- Firebase service account credentials
- Node.js 20+ installed on VPS

## Deployment Checklist

- [ ] Inspect VPS infrastructure (OS, Docker, ports, reverse proxy)
- [ ] Configure DNS for `service.nrdonline.site`
- [ ] Set up Firebase credentials securely
- [ ] Deploy backend code
- [ ] Configure reverse proxy
- [ ] Set up SSL/TLS certificate
- [ ] Test health check
- [ ] Test authenticated endpoints
- [ ] Set up monitoring
- [ ] Configure auto-restart

## Phase 1: VPS Inspection

### SSH into VPS

```bash
ssh user@your-vps-ip
```

### Check OS

```bash
lsb_release -a
# or
cat /etc/os-release
```

### Check Docker

```bash
docker --version
docker-compose --version
```

### Check Installed Services

```bash
ps aux | grep -E 'nginx|caddy|apache|node'
```

### Check Used Ports

```bash
sudo netstat -tulpn
# or
sudo ss -tulpn
```

### Check Existing Reverse Proxy

```bash
# Nginx
sudo nginx -t
sudo systemctl status nginx

# Caddy
sudo systemctl status caddy
caddy list-modules

# Apache
sudo apache2ctl -t
sudo systemctl status apache2
```

## Phase 2: DNS Configuration

### Verify DNS

```bash
nslookup service.nrdonline.site
# or
dig service.nrdonline.site
```

### Expected Output

```
service.nrdonline.site  A  192.0.2.1  (your VPS IP)
```

If DNS is not configured:

1. Go to your domain registrar
2. Create A record: `service.nrdonline.site` → `YOUR_VPS_IP`
3. Wait 5-60 minutes for propagation

## Phase 3: Firebase Credentials

### Get Service Account

1. Go to Firebase Console
2. Project Settings → Service Accounts
3. Download JSON file

### Secure Storage on VPS

```bash
# On your local machine
scp service-account.json user@vps:/tmp/

# On VPS
sudo mkdir -p /etc/finance-family/secrets
sudo mv /tmp/service-account.json /etc/finance-family/secrets/
sudo chmod 600 /etc/finance-family/secrets/service-account.json
sudo chown 1001:1001 /etc/finance-family/secrets/service-account.json
```

## Phase 4: Deploy Backend

### Option A: Docker Compose (Recommended)

#### 1. Clone or upload code

```bash
# Via Git
git clone https://github.com/yosbany/finance-family-tp.git /opt/finance-family
cd /opt/finance-family/server

# Or upload directory
scp -r ./server user@vps:/opt/finance-family/
```

#### 2. Create .env file

```bash
cat > /opt/finance-family/server/.env << EOF
NODE_ENV=production
PORT=3001
FIREBASE_PROJECT_ID=finance-family-tp
FIREBASE_DATABASE_URL=https://finance-family-tp.firebaseio.com
ALLOWED_ORIGINS=https://yosbany.github.io
GOOGLE_APPLICATION_CREDENTIALS=/etc/finance-family/secrets/service-account.json
EOF
```

#### 3. Start with Docker Compose

```bash
cd /opt/finance-family/server

# Build image
docker-compose build

# Start service
docker-compose up -d

# Check logs
docker-compose logs -f api
```

#### 4. Verify running

```bash
curl http://127.0.0.1:3001/health
```

### Option B: Manual Installation

#### 1. Install Node.js (if not present)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Upload and install code

```bash
# Upload
scp -r ./server user@vps:/opt/finance-family/server

# Install dependencies
cd /opt/finance-family/server
npm install --production
npm run build
```

#### 3. Create systemd service

```bash
sudo cat > /etc/systemd/system/finance-backend.service << EOF
[Unit]
Description=Finance Family Backend API
After=network.target

[Service]
Type=simple
User=nodeapp
WorkingDirectory=/opt/finance-family/server
ExecStart=/usr/bin/node dist/server.js

Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="FIREBASE_PROJECT_ID=finance-family-tp"
Environment="FIREBASE_DATABASE_URL=https://finance-family-tp.firebaseio.com"
Environment="ALLOWED_ORIGINS=https://yosbany.github.io"
Environment="GOOGLE_APPLICATION_CREDENTIALS=/etc/finance-family/secrets/service-account.json"

Restart=on-failure
RestartSec=10

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/finance-family/server

[Install]
WantedBy=multi-user.target
EOF
```

#### 4. Create nodeapp user

```bash
sudo useradd -r -s /bin/bash nodeapp
sudo chown -R nodeapp:nodeapp /opt/finance-family/server
```

#### 5. Enable and start service

```bash
sudo systemctl daemon-reload
sudo systemctl enable finance-backend
sudo systemctl start finance-backend

# Check status
sudo systemctl status finance-backend

# View logs
sudo journalctl -u finance-backend -f
```

## Phase 5: Reverse Proxy Configuration

### For Nginx

#### 1. Create upstream

```nginx
upstream finance_backend {
    server 127.0.0.1:3001;
}
```

#### 2. Create server block

```nginx
server {
    listen 443 ssl http2;
    server_name service.nrdonline.site;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Limits
    client_max_body_size 10M;

    # Health check (public)
    location /health {
        proxy_pass http://finance_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        access_log off;
    }

    # API endpoints (protected by our auth)
    location /api {
        proxy_pass http://finance_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

#### 3. Test and reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### For Caddy

#### 1. Edit Caddyfile

```caddyfile
service.nrdonline.site {
    encode gzip

    # Health check
    @health path /health
    handle @health {
        reverse_proxy 127.0.0.1:3001
    }

    # API endpoints
    @api path /api*
    handle @api {
        reverse_proxy 127.0.0.1:3001
    }

    # Deny everything else
    respond "Not Found" 404
}
```

#### 2. Reload

```bash
sudo caddy reload
```

## Phase 6: SSL/TLS Certificate

### Using Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d service.nrdonline.site

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Caddy (automatic)

Caddy automatically manages Let's Encrypt certificates. Just add the domain to Caddyfile.

## Phase 7: Verification

### Test Health Endpoint

```bash
curl https://service.nrdonline.site/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": 1696262400000
}
```

### Test from Outside VPS

```bash
# Test without auth (should fail)
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Expected: 401 UNAUTHENTICATED
```

### Test with Valid Token

Get a Firebase ID Token and test:

```bash
TOKEN="<valid-firebase-id-token>"

curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Expected: 200 with transactions
```

## Phase 8: Monitoring and Logging

### Check Backend Logs

#### Docker Compose

```bash
docker-compose logs -f api
```

#### Systemd

```bash
sudo journalctl -u finance-backend -f
```

### Monitor Health

```bash
# Continuous monitoring
watch -n 5 'curl -s https://service.nrdonline.site/health | jq'
```

### Reverse Proxy Logs

```bash
# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Caddy
sudo tail -f /var/log/caddy/caddy.log
```

## Phase 9: Auto-Restart Configuration

### Docker Compose

Already configured in `docker-compose.yml`:

```yaml
restart: unless-stopped
```

### Systemd

Already configured in service file:

```ini
Restart=on-failure
RestartSec=10
```

### Manual Monitoring

```bash
# Check every 5 minutes
*/5 * * * * /usr/local/bin/check-finance-backend.sh
```

Create `/usr/local/bin/check-finance-backend.sh`:

```bash
#!/bin/bash
if ! curl -s http://127.0.0.1:3001/health > /dev/null; then
    systemctl restart finance-backend
    echo "Finance backend restarted at $(date)" | mail -s "Backend restart" admin@example.com
fi
```

## Phase 10: Firewall Configuration

### UFW (Ubuntu)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP (for redirect)
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Deny direct backend access
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable firewall
sudo ufw enable
```

### iptables (Manual)

```bash
# Allow only loopback to backend port
sudo iptables -A INPUT -p tcp --dport 3001 -s 127.0.0.1 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3001 -j DROP
```

## Troubleshooting

### Backend won't start

Check logs:

```bash
# Docker
docker-compose logs api

# Systemd
sudo journalctl -u finance-backend -n 50
```

Common issues:

- `GOOGLE_APPLICATION_CREDENTIALS not found`: Wrong path to service account file
- `EADDRINUSE: Port 3001 in use`: Another process using port
- `Firebase initialization failed`: Invalid credentials or project ID

### DNS not resolving

```bash
nslookup service.nrdonline.site
dig service.nrdonline.site +short

# If not resolving, check domain registrar DNS settings
```

### HTTPS not working

```bash
# Check certificate
sudo certbot certificates

# Check Nginx SSL config
sudo openssl s_client -connect localhost:443 -servername service.nrdonline.site

# Check Caddy
sudo caddy list-certs
```

### Backend can't access Firebase

```bash
# Test Firebase connection
curl -H "Authorization: Bearer $(node -e 'console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS)')" \
  https://your-project.firebaseio.com/
```

## Maintenance

### Updates

```bash
# Update backend code
cd /opt/finance-family/server
git pull
npm install --production
npm run build

# Restart
docker-compose restart api
# or
sudo systemctl restart finance-backend
```

### Backups

Credentials backup is NOT recommended. Keep only in vault.

Database backups should be done via Firebase Console.

### Monitoring

Set up monitoring for:

- Service health (uptime)
- Response times
- Error rates
- Database performance
- Certificate expiration

## Success Criteria

After deployment:

- [ ] `curl https://service.nrdonline.site/health` returns 200
- [ ] Frontend can authenticate and make requests
- [ ] Backend logs show successful token verification
- [ ] Reverse proxy logs show requests reaching backend
- [ ] SSL certificate is valid
- [ ] Service auto-restarts after crash
- [ ] No sensitive data in logs
- [ ] Service survives VPS reboot

## Next Steps

After successful deployment:

1. Update frontend `VITE_FINANCE_API_URL` if needed
2. Monitor logs for issues
3. Set up alerting
4. Begin FASE 05 (LLM integration)
5. Plan FASE 06 (additional finance tools)

## Support

If deployment fails, provide:

1. VPS OS and version
2. Error messages from backend logs
3. Reverse proxy configuration
4. DNS resolution results
5. Firewall rules in place

---

Made with ❤️
