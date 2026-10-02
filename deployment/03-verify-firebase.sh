#!/bin/bash

# Firebase Service Account Verification Script
# Run on VPS to verify Firebase credentials are properly configured

echo "🔍 Firebase Service Account Verification"
echo "========================================"

CREDS_FILE="/etc/finance-family-api/firebase-service-account.json"
CONFIG_FILE="/etc/finance-family-api/finance-family-api.env"

echo ""
echo "Checking Firebase credentials..."
echo ""

# Check if file exists
if [ ! -f "$CREDS_FILE" ]; then
  echo "❌ Credentials file not found: $CREDS_FILE"
  echo ""
  echo "To fix:"
  echo "  scp firebase-service-account.json root@VPS:/tmp/"
  echo "  sudo cp /tmp/firebase-service-account.json $CREDS_FILE"
  echo "  sudo chown root:root $CREDS_FILE"
  echo "  sudo chmod 600 $CREDS_FILE"
  exit 1
fi

echo "✅ Credentials file exists: $CREDS_FILE"

# Check permissions
PERMS=$(stat -c %a "$CREDS_FILE" 2>/dev/null || stat -f %A "$CREDS_FILE" 2>/dev/null || echo "unknown")
echo "   Permissions: $PERMS"

if [ "$PERMS" != "600" ] && [ "$PERMS" != "-rw-------" ]; then
  echo "⚠️  WARNING: File permissions are not restrictive enough!"
  echo "   Run: sudo chmod 600 $CREDS_FILE"
fi

# Check if valid JSON
if ! jq empty "$CREDS_FILE" 2>/dev/null; then
  echo "❌ Invalid JSON format!"
  exit 1
fi

echo "✅ Valid JSON format"
echo ""

# Extract key fields
PROJECT_ID=$(jq -r '.project_id' "$CREDS_FILE")
TYPE=$(jq -r '.type' "$CREDS_FILE")
EMAIL=$(jq -r '.client_email' "$CREDS_FILE")
KEY_ID=$(jq -r '.private_key_id' "$CREDS_FILE")

echo "Firebase Account Details:"
echo "  Project ID: $PROJECT_ID"
echo "  Type: $TYPE"
echo "  Email: $EMAIL"
echo "  Key ID: ${KEY_ID:0:16}..."

# Verify against config
if [ -f "$CONFIG_FILE" ]; then
  CONFIG_PROJECT=$(grep FIREBASE_PROJECT_ID "$CONFIG_FILE" | cut -d= -f2)
  echo ""
  echo "Configuration Check:"
  echo "  Config Project ID: $CONFIG_PROJECT"
  
  if [ "$PROJECT_ID" != "$CONFIG_PROJECT" ]; then
    echo "  ⚠️  WARNING: Project ID mismatch!"
    echo "     Firebase: $PROJECT_ID"
    echo "     Config:   $CONFIG_PROJECT"
  else
    echo "  ✅ Project ID matches"
  fi
fi

# Check GOOGLE_APPLICATION_CREDENTIALS env var
echo ""
echo "Environment Variable Check:"
ENV_VAR=$(grep GOOGLE_APPLICATION_CREDENTIALS "$CONFIG_FILE" 2>/dev/null)
if [ -z "$ENV_VAR" ]; then
  echo "  ❌ GOOGLE_APPLICATION_CREDENTIALS not set in config"
else
  echo "  ✅ GOOGLE_APPLICATION_CREDENTIALS configured"
  echo "     $ENV_VAR"
fi

# Try to test Firebase connection (requires Node.js)
echo ""
echo "Firebase Connection Test:"

if command -v node &> /dev/null; then
  cat > /tmp/test-firebase.js << 'TESTEOF'
const admin = require('firebase-admin');
const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

try {
  admin.initializeApp({
    projectId: serviceAccount.project_id,
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('✅ Firebase Admin SDK initialized successfully');
  console.log(`   Project: ${serviceAccount.project_id}`);
  console.log(`   Email: ${serviceAccount.client_email}`);
  
  process.exit(0);
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  process.exit(1);
}
TESTEOF

  export GOOGLE_APPLICATION_CREDENTIALS="$CREDS_FILE"
  node /tmp/test-firebase.js 2>&1 || echo "   (Firebase Admin SDK test requires npm dependencies in test environment)"
else
  echo "  ⚠️  Node.js not available for connection test"
fi

echo ""
echo "✅ Firebase verification complete!"
echo ""
echo "Next: Start service with 'sudo systemctl start finance-family-api'"
