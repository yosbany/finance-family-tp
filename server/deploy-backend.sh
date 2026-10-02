#!/bin/bash

################################################################################
# Finance Family Backend Deployment Script
# 
# Usage:
#   ./deploy-backend.sh <target_host> <firebase_service_account_json>
#
# Example:
#   ./deploy-backend.sh openclaw-vps-root ~/firebase-service-account.json
#
################################################################################

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TARGET_HOST="${1:-}"
FIREBASE_JSON="${2:-}"
DEPLOY_DIR="/opt/finance-family-api"
ETC_DIR="/etc/finance-family-api"
SERVICE_USER="finance-api"
SERVICE_GROUP="finance-api"
PORT="8030"

log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_error() {
    echo -e "${RED}✗${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $*"
}

# Validate inputs
if [[ -z "$TARGET_HOST" ]]; then
    log_error "Usage: $0 <target_host> <firebase_service_account_json>"
    exit 1
fi

if [[ -z "$FIREBASE_JSON" ]]; then
    log_error "Firebase service account JSON path required"
    exit 1
fi

if [[ ! -f "$FIREBASE_JSON" ]]; then
    log_error "Firebase service account JSON not found: $FIREBASE_JSON"
    exit 1
fi

log_info "===== Finance Family Backend Deployment ====="
log_info "Target: $TARGET_HOST"
log_info "Deploy Dir: $DEPLOY_DIR"
log_info "Service User: $SERVICE_USER"
log_info ""

# Step 1: Verify build artifacts
log_info "Step 1: Verifying build artifacts..."
if [[ ! -d "dist" ]]; then
    log_error "dist/ directory not found. Please run: npm run build"
    exit 1
fi

if [[ ! -f "package.json" ]]; then
    log_error "package.json not found"
    exit 1
fi

if [[ ! -f "package-lock.json" ]]; then
    log_error "package-lock.json not found"
    exit 1
fi

log_success "Build artifacts verified"
log_info "  - dist/ ✓"
log_info "  - package.json ✓"
log_info "  - package-lock.json ✓"
echo ""

# Step 2: Create deployment package (exclude node_modules)
log_info "Step 2: Creating deployment package..."
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

mkdir -p "$TEMP_DIR/finance-family-api"
cp -r dist/ "$TEMP_DIR/finance-family-api/"
cp package.json "$TEMP_DIR/finance-family-api/"
cp package-lock.json "$TEMP_DIR/finance-family-api/"

log_success "Deployment package created in $TEMP_DIR"
echo ""

# Step 3: Prepare deployment script to run on VPS
log_info "Step 3: Creating remote deployment script..."
REMOTE_SCRIPT=$(mktemp)

cat > "$REMOTE_SCRIPT" << 'VPSEOF'
#!/bin/bash
set -euo pipefail

DEPLOY_DIR="$1"
ETC_DIR="$2"
SERVICE_USER="$3"
SERVICE_GROUP="$4"
PORT="$5"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ${NC} $*"; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*"; }

# Step 1: Create service user if not exists
log_info "Creating service user if needed..."
if ! id "$SERVICE_USER" &>/dev/null; then
    sudo useradd -r -s /bin/false "$SERVICE_USER"
    log_success "User $SERVICE_USER created"
else
    log_info "User $SERVICE_USER already exists"
fi
echo ""

# Step 2: Create directories
log_info "Creating directories..."
sudo mkdir -p "$DEPLOY_DIR"
sudo mkdir -p "$ETC_DIR"
log_success "Directories created"
echo ""

# Step 3: Deploy application files
log_info "Deploying application files..."
sudo cp -r dist package.json package-lock.json "$DEPLOY_DIR/"
log_success "Files deployed"
echo ""

# Step 4: Install dependencies
log_info "Installing Node dependencies (Linux native)..."
cd "$DEPLOY_DIR"
sudo npm ci --omit=dev
log_success "Dependencies installed"
echo ""

# Step 5: Set permissions
log_info "Setting permissions..."
sudo chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DEPLOY_DIR"
sudo chmod -R u+r,u+x "$DEPLOY_DIR"
log_success "Permissions set"
echo ""

# Step 6: Verify setup
log_info "Verifying setup..."
if [[ -f "$DEPLOY_DIR/dist/server.js" ]]; then
    log_success "Main entry point found"
else
    log_error "Main entry point not found at $DEPLOY_DIR/dist/server.js"
    exit 1
fi
echo ""

log_info "Backend deployment complete!"
VPSEOF

chmod +x "$REMOTE_SCRIPT"
log_success "Remote script created"
echo ""

# Step 4: Upload files to VPS
log_info "Step 4: Uploading to VPS..."
log_info "Uploading application files..."
scp -r "$TEMP_DIR/finance-family-api/" "$TARGET_HOST:/tmp/"
log_success "Application files uploaded"

log_info "Uploading Firebase credentials..."
scp "$FIREBASE_JSON" "$TARGET_HOST:/tmp/firebase-service-account.json"
log_success "Firebase credentials uploaded"

log_info "Uploading deploy script..."
scp "$REMOTE_SCRIPT" "$TARGET_HOST:/tmp/remote-deploy.sh"
log_success "Deploy script uploaded"
echo ""

