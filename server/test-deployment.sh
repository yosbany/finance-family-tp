#!/bin/bash

################################################################################
# Finance Family Backend Deployment Test Script
# 
# Tests all critical components after deployment
#
# Usage:
#   ./test-deployment.sh https://service.nrdonline.site <firebase_id_token>
#
################################################################################

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${1:-}"
ID_TOKEN="${2:-}"

test_count=0
passed_count=0
failed_count=0

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

# Test helper
run_test() {
    local test_name="$1"
    local expected_code="$2"
    local request_args=("${@:3}")
    
    ((test_count++))
    
    log_info "Test $test_count: $test_name"
    
    response=$(curl -s -w "\n%{http_code}" "${request_args[@]}" || true)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [[ "$http_code" == "$expected_code" ]]; then
        ((passed_count++))
        log_success "HTTP $http_code (expected $expected_code)"
        if [[ -n "$body" ]]; then
            echo "  Response: ${body:0:100}..."
        fi
    else
        ((failed_count++))
        log_error "HTTP $http_code (expected $expected_code)"
        if [[ -n "$body" ]]; then
            echo "  Response: $body"
        fi
    fi
    echo ""
}

# Validate inputs
if [[ -z "$BASE_URL" ]]; then
    log_error "Usage: $0 <base_url> [firebase_id_token]"
    log_info "Example: $0 https://service.nrdonline.site eyJhbGc..."
    exit 1
fi

# Ensure URL starts with https:// or http://
if ! [[ "$BASE_URL" =~ ^https?:// ]]; then
    BASE_URL="https://$BASE_URL"
fi

# Remove trailing slash
BASE_URL="${BASE_URL%/}"

log_info "===== Finance Family Backend Tests ====="
log_info "Base URL: $BASE_URL"
if [[ -n "$ID_TOKEN" ]]; then
    log_info "Firebase ID Token: ${ID_TOKEN:0:20}..."
fi
echo ""

# ============================================================================
# SECTION 1: HEALTH CHECK
# ============================================================================

log_info "SECTION 1: Health Check"
echo "--------"

run_test "GET /health (no auth)" "200" \
    -X GET "$BASE_URL/health"

# ============================================================================
# SECTION 2: AUTHENTICATION
# ============================================================================

log_info "SECTION 2: Authentication"
echo "--------"

# Without token
run_test "POST /api/tools/search-transactions (no token)" "401" \
    -X POST "$BASE_URL/api/tools/search-transactions" \
    -H "Content-Type: application/json" \
    -d '{"limit": 5}'

# Invalid token
run_test "POST /api/tools/search-transactions (invalid token)" "401" \
    -X POST "$BASE_URL/api/tools/search-transactions" \
    -H "Authorization: Bearer invalid.token.here" \
    -H "Content-Type: application/json" \
    -d '{"limit": 5}'

# ============================================================================
# SECTION 3: AUTHORIZED REQUEST (if token provided)
# ============================================================================

if [[ -n "$ID_TOKEN" ]]; then
    log_info "SECTION 3: Authorized Request"
    echo "--------"
    
    run_test "POST /api/tools/search-transactions (valid token)" "200" \
        -X POST "$BASE_URL/api/tools/search-transactions" \
        -H "Authorization: Bearer $ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"limit": 5}'
fi

# ============================================================================
# SECTION 4: INPUT VALIDATION & SECURITY
# ============================================================================

log_info "SECTION 4: Input Validation & Security"
echo "--------"

# UID Injection
run_test "Security: UID injection attempt" "400" \
    -X POST "$BASE_URL/api/tools/search-transactions" \
    -H "Authorization: Bearer $ID_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"uid": "other_user", "limit": 5}' \
    2>/dev/null || true

# Unknown argument
run_test "Security: Unknown argument" "400" \
    -X POST "$BASE_URL/api/tools/search-transactions" \
    -H "Authorization: Bearer $ID_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"foo": "bar", "limit": 5}' \
    2>/dev/null || true

# ============================================================================
# SECTION 5: CORS
# ============================================================================

log_info "SECTION 5: CORS Headers"
echo "--------"

response=$(curl -s -i -X OPTIONS "$BASE_URL/api/tools/search-transactions" \
    -H "Origin: https://yosbany.github.io" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type, authorization" 2>/dev/null || true)

if echo "$response" | grep -q "Access-Control-Allow-Origin"; then
    log_success "CORS headers present"
    echo "$response" | grep "Access-Control-Allow" || true
else
    log_warning "CORS headers not found in response"
fi
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

log_info "===== Test Summary ====="
log_info "Total Tests: $test_count"
log_success "Passed: $passed_count"
log_error "Failed: $failed_count"
echo ""

if [[ $failed_count -eq 0 ]]; then
    log_success "All tests passed! ✓"
    exit 0
else
    log_error "Some tests failed"
    exit 1
fi
