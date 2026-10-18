#!/usr/bin/env bash
# Runs database migrations + behaviour tests against a throwaway Postgres database.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="mm_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

run() { psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null; }

run supabase/tests/local/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
psql -X -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/local/10_core_mvp_test.sql 2>&1 | grep -E "PASSED|ERROR|error"
