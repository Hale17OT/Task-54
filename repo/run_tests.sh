#!/bin/bash
set -e

echo "================================================="
echo "  CHECC - Unified Test Runner"
echo "================================================="
echo ""

FAILED=0

# Unit & Integration tests - API
echo "[1/4] Running API tests..."
if npm run test:api -- --coverage 2>&1; then
  echo "  API tests PASSED"
else
  echo "  API tests FAILED"
  FAILED=1
fi

echo ""

# Unit tests - Web
echo "[2/4] Running Web tests..."
if npm run test:web 2>&1; then
  echo "  Web tests PASSED"
else
  echo "  Web tests FAILED"
  FAILED=1
fi

echo ""

# E2E tests - Standalone (always run, no backend needed)
echo "[3/4] Running E2E standalone tests..."
echo "  Checking Playwright browser installation..."
npx playwright install chromium 2>&1 || true
if npm run test:e2e 2>&1; then
  echo "  E2E standalone tests PASSED (full-stack tests skipped unless FULL_STACK=true)"
else
  echo "  E2E standalone tests FAILED"
  FAILED=1
fi

echo ""

# E2E tests - Full Stack (only if backend is reachable)
echo "[4/4] Checking for full-stack E2E gate..."
API_URL="${BASE_URL:-http://localhost:5173}"
if curl -s --max-time 3 "${API_URL}/api/health" > /dev/null 2>&1; then
  echo "  Backend detected at ${API_URL} — running full-stack E2E tests..."
  export FULL_STACK=true
  if npm run test:e2e 2>&1; then
    echo "  Full-stack E2E tests PASSED"
  else
    echo "  Full-stack E2E tests FAILED"
    FAILED=1
  fi
else
  echo "  Backend not reachable at ${API_URL}/api/health — skipping full-stack E2E."
  echo "  To run full-stack tests: start the stack (docker compose up) then re-run."
fi

echo ""
echo "================================================="
if [ $FAILED -ne 0 ]; then
  echo "  RESULT: SOME TESTS FAILED"
  exit 1
else
  echo "  RESULT: ALL TESTS PASSED"
  exit 0
fi
