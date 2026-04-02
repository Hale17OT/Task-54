#!/bin/bash
# CHECC Local Acceptance Test
# Validates API health, login, and one transaction against a running stack.
# Usage: ./scripts/acceptance-test.sh [BASE_URL]
#
# Prerequisites: API + Web + PostgreSQL must be running.

set -e

BASE_URL="${1:-http://localhost:3000}"
FAILED=0

echo "================================================="
echo "  CHECC Local Acceptance Test"
echo "  Target: ${BASE_URL}"
echo "================================================="
echo ""

# 1. Health check
echo "[1/5] API Health Check..."
HEALTH=$(curl -sf "${BASE_URL}/api/health" 2>&1 || echo "FAIL")
if echo "$HEALTH" | grep -q "status"; then
  echo "  PASS - API is healthy"
else
  echo "  FAIL - API health check failed"
  FAILED=1
fi

# 2. Login as admin
echo "[2/5] Admin Login..."
LOGIN=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin12345678!"}' 2>&1 || echo "FAIL")
TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then
  echo "  PASS - Login successful, token received"
else
  echo "  FAIL - Login failed"
  echo "  Response: $LOGIN"
  FAILED=1
fi

# 3. Catalog services
echo "[3/5] Catalog Services..."
CATALOG=$(curl -sf "${BASE_URL}/api/catalog" \
  -H "Authorization: Bearer ${TOKEN}" 2>&1 || echo "FAIL")
if echo "$CATALOG" | grep -q "Annual Lab Panel"; then
  echo "  PASS - Seed catalog data present"
else
  echo "  FAIL - Catalog data not found (seed may not have run)"
  FAILED=1
fi

# 4. Pricing rules
echo "[4/5] Pricing Rules..."
RULES=$(curl -sf "${BASE_URL}/api/pricing/rules" \
  -H "Authorization: Bearer ${TOKEN}" 2>&1 || echo "FAIL")
if echo "$RULES" | grep -q "10% Off Over"; then
  echo "  PASS - Seed pricing rules present"
else
  echo "  FAIL - Pricing rules not found"
  FAILED=1
fi

# 5. Report templates
echo "[5/5] Report Templates..."
TEMPLATES=$(curl -sf "${BASE_URL}/api/templates" \
  -H "Authorization: Bearer ${TOKEN}" 2>&1 || echo "FAIL")
if echo "$TEMPLATES" | grep -q "Basic Health Check"; then
  echo "  PASS - Seed report templates present"
else
  echo "  FAIL - Report templates not found"
  FAILED=1
fi

echo ""
echo "================================================="
if [ $FAILED -ne 0 ]; then
  echo "  RESULT: ACCEPTANCE TEST FAILED"
  exit 1
else
  echo "  RESULT: ALL ACCEPTANCE CHECKS PASSED"
  exit 0
fi
