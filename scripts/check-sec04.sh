#!/usr/bin/env bash
# SEC-04: ensure no service role key string is bundled into the frontend dist/.
# Returns exit code 0 when bundle is clean, exit code 1 when leak detected.
# Run from repo root: bash scripts/check-sec04.sh
set -e

DIST_DIR="${DIST_DIR:-apps/frontend/dist}"
if [ ! -d "$DIST_DIR" ]; then
  echo "OK — $DIST_DIR does not exist yet (no build to scan)"
  exit 0
fi

# Patterns that would indicate the service role key leaked into the bundle.
# Vite only exposes VITE_-prefixed env vars, so SUPABASE_SERVICE_ROLE_KEY
# should never appear in dist/ if env vars are named correctly.
if grep -rE "service[_.-]role|SUPABASE_SERVICE_ROLE_KEY" "$DIST_DIR" > /dev/null 2>&1; then
  echo "ERROR: service role key reference found in $DIST_DIR"
  grep -rnE "service[_.-]role|SUPABASE_SERVICE_ROLE_KEY" "$DIST_DIR"
  exit 1
fi

echo "OK — no service role key leak in $DIST_DIR"
exit 0
