# Frontend Configuration for New REST Backend

## Overview

The frontend has been updated to use the new standalone REST backend instead of Firebase Cloud Functions.

### Key Changes

1. **API Base URL**: Changed from Firebase Cloud Functions to REST backend
2. **Authentication**: Still uses Firebase Auth, but token is passed as Bearer in Authorization header
3. **Endpoints**: Changed from Cloud Function naming to REST conventions

## Configuration

### Environment Variables

Add this to your `.env.local` or `.env` file:

```bash
# Development (local backend)
VITE_FINANCE_API_URL=http://127.0.0.1:3001

# Or production (after deployment to VPS)
# VITE_FINANCE_API_URL=https://service.nrdonline.site
```

### Vite Config

The frontend is configured to use `VITE_FINANCE_API_URL` environment variable:

```typescript
const AGENT_API_BASE_URL = process.env.VITE_FINANCE_API_URL || 'http://127.0.0.1:3001';
```

## How It Works

### Authentication Flow

```
1. User logs in with Firebase Auth (Google provider)
   ↓
2. Frontend obtains ID Token: await currentUser.getIdToken()
   ↓
3. Frontend sends API request with Authorization header:
   Authorization: Bearer <firebase-id-token>
   ↓
4. Backend verifies token with Firebase Admin SDK
   ↓
5. Backend extracts uid from verified token
   ↓
6. Backend uses uid to fetch user's data from Firebase Realtime Database
   ↓
7. Backend returns sanitized result
```

### API Call Example

```typescript
import { callSearchTransactions } from '@/services/agentApi.service';

// In React component
const results = await callSearchTransactions({
  from: startDate.getTime(),
  to: endDate.getTime(),
  limit: 50,
  offset: 0
});

// results.transactions contains: [
//   { id, accountId, date, description, amount, currency, type, category, status }
// ]
// results.pagination contains: { total, matched, offset, limit, truncated }
```

**Important**: The client NEVER sends `uid`, `userId`, `familyId`, or `firebasePath` parameters. The server extracts the UID from the verified Firebase token.

## Endpoints

### Health Check

```http
GET http://127.0.0.1:3001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": 1696262400000
}
```

### Search Transactions

```http
POST http://127.0.0.1:3001/api/tools/search-transactions
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

Request body:
```json
{
  "from": 1696262400000,
  "to": 1696348800000,
  "accountId": "acc-123",
  "categoryId": "cat-456",
  "type": "expense",
  "currency": "UYU",
  "description": "search term",
  "minAmount": 10,
  "maxAmount": 1000,
  "status": "classified",
  "limit": 50,
  "offset": 0
}
```

Response:
```json
{
  "transactions": [...],
  "pagination": {
    "total": 150,
    "matched": 25,
    "offset": 0,
    "limit": 50,
    "truncated": false
  }
}
```

## Development Setup

### Local Development (Backend + Frontend)

#### Terminal 1: Start Backend

```bash
cd server
npm install
npm run dev
```

Backend runs on http://127.0.0.1:3001

#### Terminal 2: Start Frontend

```bash
npm install
npm run dev
```

Frontend runs on http://localhost:5173

#### Terminal 3 (Optional): Test Backend

```bash
# Health check
curl http://127.0.0.1:3001/health

# Test with valid Firebase token
TOKEN="<firebase-id-token>"
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

### Environment Setup

Create `.env.local` in root directory:

```bash
# Firebase config (same as before)
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_DATABASE_URL=...
# ... other Firebase vars

# NEW: Backend API URL
VITE_FINANCE_API_URL=http://127.0.0.1:3001
```

## Production Deployment

### After Backend is Deployed to VPS

Update your `.env.local`:

```bash
# Change API URL to production backend
VITE_FINANCE_API_URL=https://service.nrdonline.site
```

Or configure it in GitHub Actions secrets:

