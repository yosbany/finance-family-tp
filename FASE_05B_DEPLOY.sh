#!/bin/bash

###############################################################################
# FASE 05B AUTOMATED DEPLOYMENT SCRIPT
# 
# This script automates the complete deployment process:
# 1. Verify LLM model
# 2. Build backend
# 3. Copy to VPS
# 4. Configure environment
# 5. Deploy and test
#
# Prerequisites:
#   - SSH key configured: ~/.ssh/openclaw_vps_ed25519
#   - API key available: NRD_LLM_API_KEY environment variable
#   - Node.js 20+ local
#
# Usage:
#   export NRD_LLM_API_KEY="<your-key>"
#   ./FASE_05B_DEPLOY.sh
#
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_HOST="openclaw-vps-root"
VPS_SSH_KEY="$HOME/.ssh/openclaw_vps_ed25519"
VPS_BACKEND_PATH="/opt/finance-family-api"
VPS_CONFIG_PATH="/etc/finance-family-api"
VPS_ENV_FILE="$VPS_CONFIG_PATH/finance-family-api.env"
LOCAL_BACKEND_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/apps/backend/server"

# Step counter
STEP=0

function log_step() {
    STEP=$((STEP+1))
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}PASO $STEP: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

function log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function log_error() {
    echo -e "${RED}❌ $1${NC}"
}

function log_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Validation
if [ -z "$NRD_LLM_API_KEY" ]; then
    log_error "NRD_LLM_API_KEY environment variable not set"
    exit 1
fi

if [ ! -f "$VPS_SSH_KEY" ]; then
    log_error "SSH key not found: $VPS_SSH_KEY"
    exit 1
fi

log_info "Starting FASE 05B Deployment"
log_info "VPS Host: $VPS_HOST"
log_info "Backend Local: $LOCAL_BACKEND_PATH"
log_info "Backend VPS: $VPS_BACKEND_PATH"

# PASO 1: Verify LLM API
log_step "Verify LLM API Configuration"
echo "Testing https://model.nrdonline.site/v1/models"