# Step 5: Execute remote deployment
log_info "Step 5: Executing remote deployment..."
ssh "$TARGET_HOST" "bash /tmp/remote-deploy.sh '$DEPLOY_DIR' '$ETC_DIR' '$SERVICE_USER' '$SERVICE_GROUP' '$PORT'"
echo ""

# Step 6: Setup Firebase credentials on VPS
log_info "Step 6: Setting up Firebase credentials..."
ssh "$TARGET_HOST" << SETUPEOF
set -euo pipefail

FIREBASE_JSON="/tmp/firebase-service-account.json"
TARGET_LOCATION="$ETC_DIR/firebase-service-account.json"
SERVICE_USER="$SERVICE_USER"
SERVICE_GROUP="$SERVICE_GROUP"

if [[ ! -f "\$FIREBASE_JSON" ]]; then
    echo "ERROR: Firebase JSON not found"
    exit 1
fi

# Move to secure location
sudo mkdir -p "$ETC_DIR"
sudo mv "\$FIREBASE_JSON" "\$TARGET_LOCATION"

# Set permissions: owner=root, group=finance-api, mode=640
sudo chown root:"\$SERVICE_GROUP" "\$TARGET_LOCATION"
sudo chmod 640 "\$TARGET_LOCATION"

# Verify permissions
if sudo -u "$SERVICE_USER" test -r "\$TARGET_LOCATION"; then
    echo "✓ Credentials readable by $SERVICE_USER"
else
    echo "✗ ERROR: Credentials not readable by $SERVICE_USER"
    exit 1
fi
SETUPEOF

log_success "Firebase credentials secured"
echo ""

# Step 7: Create environment file
log_info "Step 7: Creating environment file..."
ssh "$TARGET_HOST" << ENVEOF
set -euo pipefail

ENV_FILE="$ETC_DIR/finance-family-api.env"

# Create environment file
sudo tee "\$ENV_FILE" > /dev/null << 'EOF_ENV'
NODE_ENV=production
PORT=$PORT
FIREBASE_PROJECT_ID=finance-family-tp
FIREBASE_DATABASE_URL=https://finance-family-tp.firebaseio.com
GOOGLE_APPLICATION_CREDENTIALS=$ETC_DIR/firebase-service-account.json
ALLOWED_ORIGINS=https://yosbany.github.io
NRD_LLM_BASE_URL=https://model.nrdonline.site/v1
EOF_ENV

# Restrict permissions on env file
sudo chmod 640 "\$ENV_FILE"
sudo chown root:$SERVICE_GROUP "\$ENV_FILE"

echo "✓ Environment file created at \$ENV_FILE"
ENVEOF

log_success "Environment file created"
echo ""

# Step 8: Install systemd service
log_info "Step 8: Installing systemd service..."
SYSTEMD_UNIT=$(mktemp)
cat > "$SYSTEMD_UNIT" << 'SYSTEMDEOF'
[Unit]
Description=Finance Family REST API Backend
Documentation=https://github.com/yosbany/finance-family-tp
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=finance-api
Group=finance-api
WorkingDirectory=/opt/finance-family-api
EnvironmentFile=/etc/finance-family-api/finance-family-api.env
ExecStart=/usr/bin/node /opt/finance-family-api/dist/server.js
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/opt/finance-family-api
Restart=on-failure
RestartSec=10
StartLimitInterval=300
StartLimitBurst=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=finance-api

[Install]
WantedBy=multi-user.target
SYSTEMDEOF

scp "$SYSTEMD_UNIT" "$TARGET_HOST:/tmp/finance-family-api.service"

ssh "$TARGET_HOST" << SYSTEMDEOF
set -euo pipefail

sudo cp /tmp/finance-family-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable finance-family-api

echo "✓ Systemd service installed and enabled"
SYSTEMDEOF

log_success "Systemd service installed"
echo ""

# Step 9: Test health check
log_info "Step 9: Testing backend..."
ssh "$TARGET_HOST" << TESTEOF
set -euo pipefail

# Start the service
echo "Starting service..."
sudo systemctl start finance-family-api

# Wait for startup
echo "Waiting for backend to start..."
sleep 3

# Check status
if sudo systemctl is-active --quiet finance-family-api; then
    echo "✓ Service is running"
else
    echo "✗ Service failed to start"
    sudo journalctl -u finance-family-api -n 20
    exit 1
fi

# Test health endpoint
echo "Testing health endpoint..."
if curl -s http://127.0.0.1:8030/health | grep -q "ok"; then
    echo "✓ Health endpoint responding"
else
    echo "✗ Health endpoint not responding"
    exit 1
fi
TESTEOF

log_success "Backend test passed"
echo ""

# Cleanup
rm -f "$REMOTE_SCRIPT" "$SYSTEMD_UNIT"

log_success "===== Deployment Complete ====="
log_info "Next steps:"
log_info "1. Configure Nginx proxy"
log_info "2. Set up HTTPS certificate"
log_info "3. Test from outside VPS"
log_info ""
log_info "Check status: ssh $TARGET_HOST 'sudo systemctl status finance-family-api'"
log_info "View logs: ssh $TARGET_HOST 'sudo journalctl -u finance-family-api -f'"
