#!/bin/bash
set -e

echo "================================================="
echo "  CHECC — Docker Full Test Suite"
echo "  Runs: API tests + Web tests + Full-stack E2E"
echo "================================================="
echo ""

# Build and run all services + test runner
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test-runner

EXIT_CODE=$?

# Clean up
docker compose -f docker-compose.test.yml down -v

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "================================================="
  echo "  ALL TESTS PASSED"
  echo "================================================="
else
  echo ""
  echo "================================================="
  echo "  TESTS FAILED (exit code: $EXIT_CODE)"
  echo "================================================="
fi

exit $EXIT_CODE
