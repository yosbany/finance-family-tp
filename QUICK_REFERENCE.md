# QUICK REFERENCE - FASE 04D

## 🚀 DEPLOYMENT (3 COMMANDS)

```bash
# 1. Get credentials
# Firebase Console → finance-family-tp → Settings → Service Accounts

# 2. Deploy
cd ~/Documents/finance-family/server
./deploy-backend.sh openclaw-vps-root ~/firebase-service-account.json

# 3. Test
curl https://service.nrdonline.site/health
```

---

## 📋 DOCUMENTATION MAP

| Need | Document |
|------|----------|
| Quick start | `DEPLOYMENT_READY.md` |
| Full guide | `DEPLOYMENT_PLAN_FASE_04D.md` |
| Firebase setup | `FIREBASE_DEPLOYMENT_GUIDE.md` |
| Nginx/HTTPS | `NGINX_HTTPS_GUIDE.md` |
| Security | `SECURITY_CHECKLIST_FASE_04D.md` |

---

## 🎯 TESTS

```bash
# Health check
curl https://service.nrdonline.site/health

# With script
cd server
./test-deployment.sh https://service.nrdonline.site $FIREBASE_ID_TOKEN
```

---

## 🔍 TROUBLESHOOTING

```bash
# Backend logs (in VPS)
sudo journalctl -u finance-family-api -f

# Check if running
sudo systemctl status finance-family-api

# Restart
sudo systemctl restart finance-family-api

# Nginx test
sudo nginx -t

# View health internally
curl http://127.0.0.1:8030/health
```

---

## ✅ CLOSE CRITERIA

```
✓ GET https://service.nrdonline.site/health → 200
✓ POST with valid Firebase token → 200 + data
✓ E2E: Frontend → Backend → Firebase
```

---

## 📞 KEY CONTACTS/RESOURCES

- VPS: openclaw-vps-root
- Domain: service.nrdonline.site
- Backend port: 8030 (internal), 443 (external HTTPS)
- Firebase project: finance-family-tp

