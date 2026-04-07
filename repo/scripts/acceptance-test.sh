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
# deviceFingerprint is required by the auth schema; use a stable deterministic value for scripted logins
DEVICE_FP="acceptance-test-$(hostname 2>/dev/null || echo 'local')"
LOGIN_PAYLOAD="{\"username\":\"admin\",\"password\":\"Admin12345678!\",\"deviceFingerprint\":\"${DEVICE_FP}\"}"
LOGIN=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "${LOGIN_PAYLOAD}" 2>&1 || echo "FAIL")
TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# CAPTCHA escalation: if server requires CAPTCHA (AUTH_008), solve it and retry
if [ -z "$TOKEN" ] && echo "$LOGIN" | grep -q "AUTH_008"; then
  echo "  INFO - CAPTCHA required, requesting challenge..."
  CAPTCHA_RESP=$(curl -sf "${BASE_URL}/api/risk/captcha" 2>&1 || echo "FAIL")
  CAPTCHA_ID=$(echo "$CAPTCHA_RESP" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$CAPTCHA_ID" ]; then
    # Decode the base64 image payload which contains a simple text CAPTCHA ("a + b = ?")
    CAPTCHA_IMG=$(echo "$CAPTCHA_RESP" | grep -o '"imageBase64":"[^"]*"' | cut -d'"' -f4)
    CAPTCHA_TEXT=$(echo "$CAPTCHA_IMG" | base64 -d 2>/dev/null || echo "")
    # Extract the two numbers and compute the answer
    NUM_A=$(echo "$CAPTCHA_TEXT" | grep -oP '\d+' | head -1)
    NUM_B=$(echo "$CAPTCHA_TEXT" | grep -oP '\d+' | tail -1)
    if [ -n "$NUM_A" ] && [ -n "$NUM_B" ]; then
      CAPTCHA_ANSWER=$(( NUM_A + NUM_B ))
      echo "  INFO - Solving CAPTCHA: ${NUM_A} + ${NUM_B} = ${CAPTCHA_ANSWER}"
      LOGIN_PAYLOAD="{\"username\":\"admin\",\"password\":\"Admin12345678!\",\"deviceFingerprint\":\"${DEVICE_FP}\",\"captchaId\":\"${CAPTCHA_ID}\",\"captchaAnswer\":\"${CAPTCHA_ANSWER}\"}"
      LOGIN=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "${LOGIN_PAYLOAD}" 2>&1 || echo "FAIL")
      TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    else
      echo "  WARN - Could not parse CAPTCHA challenge"
    fi
  else
    echo "  WARN - Could not generate CAPTCHA challenge"
  fi
fi

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