```yaml
# .github/workflows/deploy.yml
env:
  VITE_FINANCE_API_URL: https://service.nrdonline.site
```

No other changes needed - authentication still works the same way with Firebase.

## Error Handling

The backend returns standardized error responses:

### Authentication Error (401)

```json
{
  "error": "UNAUTHENTICATED",
  "message": "Invalid or expired token"
}
```

### Invalid Parameters (400)

```json
{
  "error": "INVALID_ARGUMENT",
  "message": "limit must be between 1 and 500"
}
```

### Security Violation (400)

```json
{
  "error": "SECURITY_VIOLATION",
  "message": "Invalid request parameters"
}
```

Example: If you try to send `uid` in the request body:

```javascript
// This will be rejected:
callSearchTransactions({
  uid: 'attempt-injection',  // ❌ REJECTED
  limit: 10
})

// Error response:
// { error: "SECURITY_VIOLATION", message: "Parameter 'uid' is not allowed" }
```

### Permission Error (403)

```json
{
  "error": "PERMISSION_DENIED",
  "message": "User not authorized for this operation"
}
```

### Server Error (500)

```json
{
  "error": "INTERNAL_ERROR",
  "message": "Internal server error"
}
```

## Debugging

### Check Backend Connectivity

```typescript
import { checkAgentApiHealth } from '@/services/agentApi.service';

const isHealthy = await checkAgentApiHealth();
console.log('Backend healthy:', isHealthy);
```

### Browser Console

Open DevTools (F12) → Network tab → look for POST requests to `/api/tools/search-transactions`

Check:
- Request headers include `Authorization: Bearer <token>`
- Response status (200 = success, 4xx = client error, 5xx = server error)
- Response body contains expected data

### Backend Logs

```bash
# If running locally with npm run dev
npm run dev

# If running with Docker
docker-compose logs -f api

# If running as systemd service
sudo journalctl -u finance-backend -f
```

## Migration from Cloud Functions

### What Changed

| Aspect | Cloud Functions | REST Backend |
|--------|-----------------|--------------|
| URL | `http://localhost:5001/finance-family-tp/us-east1/searchTransactionsEndpoint` | `http://127.0.0.1:3001/api/tools/search-transactions` |
| Method | POST (Cloud Function) | POST (HTTP) |
| Auth | Firebase Callable auth | Authorization header |
| Response | `{ result: {...} }` | Direct response `{...}` |
| Error | Firebase error format | Standard JSON error |

### What Stayed the Same

- Firebase Authentication (Google login)
- Input parameters and validation
- Output structure (transactions + pagination)
- Security model (UID from verified token)
- Endpoint logic (search, filters, limits)

## Troubleshooting

### "Failed to fetch"

**Cause**: Backend not running or CORS issue

**Solution**:
```bash
# Check backend is running
curl http://127.0.0.1:3001/health

# Check CORS is configured
# Backend should allow your frontend origin
```

### "Authentication required"

**Cause**: No valid Firebase token

**Solution**:
```bash
# Make sure you're logged in to Firebase
# Check Firebase Auth is configured correctly
```

### "Invalid token"

**Cause**: Token is expired or invalid

**Solution**:
```typescript
// Force token refresh
const currentUser = auth.currentUser;
const newToken = await currentUser.getIdToken(true); // force refresh
```

### "Unknown parameter"

**Cause**: Sending invalid query parameter

**Solution**:
```javascript
// ❌ WRONG
callSearchTransactions({
  from: 1000,
  unknown_param: 'value'  // ❌ Not allowed
})

// ✅ CORRECT
callSearchTransactions({
  from: 1000,
  limit: 50  // Only allowed parameters
})
```

## References

- Backend README: `/server/README.md`
- Backend Security: `/server/SECURITY.md`
- Deployment Guide: `/server/DEPLOYMENT.md`
- Agent API Service: `/src/services/agentApi.service.ts`

---

Made with ❤️
