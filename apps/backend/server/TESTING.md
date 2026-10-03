# Testing Guide for Finance Family Backend

## Unit Tests (Security Validation)

### searchTransactions Validation Tests

Test file location: `src/finance/tools/__tests__/searchTransactions.test.ts`

Tests validate:

1. ✅ Allowed parameters accepted
2. ❌ Prohibited parameters rejected (uid, userId, familyId, firebasePath, path)
3. ❌ Unknown parameters rejected
4. ❌ Type mismatches rejected
5. ❌ Range violations rejected
6. ❌ Invalid enumerations rejected

### Running Tests

```bash
npm test
```

## Integration Tests (Local Development)

### Prerequisites

1. Backend running: `npm run dev` (Terminal 1)
2. Firebase credentials available
3. Test user configured in Firebase

### Health Check

```bash
curl http://127.0.0.1:3001/health
```

Expected: `{"status":"ok"}`

### Test 1: Without Authentication

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: **401 UNAUTHENTICATED**

### Test 2: With Invalid Token

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer invalid-token-xyz" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: **401 UNAUTHENTICATED**

### Test 3: Parameter Injection - uid

```bash
# Get valid token first
TOKEN="<valid-firebase-id-token>"

curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uid": "other-user", "limit": 10}'
```

Expected: **400 SECURITY_VIOLATION: Parameter 'uid' is not allowed**

### Test 4: Parameter Injection - firebasePath

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firebasePath": "/users/other-user", "limit": 10}'
```

Expected: **400 SECURITY_VIOLATION: Parameter 'firebasePath' is not allowed**

### Test 5: Unknown Parameter

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"foo": "bar", "limit": 10}'
```

Expected: **400 INVALID_ARGUMENT: Unknown parameter 'foo'**

### Test 6: Invalid Limit (too high)

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000}'
```

Expected: **400 INVALID_ARGUMENT: limit must be between 1 and 500**

### Test 7: Invalid Limit (negative)

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": -1}'
```

Expected: **400 INVALID_ARGUMENT: limit must be between 1 and 500**

### Test 8: Invalid Date Range (from > to)

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from": 2000, "to": 1000}'
```

Expected: **400 INVALID_ARGUMENT: from must be <= to**

### Test 9: Invalid Amount Range (min > max)

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"minAmount": 1000, "maxAmount": 100}'
```

Expected: **400 INVALID_ARGUMENT: minAmount must be <= maxAmount**

### Test 10: Invalid Enum - type

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "invalid-type"}'
```

Expected: **400 INVALID_ARGUMENT: type must be 'income', 'expense', or 'transfer'**

### Test 11: Invalid Enum - currency

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currency": "EUR"}'
```

Expected: **400 INVALID_ARGUMENT: currency must be 'UYU' or 'USD'**

### Test 12: Invalid Enum - status

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid-status"}'
```

Expected: **400 INVALID_ARGUMENT: status must be 'pending', 'classified', or 'verified'**

### Test 13: Valid Request

```bash
curl -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 10,
    "offset": 0
  }' | jq
