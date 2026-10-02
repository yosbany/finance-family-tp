# Finance Family API - Production Deployment Guide

## Overview

This deployment uses:
- **Runtime**: Node.js 20
- **Process Manager**: systemd
- **Web Server**: Nginx
- **Port**: 8030 (internal)
- **Domain**: service.nrdonline.site
- **Security**: Let's Encrypt HTTPS

## Prerequisites

### Local Machine
- Node.js 20+
- npm
- Access to VPS SSH
- Firebase service account JSON file

### VPS (Ubuntu 22.04.5 LTS)
- Nginx installed and running
- Let's Encrypt certificates for `service.nrdonline.site`
- SSH root access
- Port 8030 available
- Node.js 20+ installed

## Step-by-Step Deployment

### Phase 1: Prepare Firebase Credentials

1. **Obtain service account JSON** from Firebase Console
   - Go to Firebase Console → Project Settings → Service Accounts
   - Generate new private key
   - Save as `firebase-service-account.json`

2. **IMPORTANT Security Requirements**:
   - Never commit to git
   - Never display content
   - Never include in documentation
   - Only store in protected system directory

### Phase 2: Local Preparation

```bash
# From repository root
cd deployment

# Prepare backend archive
bash 00-prepare-local.sh
```

This will:
- Build the TypeScript backend
- Create optimized production archive
- Verify all required files

Output: `deployment/finance-family-backend.tar.gz`

### Phase 3: Upload to VPS

```bash
# Upload backend archive
scp deployment/finance-family-backend.tar.gz root@179.43.124.107:/tmp/

# Upload deployment scripts
scp deployment/01-deploy.sh root@179.43.124.107:/tmp/
scp deployment/service.nrdonline.site.nginx root@179.43.124.107:/tmp/

# Upload Firebase credentials (CRITICAL)
scp firebase-service-account.json root@179.43.124.107:/tmp/
```

### Phase 4: Execute Deployment on VPS

```bash
# SSH into VPS
ssh root@179.43.124.107

# Run deployment script
sudo bash /tmp/01-deploy.sh /tmp/finance-family-backend.tar.gz
```

This creates:
- `/etc/finance-family-api/` - Configuration directory
- `/opt/finance-family-api/` - Application directory
- `/etc/systemd/system/finance-family-api.service` - Service file

### Phase 5: Install Firebase Credentials

```bash
# On VPS
sudo cp /tmp/firebase-service-account.json /etc/finance-family-api/
sudo chown root:root /etc/finance-family-api/firebase-service-account.json
sudo chmod 600 /etc/finance-family-api/firebase-service-account.json

# Verify (safe to show without sensitive content)
sudo ls -la /etc/finance-family-api/
```

### Phase 6: Verify Configuration

```bash
# Check environment file
sudo cat /etc/finance-family-api/finance-family-api.env

# Verify Firebase credentials are valid
sudo jq '.project_id, .type' /etc/finance-family-api/firebase-service-account.json

# Expected output: "finance-family-tp" and "service_account"
```

### Phase 7: Start Service

```bash
# Enable auto-start on reboot
sudo systemctl enable finance-family-api

# Start the service
sudo systemctl start finance-family-api

# Check status
sudo systemctl status finance-family-api

# View logs
sudo journalctl -u finance-family-api -f
```

### Phase 8: Test Local Health

```bash
# On VPS - test internal endpoint
curl http://127.0.0.1:8030/health

# Expected: HTTP 200 with {"status":"ok"} or similar
```

If this fails:
- Check logs: `sudo journalctl -u finance-family-api -n 50`
- Verify configuration: `sudo cat /etc/finance-family-api/finance-family-api.env`
- Verify Firebase JSON: `sudo file /etc/finance-family-api/firebase-service-account.json`

### Phase 9: Setup Nginx

```bash
# On VPS - copy Nginx configuration
sudo cp /tmp/service.nrdonline.site.nginx /etc/nginx/sites-available/service.nrdonline.site

# Create symlink to enable
sudo ln -sf /etc/nginx/sites-available/service.nrdonline.site /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload if valid
sudo systemctl reload nginx
```

### Phase 10: Test HTTPS Endpoint

```bash
# From local machine
curl https://service.nrdonline.site/health

# Expected: HTTP 200
```

### Phase 11: Authentication Testing

#### Test 1: No Token
```bash
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Expected: HTTP 401 (UNAUTHENTICATED)
```

#### Test 2: Invalid Token
```bash
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer invalid_token_xyz" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Expected: HTTP 401 (UNAUTHENTICATED)
```

#### Test 3: Valid Token
```bash
# Get ID token from Firebase (requires authentication)
# Then:
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer YOUR_VALID_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Expected: HTTP 200 (authenticated, may have no transactions)
```

### Phase 12: Security Testing

#### UID Injection
```bash
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer fake_token" \
  -H "Content-Type: application/json" \
  -d '{"uid": "other_user"}'

# Expected: HTTP 401 (rejected before processing)
```

#### Path Injection
```bash
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer fake_token" \
  -H "Content-Type: application/json" \
  -d '{"firebasePath": "/users/other"}'

# Expected: HTTP 401 (rejected before processing)
```

