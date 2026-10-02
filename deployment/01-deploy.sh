#!/bin/bash
set -e

# Finance Family API - Production Deployment Script
# Execute as: sudo bash 01-deploy.sh /path/to/finance-family-api.tar.gz
# 
# This script:
# 1. Creates required directories
# 2. Deploys the backend
# 3. Creates systemd service
# 4. Creates configuration files
# 5. Sets up user/permissions

echo "🚀 Finance Family API - Deployment Script"
echo "==========================================="

# Verify root
if [ "$EUID" -ne 0 ]; then
  echo "❌ This script must be run as root (use sudo)"
  exit 1
fi

# Verify arguments
if [ $# -lt 1 ]; then
  echo "❌ Usage: sudo bash 01-deploy.sh /path/to/backend-dist.tar.gz"
  echo ""
  echo "Steps to prepare:"
  echo "1. On local machine:"
  echo "   cd server && npm run build"
  echo "   tar -czf finance-family-backend.tar.gz dist node_modules package.json package-lock.json"
  echo "   scp finance-family-backend.tar.gz root@179.43.124.107:/tmp/"
  echo ""
  echo "2. On VPS:"
  echo "   sudo bash 01-deploy.sh /tmp/finance-family-backend.tar.gz"
  exit 1
fi

ARCHIVE="$1"

# Verify archive exists
if [ ! -f "$ARCHIVE" ]; then
  echo "❌ Archive not found: $ARCHIVE"
  exit 1
fi

echo ""
echo "📦 Archive: $ARCHIVE"
echo ""

# Step 1: Create directories
echo "📁 Creating directories..."
mkdir -p /etc/finance-family-api
mkdir -p /opt/finance-family-api
mkdir -p /var/log/finance-family-api

# Step 2: Create service user (if not exists)
echo "👤 Creating service user..."
id -u finance-api &>/dev/null || useradd -r -s /bin/false -d /opt/finance-family-api finance-api

# Step 3: Extract backend
echo "📦 Extracting backend..."
tar -xzf "$ARCHIVE" -C /opt/finance-family-api/

# Step 4: Set permissions
echo "🔐 Setting permissions..."
chown -R root:root /opt/finance-family-api
chmod 755 /opt/finance-family-api
chmod 755 /opt/finance-family-api/dist
chmod 644 /opt/finance-family-api/dist/*.js
chmod 644 /opt/finance-family-api/dist/*.js.map
find /opt/finance-family-api/node_modules -type f -exec chmod 644 {} \;
find /opt/finance-family-api/node_modules -type d -exec chmod 755 {} \;

# Step 5: Create configuration file
echo "⚙️  Creating configuration file..."
if [ ! -f /etc/finance-family-api/finance-family-api.env ]; then
  cat > /etc/finance-family-api/finance-family-api.env << 'EOF'
NODE_ENV=production
PORT=8030
FIREBASE_PROJECT_ID=finance-family-tp
FIREBASE_DATABASE_URL=https://finance-family-tp.firebaseio.com
GOOGLE_APPLICATION_CREDENTIALS=/etc/finance-family-api/firebase-service-account.json
ALLOWED_ORIGINS=https://yosbany.github.io
EOF
  chmod 600 /etc/finance-family-api/finance-family-api.env
  chown root:root /etc/finance-family-api/finance-family-api.env
  echo "   ✅ Created: /etc/finance-family-api/finance-family-api.env"
else
  echo "   ⚠️  Already exists: /etc/finance-family-api/finance-family-api.env"
fi

# Step 6: Check Firebase credentials
echo ""
echo "🔑 Firebase credentials verification..."
if [ ! -f /etc/finance-family-api/firebase-service-account.json ]; then
  echo "   ❌ CRITICAL: Firebase service account JSON not found!"
  echo "   ⚠️  Please copy the JSON file manually:"
  echo "      scp firebase-service-account.json root@179.43.124.107:/etc/finance-family-api/"
  echo "   Then run: sudo chown root:root /etc/finance-family-api/firebase-service-account.json"
  echo "             sudo chmod 600 /etc/finance-family-api/firebase-service-account.json"
else
  echo "   ✅ Firebase credentials found"
  # Verify it's valid JSON
  if jq empty /etc/finance-family-api/firebase-service-account.json 2>/dev/null; then
    PROJECT_ID=$(jq -r '.project_id' /etc/finance-family-api/firebase-service-account.json)
    echo "   ✅ Project ID: $PROJECT_ID"
  else
    echo "   ❌ Invalid JSON format in firebase-service-account.json"
    exit 1
  fi
fi

# Step 7: Create systemd service
echo ""
echo "🔧 Setting up systemd service..."
cat > /etc/systemd/system/finance-family-api.service << 'EOF'
[Unit]
Description=Finance Family REST API Backend
Documentation=https://github.com/yosbany/finance-family
After=network.target

[Service]
Type=simple
User=finance-api
Group=finance-api

WorkingDirectory=/opt/finance-family-api
ExecStart=/usr/bin/node dist/server.js
EnvironmentFile=/etc/finance-family-api/finance-family-api.env

NoNewPrivileges=true
PrivateTmp=true

Restart=on-failure
RestartSec=10s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=finance-family-api

LimitNOFILE=65536
LimitNPROC=4096

KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30s

[Install]
WantedBy=multi-user.target
EOF

chmod 644 /etc/systemd/system/finance-family-api.service
systemctl daemon-reload

echo "   ✅ Service file created"

# Step 8: Setup log rotation
echo "📋 Setting up log rotation..."
cat > /etc/logrotate.d/finance-family-api << 'EOF'
/var/log/finance-family-api/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 finance-api finance-api
    sharedscripts
    postrotate
        systemctl reload finance-family-api > /dev/null 2>&1 || true
    endscript
}
EOF

echo "   ✅ Log rotation configured"

# Summary
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📌 Next steps:"
echo ""
echo "1. Copy Firebase credentials (if not done):"
echo "   scp firebase-service-account.json root@179.43.124.107:/etc/finance-family-api/"
echo "   sudo chown root:root /etc/finance-family-api/firebase-service-account.json"
echo "   sudo chmod 600 /etc/finance-family-api/firebase-service-account.json"
echo ""
echo "2. Verify configuration:"
echo "   cat /etc/finance-family-api/finance-family-api.env"
echo "   jq . /etc/finance-family-api/firebase-service-account.json | head -10"
echo ""
echo "3. Enable and start service:"
echo "   sudo systemctl enable finance-family-api"
echo "   sudo systemctl start finance-family-api"
echo ""
echo "4. Check status:"
echo "   sudo systemctl status finance-family-api"
echo "   sudo journalctl -u finance-family-api -f"
echo ""
echo "5. Test locally:"
echo "   curl http://127.0.0.1:8030/health"
echo ""
echo "6. Configure Nginx:"
echo "   sudo cp service.nrdonline.site.nginx /etc/nginx/sites-available/service.nrdonline.site"
echo "   sudo ln -sf /etc/nginx/sites-available/service.nrdonline.site /etc/nginx/sites-enabled/"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "7. Test HTTPS:"
echo "   curl https://service.nrdonline.site/health"
