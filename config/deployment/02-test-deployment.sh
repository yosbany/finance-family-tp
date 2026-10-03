#!/bin/bash
set -e

# Finance Family API - Deployment Testing Script
# Execute as: bash 02-test-deployment.sh https://service.nrdonline.site

echo "🧪 Finance Family API - Deployment Test Suite"
echo "=============================================="

SERVICE_URL="${1:-https://service.nrdonline.site}"

echo ""
echo "🎯 Testing endpoint: $SERVICE_URL"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

run_test() {
  local test_name="$1"
  local method="$2"
  local endpoint="$3"
  local expected_code="$4"
  local body="$5"
  
  ((test_count++))
  
  echo -n "Test $test_count: $test_name... "
  
  local response
  local http_code
  
  if [ -z "$body" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$SERVICE_URL$endpoint" 2>&1 || echo "")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$SERVICE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$body" 2>&1 || echo "")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body_response=$(echo "$response" | head -n-1)
  
  if [ "$http_code" = "$expected_code" ]; then
    echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
    ((pass_count++))
  else
    echo -e "${RED}❌ FAIL${NC} (HTTP $http_code, expected $expected_code)"
    ((fail_count++))
    if [ ! -z "$body_response" ]; then
      echo "   Response: $body_response"
    fi
  fi
}

# Test 1: Health check (public endpoint)
echo "═ PUBLIC ENDPOINTS"
run_test "GET /health" "GET" "/health" "200"

# Test 2: Missing auth header
echo ""
echo "═ AUTHENTICATION TESTS"
run_test "POST /api/tools/search-transactions without token" "POST" "/api/tools/search-transactions" "401" '{"limit": 10}'

# Test 3: Invalid token
run_test "POST /api/tools/search-transactions with invalid token" "POST" "/api/tools/search-transactions" "401" '{}' \
  -H "Authorization: Bearer invalid_token_12345"

echo ""
echo "═ SECURITY TESTS (Expected 400 or 401)"

# Test 4: UID Injection attempt
run_test "UID injection attempt" "POST" "/api/tools/search-transactions" "401" '{"uid": "other_user"}' \
  -H "Authorization: Bearer fake_token"

# Test 5: Path injection attempt
run_test "Path injection attempt" "POST" "/api/tools/search-transactions" "401" '{"firebasePath": "/users/other"}' \
  -H "Authorization: Bearer fake_token"

# Test 6: Unknown parameters should be handled gracefully
run_test "Unknown parameters (with invalid token)" "POST" "/api/tools/search-transactions" "401" '{"unknown_field": "value"}'

echo ""
echo "═ SUMMARY"
echo "=========================================="
echo -e "Total tests: $test_count"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"

if [ $fail_count -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed${NC}"
  exit 1
fi
