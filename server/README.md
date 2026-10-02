# Finance Family REST API Backend

Standalone REST backend for Finance Family, replacing Firebase Cloud Functions.

## Overview

The backend provides REST endpoints for finance tools, with:

- **Authentication**: Firebase ID Token verification
- **Authorization**: Role-based access (derived from verified UID)
- **Security**: Input validation, output sanitization, error handling
- **Performance**: Optimized database queries with pagination

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│           (GitHub Pages / yosbany.github.io)                │
│                                                             │
│ - Authenticates with Firebase Auth                         │
│ - Obtains ID Token                                          │
│ - Calls REST API with Bearer token                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTPS + Authorization header
                 │
┌────────────────▼────────────────────────────────────────────┐
│           Reverse Proxy (Nginx/Caddy)                       │
│         https://service.nrdonline.site                      │
│                                                             │
│ - TLS termination                                           │
│ - Request/Response logging                                  │
│ - Rate limiting                                             │
│ - Forwards to backend on localhost:3001                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP localhost:3001
                 │
┌────────────────▼────────────────────────────────────────────┐
│              REST Backend (this)                            │
│            Node.js + Fastify + TypeScript                   │
│                                                             │
│ - Verifies Firebase ID Token                                │
│ - Executes finance tools                                    │
│ - Returns sanitized results                                │
│ - Accesses Firebase Realtime Database                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Firebase Admin SDK
                 │
┌────────────────▼────────────────────────────────────────────┐
│           Firebase Realtime Database                        │
│           (Real financial data)                             │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
server/
├── src/
│   ├── app/
│   │   └── app.ts                 # Fastify factory
│   ├── config/
│   │   └── env.ts                 # Configuration loading
│   ├── auth/
│   │   └── authenticatedContext.ts # Authentication
│   ├── firebase/
│   │   └── admin.ts               # Firebase Admin SDK
│   ├── finance/
│   │   ├── types/
│   │   │   └── transaction.ts      # Type definitions
│   │   ├── tools/
│   │   │   └── searchTransactions.ts # Main search tool
│   │   └── repositories/
│   │       └── transactions.repository.ts # Data access
│   ├── routes/
│   │   ├── health.routes.ts       # GET /health
│   │   └── tools.routes.ts        # POST /api/tools/*
│   ├── middleware/
│   │   ├── auth.middleware.ts     # Auth extraction
│   │   └── error.middleware.ts    # Error handling
│   └── server.ts                  # Entry point
├── .env.example                   # Configuration template
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── README.md                      # This file
├── SECURITY.md                    # Security documentation
└── Dockerfile                     # Container image

```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Firebase Admin credentials (service account)
- Valid Firebase project configured

### Installation

```bash
cd server
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Set required environment variables in `.env`:

```bash
NODE_ENV=development
PORT=3001
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,https://yosbany.github.io

# Firebase credentials must be set via GOOGLE_APPLICATION_CREDENTIALS
# (See Deployment section)
```

3. Set up Firebase credentials:

```bash
# For development/local testing:
export GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account.json
```

### Development

Start the development server with hot reload:

```bash
npm run dev
```

Server will start on `http://127.0.0.1:3001`

Test the health endpoint:

```bash
curl http://127.0.0.1:3001/health
```

### Build

Compile TypeScript:

```bash
npm run build
```

Output is in `dist/`

### Production Start

```bash
npm run start
```

## API Endpoints

### Health Check

```http
GET /health
```

Response (200):

```json
{
  "status": "ok",
  "timestamp": 1696262400000
}
```

### Search Transactions

```http
POST /api/tools/search-transactions
Authorization: Bearer <Firebase ID Token>
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

Response (200):

```json
{
  "transactions": [
    {
      "id": "tx-001",
      "accountId": "acc-123",
      "date": 1696262400000,
      "description": "Purchase at store",
      "amount": -150.50,
      "currency": "UYU",
      "type": "expense",
      "category": "shopping",
      "status": "classified"
    }
  ],
  "pagination": {
    "total": 150,
    "matched": 25,
    "offset": 0,
    "limit": 50,
    "truncated": false
  }
}
```

Error (401):

```json
{
  "error": "UNAUTHENTICATED",
  "message": "Invalid or expired token"
}
```

Error (400):

```json
{
  "error": "INVALID_ARGUMENT",
  "message": "limit must be between 1 and 500"
}
```

Error (403):

```json
{
  "error": "PERMISSION_DENIED",
  "message": "User not authorized for this operation"
}
```

## Authentication

The API uses **Firebase ID Token authentication**.

### Client-side (React)

```typescript
import { auth } from './services/firebase';