```

Expected: **200** with response:
```json
{
  "transactions": [...],
  "pagination": {
    "total": N,
    "matched": M,
    "offset": 0,
    "limit": 10,
    "truncated": false
  }
}
```

### Test 14: Data Isolation

Get two Firebase tokens (from different users if possible) and verify:

```bash
# User A
TOKEN_A="<user-a-token>"
RESULT_A=$(curl -s -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{}')

# User B
TOKEN_B="<user-b-token>"
RESULT_B=$(curl -s -X POST http://127.0.0.1:3001/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d '{}')

# Results should NOT contain each other's data
```

## Frontend Tests

### Test in Browser Console

```javascript
import { callSearchTransactions } from '@/services/agentApi.service';

// Test 1: Valid call
const result = await callSearchTransactions({ limit: 10 });
console.log('Result:', result);

// Test 2: Error handling
try {
  await callSearchTransactions({ uid: 'injection' });
} catch (error) {
  console.log('Error caught:', error.message);
}
```

## Load Testing

### Using Apache Bench

```bash
# Get a valid token first
TOKEN="<valid-firebase-id-token>"

# Test with 100 requests, concurrency 10
ab -c 10 -n 100 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -p body.json \
  http://127.0.0.1:3001/api/tools/search-transactions
```

### Using wrk

```bash
wrk -t4 -c100 -d30s \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --script=script.lua \
  http://127.0.0.1:3001/api/tools/search-transactions
```

## Docker Testing

### Build and Test

```bash
# Build
docker build -t finance-backend-test .

# Run
docker run -it --rm \
  -p 127.0.0.1:3001:3001 \
  -e NODE_ENV=development \
  -e FIREBASE_PROJECT_ID=finance-family-tp \
  -e FIREBASE_DATABASE_URL=https://finance-family-tp.firebaseio.com \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json \
  -v /path/to/service-account.json:/app/service-account.json:ro \
  finance-backend-test

# In another terminal
curl http://127.0.0.1:3001/health
```

## Automated Test Script

Create `test-security.sh`:

```bash
#!/bin/bash

set -e

API_URL="http://127.0.0.1:3001"
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "Usage: ./test-security.sh <firebase-token>"
  exit 1
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

test_endpoint() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  local expected_status=$5

  echo -n "Testing: $name... "

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  status=$(echo "$response" | tail -n1)

  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} ($status)"
    ((pass_count++))
  else
    echo -e "${RED}FAIL${NC} (expected $expected_status, got $status)"
    ((fail_count++))
  fi
}

# Run tests
test_endpoint "Health" "GET" "$API_URL/health" "" "200"
test_endpoint "No auth" "POST" "$API_URL/api/tools/search-transactions" "{}" "401"
test_endpoint "UID injection" "POST" "$API_URL/api/tools/search-transactions" '{"uid":"injection"}' "400"
test_endpoint "Unknown param" "POST" "$API_URL/api/tools/search-transactions" '{"foo":"bar"}' "400"
test_endpoint "Invalid limit" "POST" "$API_URL/api/tools/search-transactions" '{"limit":1000}' "400"
test_endpoint "Valid request" "POST" "$API_URL/api/tools/search-transactions" '{"limit":10}' "200"

echo ""
echo "Results: ${GREEN}$pass_count passed${NC}, ${RED}$fail_count failed${NC}"

if [ $fail_count -gt 0 ]; then
  exit 1
fi
```

Run it:

```bash
chmod +x test-security.sh
./test-security.sh "<firebase-token>"
```

## Production Verification

After deploying to VPS:

```bash
# Test health endpoint (public)
curl https://service.nrdonline.site/health

# Test authenticated endpoint
TOKEN="<firebase-id-token>"
curl -X POST https://service.nrdonline.site/api/tools/search-transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Check response time
time curl -s https://service.nrdonline.site/health

# Check certificate
openssl s_client -connect service.nrdonline.site:443 -servername service.nrdonline.site
```

## Performance Testing

### Measure Response Time

```bash
for i in {1..10}; do
  time curl -s http://127.0.0.1:3001/health > /dev/null
done
```

### Monitor Memory Usage

```bash
# While backend is running
watch -n 1 'ps aux | grep node | grep -v grep'
```

### Database Query Performance

Add timestamps to backend logs and measure:

```bash
# Look for: [duration: Xms] in logs
npm run dev | grep duration
```

## Testing Checklist

Before considering FASE 04B complete:

- [ ] Health endpoint returns 200
- [ ] Authentication required for /api/* endpoints
- [ ] Invalid tokens rejected (401)
- [ ] UID injection rejected (400)
- [ ] All prohibited parameters rejected
- [ ] Unknown parameters rejected
- [ ] Type validation working
- [ ] Range validation working
- [ ] Enumeration validation working
- [ ] Valid requests return 200
- [ ] Response has correct structure
- [ ] Data isolation verified (no cross-user data)
- [ ] Error messages don't expose internals
- [ ] Performance acceptable (< 500ms)
- [ ] Docker build succeeds
- [ ] Docker container starts
- [ ] VPS deployment successful
- [ ] HTTPS working with valid certificate
- [ ] Reverse proxy routing correct

---

Made with ❤️
