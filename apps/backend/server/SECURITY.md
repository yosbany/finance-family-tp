# Backend Security Architecture

## Overview

Finance Family REST API implements a **security-first architecture** where:

1. **Authentication** happens at HTTP boundary (Firebase ID Token verification)
2. **Authorization** happens in application code (not Firebase rules)
3. **Data isolation** is guaranteed by deriving paths from verified UID only
4. **Validation** is server-side and comprehensive

## Critical Security Principles

### 1. UID is Source of Truth

```
CORRECT:
const uid = context.uid;  // From verified token
const path = `${familyRoot}/${uid}/transactions`;

INCORRECT:
const uid = request.body.uid;  // NEVER from request
const path = request.body.firebasePath;  // NEVER from request
```

**The uid MUST come from AuthenticatedContext, which is ONLY populated from verified Firebase ID Token.**

### 2. Prohibited Parameters

The following parameters are **ALWAYS rejected**:

- `uid`
- `userId`
- `familyId`
- `firebasePath`
- `path`
- Any parameter not in the explicit allowlist

Rejected with: `SECURITY_VIOLATION: Parameter 'X' is not allowed`

### 3. Input Validation

All parameters are validated server-side:

- **Type checking**: Must match expected type (number, string, enum)
- **Range checking**: Within acceptable bounds
- **Enum validation**: Only allowed values accepted
- **Length limits**: Strings have maximum lengths
- **Unknown parameters rejected**: Only allowed parameters processed

### 4. Output Sanitization

Responses contain ONLY necessary information:

- ✅ Transaction ID, amount, date, description
- ✅ Pagination metadata (counts, offsets)
- ❌ Full transaction objects
- ❌ Internal paths or structures
- ❌ Firebase credentials
- ❌ User secrets

### 5. Firebase Admin Bypass

Firebase Admin SDK **bypasses security rules** at the database.

**This is intentional**: Application code is the security boundary.

```typescript
// Firebase rules cannot stop Admin SDK
const db = admin.database();

// Therefore, this code IS the security layer:
const familyRoot = await getFamilyRootForUser(uid);  // Validates UID
const path = `${familyRoot}/transactions`;           // Safe path derivation
```

## Authentication Flow

```
1. Frontend: User logs in with Firebase Auth
2. Frontend: Obtains ID Token via currentUser.getIdToken()
3. Frontend: Sends request with "Authorization: Bearer <idToken>"
4. Backend: Extracts Authorization header
5. Backend: Verifies token with Firebase Admin SDK
6. Backend: Extracts uid from verified token
7. Backend: Creates AuthenticatedContext { uid }
8. Backend: Passes context to tools (not request body)
9. Backend: Tool uses uid from context to fetch data
10. Response: Returns sanitized result
```

## Error Handling

Errors are handled centrally and safely:

```typescript
// INTERNAL (logged):
❌ User 'abc123' not found in family root
❌ Database read failed: PERMISSION_DENIED

// EXTERNAL (sent to client):
✅ "User not authorized for this operation"
✅ "Internal server error"
```

**No stack traces, paths, or internal details exposed.**

## Logging

Logged:

- ✅ Request path, method, status code
- ✅ Request duration
- ✅ Error type and category
- ✅ Timestamp and request ID (if available)

NOT logged:

- ❌ Firebase ID Token
- ❌ API keys
- ❌ Service account credentials
- ❌ Full transaction data
- ❌ User PII
- ❌ Authorization header values

## Testing Security

### Test 1: No Authentication

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Content-Type: application/json" \
  -d '{"from": 1000}'

# Expected: 401 UNAUTHENTICATED
```

### Test 2: Invalid Token

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"from": 1000}'

# Expected: 401 UNAUTHENTICATED
```

### Test 3: UID Injection

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer <valid-token>" \
  -H "Content-Type: application/json" \
  -d '{"uid": "other-user-id", "from": 1000}'

# Expected: 400 SECURITY_VIOLATION: Parameter 'uid' is not allowed
```

### Test 4: Path Injection

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer <valid-token>" \
  -H "Content-Type: application/json" \
  -d '{"firebasePath": "/users/other-user", "from": 1000}'

# Expected: 400 SECURITY_VIOLATION: Parameter 'firebasePath' is not allowed
```

### Test 5: Unknown Parameter

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer <valid-token>" \
  -H "Content-Type: application/json" \
  -d '{"foo": "bar", "from": 1000}'

# Expected: 400 INVALID_ARGUMENT: Unknown parameter 'foo'
```

### Test 6: Invalid Limit

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer <valid-token>" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000}'

# Expected: 400 INVALID_ARGUMENT: limit must be between 1 and 500
```

## Secrets Management

### ✅ Correct (Values in VPS Secrets)

```bash
# In /etc/environment or systemd service file:
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json

# The file itself is:
- Owned by limited user
- Readable only by backend process
- NOT in Git
- NOT in Docker image layers
- NOT in logs
```

### ❌ Incorrect (Values in Code/Config)

```bash
# NEVER do this:
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}  # in .env
GOOGLE_APPLICATION_CREDENTIALS=./secret.json              # in Git
VITE_FIREBASE_PRIVATE_KEY=...                             # in frontend
```

## Firewall and Reverse Proxy

The backend runs on internal port (e.g., 127.0.0.1:3001):

```
Client (Internet)
    ↓ HTTPS 443
Reverse Proxy (Nginx)
    ↓ HTTP 127.0.0.1:3001
Backend (internal)
```

This ensures:

- ✅ Only reverse proxy can reach backend
- ✅ Direct backend access blocked by firewall
- ✅ TLS termination at reverse proxy
- ✅ Backend doesn't need certificate management

## Security Checklist

- [ ] Firebase ID Token verified on every authenticated request
- [ ] UID derived from token, never from request
- [ ] Prohibited parameters rejected before processing
- [ ] All inputs validated server-side
- [ ] Unknown parameters rejected
- [ ] Output sanitized (no sensitive data)
- [ ] Error messages don't expose internals
- [ ] Logging doesn't contain secrets
- [ ] Backend listens on 127.0.0.1 only
- [ ] Reverse proxy enforces HTTPS
- [ ] Service account credentials in secure location
- [ ] No credentials in Git or Docker images
- [ ] Rate limiting configured
- [ ] Body size limits enforced

## References

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK](https://firebase.google.com/docs/database)
- [OWASP Authentication](https://owasp.org/www-community/attacks/Authentication)
- [Security Headers](https://owasp.org/www-project-secure-headers/)