MODELS_RESPONSE=$(curl -s -H "Authorization: Bearer $NRD_LLM_API_KEY" \
    https://model.nrdonline.site/v1/models)

if echo "$MODELS_RESPONSE" | grep -q "error"; then
    log_error "LLM API returned error"
    echo "$MODELS_RESPONSE" | jq '.'
    exit 1
fi

MODEL_ID=$(echo "$MODELS_RESPONSE" | jq -r '.data[0].id // "unknown"')
log_success "LLM API accessible"
log_info "Detected model: $MODEL_ID"

# PASO 2: Build Backend
log_step "Build Backend Locally"
cd "$LOCAL_BACKEND_PATH"
log_info "Compiling TypeScript..."
npm run build
log_success "Backend built successfully"
log_info "dist/ size: $(du -sh dist | cut -f1)"

# PASO 3: Copy to VPS
log_step "Copy Build to VPS"
log_info "Creating temporary directory on VPS..."
ssh -i "$VPS_SSH_KEY" "$VPS_HOST" "mkdir -p /tmp/finance-family-build"

log_info "Copying files (dist, package.json, package-lock.json)..."
scp -i "$VPS_SSH_KEY" -r dist/ package.json package-lock.json \
    "$VPS_HOST:/tmp/finance-family-build/"

log_success "Files copied to VPS"

# PASO 4: Configure Environment
log_step "Configure Environment on VPS"

# Generate env file content
ENV_CONTENT="NODE_ENV=production
PORT=3001
FIREBASE_PROJECT_ID=nrd-db
FIREBASE_DATABASE_URL=https://nrd-db-default-rtdb.firebaseio.com
ALLOWED_ORIGINS=https://yosbany.github.io
GOOGLE_APPLICATION_CREDENTIALS=$VPS_CONFIG_PATH/firebase-service-account.json

# FASE 05 - LLM Integration
NRD_LLM_BASE_URL=https://model.nrdonline.site/v1
NRD_LLM_API_KEY=$NRD_LLM_API_KEY
NRD_LLM_MODEL=$MODEL_ID"

log_info "Creating environment file..."
ssh -i "$VPS_SSH_KEY" "$VPS_HOST" "sudo tee $VPS_ENV_FILE > /dev/null << 'ENVEOF'
$ENV_CONTENT
ENVEOF"

log_info "Setting file permissions..."
ssh -i "$VPS_SSH_KEY" "$VPS_HOST" "sudo chmod 600 $VPS_ENV_FILE"
log_success "Environment configured"

# PASO 5: Deploy Backend
log_step "Deploy Backend to Production"

log_info "Creating backup..."
ssh -i "$VPS_SSH_KEY" "$VPS_HOST" \
    "sudo cp -r $VPS_BACKEND_PATH $VPS_BACKEND_PATH.backup-$(date +%Y%m%d-%H%M%S)" || true

log_info "Copying build files..."
ssh -i "$VPS_SSH_KEY" "$VPS_HOST" \
    "sudo cp -r /tmp/finance-family-build/* $VPS_BACKEND_PATH/"

log_info "Installing production dependencies..."
ssh -i "$VPS_SSH_KEY" "$VPS_HOST" \
    "cd $VPS_BACKEND_PATH && sudo npm ci --omit=dev"

log_success "Backend deployed"

# PASO 6: Restart Service
log_step "Restart Service"

log_info "Restarting finance-family-api service..."
ssh -i "$VPS_SSH_KEY" "$VPS_HOST" \
    "sudo systemctl restart finance-family-api"

sleep 2

log_info "Checking service status..."
STATUS=$(ssh -i "$VPS_SSH_KEY" "$VPS_HOST" \
    "sudo systemctl is-active finance-family-api")

if [ "$STATUS" = "active" ]; then
    log_success "Service is running"
else
    log_error "Service failed to start (status: $STATUS)"
    log_info "View logs:"
    ssh -i "$VPS_SSH_KEY" "$VPS_HOST" "sudo journalctl -u finance-family-api -n 50"
    exit 1
fi

# PASO 7: Internal Healthcheck
log_step "Internal Healthcheck"

log_info "Testing http://127.0.0.1:3001/health on VPS..."
HEALTH=$(ssh -i "$VPS_SSH_KEY" "$VPS_HOST" \
    "curl -s http://127.0.0.1:3001/health")

if echo "$HEALTH" | grep -q '"status":"ok"'; then
    log_success "Internal health check passed"
else
    log_error "Health check failed"
    echo "$HEALTH"
    exit 1
fi

# PASO 8: External Healthcheck
log_step "External Healthcheck"

log_info "Testing https://service.nrdonline.site/health"
EXTERNAL_HEALTH=$(curl -s -i https://service.nrdonline.site/health)

if echo "$EXTERNAL_HEALTH" | grep -q "200"; then
    log_success "External health check passed"
else
    log_error "External health check failed"
    echo "$EXTERNAL_HEALTH"
    exit 1
fi

# PASO 9: Test LLM Connectivity from VPS
log_step "Test LLM Connectivity from VPS"

log_info "Running verify-llm-api.mjs on VPS..."
LLM_TEST=$(ssh -i "$VPS_SSH_KEY" "$VPS_HOST" \
    "export NRD_LLM_BASE_URL='https://model.nrdonline.site/v1' && \
     export NRD_LLM_API_KEY='$NRD_LLM_API_KEY' && \
     cd $LOCAL_BACKEND_PATH && \
     node verify-llm-api.mjs 2>&1 | head -50")

echo "$LLM_TEST"

if echo "$LLM_TEST" | grep -q "✅"; then
    log_success "LLM API verified from VPS"
else
    log_error "LLM API verification failed"
fi

# Final Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "NEXT STEPS:"
echo "1. Get Firebase ID Token for test user:"
echo "   node get-id-token.mjs"
echo ""
echo "2. Test without tool:"
echo "   TOKEN=<your-token>"
echo "   curl -X POST https://service.nrdonline.site/api/agent/query \\"
echo "     -H \"Authorization: Bearer \$TOKEN\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"message\": \"¿Qué tipo de información podés consultar?\"}'"
echo ""
echo "3. Test with tool:"
echo "   curl -X POST https://service.nrdonline.site/api/agent/query \\"
echo "     -H \"Authorization: Bearer \$TOKEN\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"message\": \"Mostrame mis transacciones de septiembre de 2026.\"}'"
echo ""
echo "4. Check logs:"
echo "   ssh -i ~/.ssh/openclaw_vps_ed25519 openclaw-vps-root"
echo "   sudo journalctl -u finance-family-api -f"
echo ""