const currentUser = auth.currentUser;
const idToken = await currentUser.getIdToken();

const response = await fetch(
  'https://service.nrdonline.site/api/tools/search-transactions',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: 1000, to: 2000 })
  }
);
```

### Server-side (this API)

1. Extract token from `Authorization: Bearer <token>` header
2. Verify token with Firebase Admin SDK
3. Extract `uid` from verified token
4. Create `AuthenticatedContext { uid }`
5. Pass context to business logic (tools)
6. Tools use `uid` from context to query data

**Critical**: The `uid` is NEVER obtained from request body.

## Security

See [SECURITY.md](./SECURITY.md) for detailed security architecture.

Key points:

- ✅ All inputs validated server-side
- ✅ Prohibited parameters rejected (`uid`, `firebasePath`, etc.)
- ✅ Output sanitized (no sensitive data)
- ✅ Error messages don't expose internals
- ✅ Firebase Admin credentials never in code
- ✅ No stack traces in responses
- ✅ Logging doesn't contain secrets

## Deployment

### Docker

```bash
# Build image
docker build -t finance-family-backend .

# Run container
docker run \
  -p 127.0.0.1:3001:3001 \
  -e NODE_ENV=production \
  -e FIREBASE_PROJECT_ID=... \
  -e FIREBASE_DATABASE_URL=... \
  -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/service-account.json \
  -v /secure/path/service-account.json:/secrets/service-account.json:ro \
  finance-family-backend
```

### Manual VPS Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Docker Compose

See `docker-compose.yml` for local development setup with reverse proxy.

## Testing

### Health Check

```bash
curl http://127.0.0.1:3001/health
```

### With Valid Firebase Token

```bash
TOKEN=$(npm run get-token)  # Requires setup

curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

### Security Tests

```bash
# Without token (should fail)
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Content-Type: application/json" \
  -d '{"uid": "attempt-injection"}'

# Expected: 401 UNAUTHENTICATED

# With token but invalid parameter (should fail)
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uid": "injection-attempt"}'

# Expected: 400 SECURITY_VIOLATION
```

## Environment Variables

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| NODE_ENV | Yes | `development` | development or production |
| PORT | No | `3001` | Default: 3001 |
| FIREBASE_PROJECT_ID | Yes | `finance-family-tp` | From Firebase console |
| FIREBASE_DATABASE_URL | Yes | `https://project.firebaseio.com` | From Firebase console |
| ALLOWED_ORIGINS | No | `http://localhost:5173,...` | CORS origins |
| GOOGLE_APPLICATION_CREDENTIALS | Yes | `/path/to/service-account.json` | Service account file path |

## Troubleshooting

### Firebase Initialization Fails

**Error**: `Failed to initialize Firebase: GOOGLE_APPLICATION_CREDENTIALS not found`

**Solution**: 
```bash
export GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account.json
npm run dev
```

### Port Already in Use

**Error**: `Error: listen EADDRINUSE :::3001`

**Solution**:
```bash
# Change port
PORT=3002 npm run dev

# Or kill process using port
lsof -i :3001
kill -9 <PID>
```

### Database Connection Fails

**Error**: `DATABASE_URL is invalid`

**Solution**: Check `FIREBASE_DATABASE_URL` is correct:
```bash
echo $FIREBASE_DATABASE_URL
# Should be: https://project-id.firebaseio.com
```

### CORS Errors

**Error**: `Access to XMLHttpRequest blocked by CORS`

**Solution**: Add frontend origin to `ALLOWED_ORIGINS`:
```bash
ALLOWED_ORIGINS=http://localhost:5173,https://yosbany.github.io npm run dev
```

## Next Steps

- [ ] Deploy to VPS
- [ ] Configure reverse proxy (Nginx)
- [ ] Set up SSL/TLS certificate
- [ ] Connect to production Firebase project
- [ ] Implement monitoring and logging
- [ ] Set up health check monitoring
- [ ] Configure rate limiting
- [ ] Add request tracing
- [ ] Implement FASE 05 (LLM integration)

## Support

For issues, see:
- [SECURITY.md](./SECURITY.md) - Security architecture
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [Firebase Documentation](https://firebase.google.com/docs)

## License

Proprietary - Finance Family

---

Made with ❤️ and TypeScript