#### Limit Validation
```bash
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10000}'

# Expected: HTTP 400 (limit too high) or HTTP 200 with capped limit
```

## Monitoring & Maintenance

### Check Service Status
```bash
sudo systemctl status finance-family-api
```

### View Logs (Last 50 lines)
```bash
sudo journalctl -u finance-family-api -n 50
```

### Follow Logs (Real-time)
```bash
sudo journalctl -u finance-family-api -f
```

### Restart Service
```bash
sudo systemctl restart finance-family-api
```

### Check Nginx Proxy Status
```bash
sudo journalctl -u nginx -n 50
```

### Verify Process is Running
```bash
ps aux | grep "node dist/server.js"
```

### Check Port Binding
```bash
sudo netstat -tlnp | grep 8030
```

## Troubleshooting

### Service won't start
```bash
# 1. Check logs
sudo journalctl -u finance-family-api -n 100

# 2. Verify Firebase credentials
sudo jq empty /etc/finance-family-api/firebase-service-account.json

# 3. Test environment manually
sudo -u finance-api bash
source /etc/finance-family-api/finance-family-api.env
echo $FIREBASE_PROJECT_ID
```

### Health check returns 500
```bash
# Check Firebase connection
sudo journalctl -u finance-family-api | grep -i firebase

# Verify credentials file permissions
sudo ls -la /etc/finance-family-api/firebase-service-account.json
# Should show: -rw------- 1 root root
```

### Nginx returns 502 Bad Gateway
```bash
# Verify backend is running
sudo systemctl status finance-family-api

# Check if port 8030 is listening
sudo netstat -tlnp | grep 8030

# Test local connection
curl http://127.0.0.1:8030/health
```

### CORS errors
```bash
# Update allowed origins in:
sudo nano /etc/finance-family-api/finance-family-api.env
# Then restart:
sudo systemctl restart finance-family-api
```

## Frontend Integration

### Update Frontend Config
```typescript
// .env or environment config
VITE_FINANCE_API_URL=https://service.nrdonline.site
```

### Usage in Frontend
```typescript
// Use in API calls
const apiUrl = import.meta.env.VITE_FINANCE_API_URL || 'http://localhost:3001';
const response = await fetch(`${apiUrl}/api/tools/search-transactions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(filters)
});
```

## Security Best Practices

1. **Firebase Credentials**
   - Store only in `/etc/finance-family-api/`
   - Permissions: `600` (root-only readable)
   - Never print in logs or documentation

2. **Environment Variables**
   - Sensitive values in `/etc/finance-family-api/finance-family-api.env`
   - File permissions: `600`
   - Sourced by systemd service only

3. **Logs**
   - No secrets in systemd/journalctl output
   - Sensitive values never logged
   - Log retention: 14 days (configured in logrotate)

4. **HTTPS**
   - All traffic over HTTPS (Let's Encrypt)
   - HTTP redirects to HTTPS
   - HSTS header enabled

5. **Firewall**
   - Only ports 80, 443 exposed
   - Internal port 8030 not accessible from outside
   - VPS firewall restricts SSH access if possible

## Performance Tuning

### Connection Limits
Edit `/etc/finance-family-api/finance-family-api.env`:
```bash
# Current limits (conservative)
# Adjust based on load testing
```

### Nginx Upstream
Edit `/etc/nginx/sites-available/service.nrdonline.site`:
```nginx
upstream finance_api {
    # Add multiple backend servers for load balancing
    # server 127.0.0.1:8030;
    # server 127.0.0.1:8031;  # Future: multiple processes
}
```

## Rollback Procedure

If deployment fails:

```bash
# 1. Stop the service
sudo systemctl stop finance-family-api

# 2. Restore previous version (if backup exists)
sudo rm -rf /opt/finance-family-api/*
sudo tar -xzf /backups/finance-family-backend-$(date -d "1 day ago" +%Y-%m-%d).tar.gz \
  -C /opt/finance-family-api/

# 3. Restart
sudo systemctl start finance-family-api

# 4. Verify
sudo systemctl status finance-family-api
```

## Deployment Checklist

- [ ] Firebase credentials copied and verified
- [ ] Service user created (finance-api)
- [ ] Directories created with correct permissions
- [ ] Application deployed to `/opt/finance-family-api`
- [ ] Configuration file created at `/etc/finance-family-api/finance-family-api.env`
- [ ] systemd service installed and enabled
- [ ] Internal health check passes (127.0.0.1:8030/health)
- [ ] Nginx vhost created and tested
- [ ] HTTPS certificates valid
- [ ] External health check passes (https://service.nrdonline.site/health)
- [ ] Authentication tests pass (401 without token)
- [ ] Security tests pass (injection attempts rejected)
- [ ] End-to-end test passes (Firebase auth → API → Database)
- [ ] Logs verified (no secrets exposed)
- [ ] Monitoring and alerting configured

## Support

For issues, check:
1. Service logs: `sudo journalctl -u finance-family-api -n 100`
2. Nginx logs: `sudo tail -f /var/log/nginx/finance-family-api-error.log`
3. Firebase console for authentication issues
4. VPS firewall rules

---

**Last Updated**: October 2, 2026
**Backend Version**: 1.0.0
**Node.js Version**: 20 LTS
**Ubuntu Version**: 22.04.5 LTS
