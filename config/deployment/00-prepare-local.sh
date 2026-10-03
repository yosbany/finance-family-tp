#!/bin/bash
set -e

# Finance Family API - Local Preparation Script
# Execute as: bash 00-prepare-local.sh
#
# This script prepares the backend for deployment to the VPS

echo "📦 Finance Family API - Local Preparation"
echo "=========================================="

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SERVER_DIR="$REPO_ROOT/server"
DEPLOY_DIR="$REPO_ROOT/deployment"

echo ""
echo "📂 Repository: $REPO_ROOT"
echo "📂 Server: $SERVER_DIR"
echo "📂 Deployment: $DEPLOY_DIR"

# Step 1: Verify server directory
if [ ! -d "$SERVER_DIR" ]; then
  echo "❌ Server directory not found: $SERVER_DIR"
  exit 1
fi

echo ""
echo "✅ Repository structure verified"

# Step 2: Build backend
echo ""
echo "🔨 Building backend..."
cd "$SERVER_DIR"
npm run build
echo "✅ Backend built successfully"

# Step 3: Verify dist exists
if [ ! -f "$SERVER_DIR/dist/server.js" ]; then
  echo "❌ Build failed: dist/server.js not found"
  exit 1
fi

# Step 4: Create archive
echo ""
echo "📦 Creating archive..."
ARCHIVE_NAME="finance-family-backend.tar.gz"
ARCHIVE_PATH="$DEPLOY_DIR/$ARCHIVE_NAME"

# Clean previous archive if exists
rm -f "$ARCHIVE_PATH"

# Create archive with only production files
cd "$SERVER_DIR"
tar -czf "$ARCHIVE_PATH" \
  dist/ \
  node_modules/ \
  package.json \
  package-lock.json

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "❌ Archive creation failed"
  exit 1
fi

ARCHIVE_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)
echo "✅ Archive created: $ARCHIVE_PATH ($ARCHIVE_SIZE)"

# Step 5: Provide upload instructions
echo ""
echo "📤 Upload instructions:"
echo ""
echo "1. Copy to VPS:"
echo "   scp $ARCHIVE_PATH root@179.43.124.107:/tmp/"
echo ""
echo "2. Copy deployment scripts:"
echo "   scp $DEPLOY_DIR/01-deploy.sh root@179.43.124.107:/tmp/"
echo "   scp $DEPLOY_DIR/service.nrdonline.site.nginx root@179.43.124.107:/tmp/"
echo ""
echo "3. Copy Firebase credentials:"
echo "   scp /path/to/firebase-service-account.json root@179.43.124.107:/tmp/"
echo ""
echo "4. On VPS, run deployment:"
echo "   sudo bash /tmp/01-deploy.sh /tmp/finance-family-backend.tar.gz"
echo "   sudo cp /tmp/firebase-service-account.json /etc/finance-family-api/"
echo "   sudo chown root:root /etc/finance-family-api/firebase-service-account.json"
echo "   sudo chmod 600 /etc/finance-family-api/firebase-service-account.json"
echo ""
echo "5. Enable and start:"
echo "   sudo systemctl enable finance-family-api"
echo "   sudo systemctl start finance-family-api"
echo ""

echo "✅ Local preparation complete!"
