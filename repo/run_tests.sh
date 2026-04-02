#!/bin/bash
# CHECC Unified Test Runner
# Works in three environments:
#   1. Local / CI bare host:  ./run_tests.sh  (installs deps, runs unit + standalone E2E)
#   2. Docker test-runner:    docker compose -f docker-compose.test.yml up (full stack)
#   3. Local + docker stack:  docker compose up -d && ./run_tests.sh (detects backend, runs full E2E)

set -e

echo "========================================="
echo "  CHECC — Unified Test Runner"
echo "========================================="
echo ""

# ── Detect environment ──────────────────────────────────────────
INSIDE_DOCKER=false
if [ -f "/.dockerenv" ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
  INSIDE_DOCKER=true
fi

# ── Install deps if needed (CI / fresh clone) ──────────────────
if [ ! -d "node_modules" ]; then
  echo "[0] Installing dependencies..."
  npm install 2>&1
  echo "    Done."
  echo ""
fi

FAILED=0

# ── 1. API unit + integration tests ───────────────────────────
echo "[1/4] API unit + integration tests..."
if npm run test:api 2>&1; then
  echo "  ✓ API tests PASSED"
else
  echo "  ✗ API tests FAILED"
  FAILED=1
fi
echo ""

# ── 2. Web unit + component tests ─────────────────────────────
echo "[2/4] Web unit + component tests..."
if npm run test:web 2>&1; then
  echo "  ✓ Web tests PASSED"
else
  echo "  ✗ Web tests FAILED"
  FAILED=1
fi
echo ""

# ── 3. Determine E2E strategy ─────────────────────────────────
# If FULL_STACK is already set (Docker test-runner), go straight to full-stack E2E.
# Otherwise, run standalone E2E first, then probe for a running backend.

if [ "${FULL_STACK}" = "true" ]; then
  # ── Docker test-runner path: wait for web, run full-stack E2E ──
  echo "[3/4] Full-stack E2E tests (Docker)..."

  # Wait for web container to be ready
  WEB_URL="${BASE_URL:-http://web:80}"
  echo "  Waiting for web server at ${WEB_URL}..."
  for i in $(seq 1 30); do
    if curl -sf "${WEB_URL}" > /dev/null 2>&1; then
      echo "  Web server ready."
      break
    fi
    echo "    attempt ${i}/30..."
    sleep 2
  done

  # Ensure Playwright chromium is available
  npx --yes playwright install chromium 2>/dev/null || true

  export BASE_URL="${WEB_URL}"
  if npm run test:e2e 2>&1; then
    echo "  ✓ Full-stack E2E PASSED"
  else
    echo "  ✗ Full-stack E2E FAILED"
    FAILED=1
  fi

else
  # ── Host path: standalone E2E, then optionally full-stack ──
  echo "[3/4] Standalone E2E tests..."
  echo "  Installing Playwright browsers..."
  npx --yes playwright install --with-deps chromium 2>&1 || true
  echo "  Building web app (vite preview needs a build)..."
  npm run build --workspace=apps/web 2>&1 || true

  if npm run test:e2e 2>&1; then
    echo "  ✓ Standalone E2E PASSED"
  else
    echo "  ✗ Standalone E2E FAILED"
    FAILED=1
  fi

  echo ""
  echo "[4/4] Checking for running backend..."
  STACK_URL="${BASE_URL:-http://localhost:5173}"
  if curl -sf --max-time 5 "${STACK_URL}/api/health" > /dev/null 2>&1; then
    echo "  Backend detected at ${STACK_URL} — running full-stack E2E..."
    export FULL_STACK=true
    export BASE_URL="${STACK_URL}"
    if npm run test:e2e 2>&1; then
      echo "  ✓ Full-stack E2E PASSED"
    else
      echo "  ✗ Full-stack E2E FAILED"
      FAILED=1
    fi
  else
    echo "  Backend not reachable — skipping full-stack E2E."
    echo "  (Start with: docker compose up -d)"
  fi
fi

echo ""
echo "========================================="
if [ $FAILED -ne 0 ]; then
  echo "  RESULT: SOME TESTS FAILED"
  exit 1
else
  echo "  ALL TESTS PASSED"
  echo "========================================="
  exit 0
fi
