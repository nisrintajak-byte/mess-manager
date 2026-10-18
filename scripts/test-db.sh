#!/usr/bin/env bash
# Runs all migrations + each behaviour test file against its own throwaway Postgres database.
# Usage: eval "$(scripts/local-pg.sh)" && scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

failed=0
for t in supabase/tests/local/[1-9]*_test.sql; do
  DB="mm_test_$$_$(basename "$t" .sql)"
  createdb "$DB"
  {
    psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/local/00_supabase_stub.sql >/dev/null
    for f in supabase/migrations/*.sql; do psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f "$f" >/dev/null; done
    out=$(psql -X -v ON_ERROR_STOP=1 -d "$DB" -f "$t" 2>&1) || true
  }
  dropdb --if-exists "$DB"
  if grep -q "ALL DB TESTS PASSED" <<<"$out"; then
    echo "PASS $(basename "$t")"
  else
    echo "FAIL $(basename "$t")"
    grep -E "ERROR:" <<<"$out" | head -5
    # surface the reason as an annotation in GitHub Actions (logs are not always readable)
    if [ -n "${GITHUB_ACTIONS:-}" ]; then
      grep -E "ERROR:" <<<"$out" | head -3 | sed "s/^/::error title=$(basename "$t")::/"
    fi
    failed=1
  fi
done
if [ "$failed" = 0 ]; then echo "ALL DB TESTS PASSED"; else exit 1; fi
