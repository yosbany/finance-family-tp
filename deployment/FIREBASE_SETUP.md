# Firebase Service Account Setup

## ⚠️ CRITICAL SECURITY NOTICE

The Firebase service account JSON file contains **PRIVATE CREDENTIALS** that grant full access to your Firebase project. Handle with extreme care:

### DO NOT:
- ❌ Commit to Git
- ❌ Push to GitHub
- ❌ Include in Docker images
- ❌ Print in console/logs
- ❌ Share via email/Slack
- ❌ Include in documentation
- ❌ Backup to cloud storage without encryption

### DO:
- ✅ Store only in protected system directory: `/etc/finance-family-api/`
- ✅ Set permissions: `600` (owner read-write only)
- ✅ Set owner: `root:root`
- ✅ Reference via `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- ✅ Rotate periodically (Firebase recommends every 90 days)

## Getting the JSON File

### 1. From Firebase Console

1. Go to: https://console.firebase.google.com/
2. Select your project: `finance-family-tp`
3. Settings (⚙️) → Project Settings
4. Click "Service Accounts" tab
5. Click "Generate New Private Key"
6. File downloads as `<project-id>-<key-id>.json`
7. Rename to: `firebase-service-account.json`

### 2. From Firebase CLI (Alternative)

If you have Firebase CLI installed:

```bash
# Log in if not already
firebase login

# Download service account
firebase admin:import --project=finance-family-tp \
  > firebase-service-account.json
```

## Secure Transfer to VPS

### Option 1: Direct SCP (Recommended)

```bash
# From local machine where you have the JSON
scp firebase-service-account.json root@179.43.124.107:/tmp/

# On VPS
ssh root@179.43.124.107
sudo cp /tmp/firebase-service-account.json /etc/finance-family-api/
sudo chown root:root /etc/finance-family-api/firebase-service-account.json
sudo chmod 600 /etc/finance-family-api/firebase-service-account.json

# Clean up
rm /tmp/firebase-service-account.json
```

### Option 2: Base64 Encoding (for scripts)

```bash
# Local: Encode
base64 firebase-service-account.json > firebase-service-account.json.b64

# SCP the .b64 file
scp firebase-service-account.json.b64 root@179.43.124.107:/tmp/

# On VPS: Decode
base64 -d /tmp/firebase-service-account.json.b64 \
  > /etc/finance-family-api/firebase-service-account.json
sudo chown root:root /etc/finance-family-api/firebase-service-account.json
sudo chmod 600 /etc/finance-family-api/firebase-service-account.json
rm /tmp/firebase-service-account.json.b64
```

## Verification

### Check File is Protected

```bash
# Permissions should be: -rw------- (600)
sudo ls -la /etc/finance-family-api/firebase-service-account.json
```

### Verify Content (Safe)

```bash
# Shows only safe metadata, NOT private key
sudo jq '{
  project_id: .project_id,
  type: .type,
  client_email: .client_email
}' /etc/finance-family-api/firebase-service-account.json
```

Expected output:
```json
{
  "project_id": "finance-family-tp",
  "type": "service_account",
  "client_email": "firebase-adminsdk-xxxxx@finance-family-tp.iam.gserviceaccount.com"
}
```

### Full Verification (On VPS)

Run the verification script:

```bash
sudo bash /tmp/03-verify-firebase.sh
```

Or manual check:

```bash
sudo jq empty /etc/finance-family-api/firebase-service-account.json \
  && echo "✅ Valid JSON" || echo "❌ Invalid JSON"
```

## Rotating Service Account Key

If key is compromised or for periodic rotation:

### 1. Generate New Key in Firebase Console
- Settings → Service Accounts → Generate New Private Key
- This disables the old key

### 2. Update on VPS

```bash
# Replace the file
scp new-firebase-service-account.json root@179.43.124.107:/tmp/
ssh root@179.43.124.107
sudo cp /tmp/new-firebase-service-account.json \
  /etc/finance-family-api/firebase-service-account.json
sudo chmod 600 /etc/finance-family-api/firebase-service-account.json

# Restart service (reads new credentials)
sudo systemctl restart finance-family-api

# Verify
sudo journalctl -u finance-family-api | grep -i "firebase"
```

### 3. Delete Old Key in Firebase Console
- Settings → Service Accounts → Delete old key

## Troubleshooting

### "Invalid service account" error
- Check JSON is valid: `jq empty firebase-service-account.json`
- Check file permissions: `ls -la /etc/finance-family-api/firebase-service-account.json`
- Check GOOGLE_APPLICATION_CREDENTIALS is set: `cat /etc/finance-family-api/finance-family-api.env | grep GOOGLE`
- Restart service: `sudo systemctl restart finance-family-api`

### "Permission denied" when accessing file
- Must have correct ownership: `sudo chown root:root /etc/finance-family-api/firebase-service-account.json`
- Must have correct permissions: `sudo chmod 600 /etc/finance-family-api/firebase-service-account.json`

### "Can't read the private key" error
- File might be corrupted from transfer
- Re-download from Firebase Console and transfer again
- Verify with: `jq '.private_key' /etc/finance-family-api/firebase-service-account.json`

## Emergency: Delete Compromised Credentials

If accidentally leaked:

1. **Immediately**:
   ```bash
   # Delete from VPS
   sudo rm /etc/finance-family-api/firebase-service-account.json
   sudo systemctl stop finance-family-api
   ```

2. **In Firebase Console**:
   - Go to Service Accounts
   - Delete the compromised key
   - This invalidates it immediately

3. **Generate New Key**:
   - Create new key in Firebase Console
   - Transfer to VPS using secure method
   - Restart service

4. **Audit**:
   - Check Firebase logs for unauthorized access
   - Review API usage in Firebase console

## Automation: Store in Cursor Agent Store

For future deployments, you can securely store the JSON in your personal Cursor agent store:

```bash
# Copy to Cursor agent store (local machine only)
cp firebase-service-account.json \
  ~/Library/Application\ Support/Cursor/AgentStores/cursor_agent_stores/u145882465/files/
```

This keeps it outside version control and only in your local Cursor environment.

---

**Remember**: This file is equivalent to having admin access to your Firebase project. Treat it with the same security level as database passwords or API keys.
