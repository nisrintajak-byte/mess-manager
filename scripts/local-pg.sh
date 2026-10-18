#!/usr/bin/env bash
# Start a throwaway local Postgres 16 for scripts/test-db.sh (Claude workspace only).
# Usage: source <(scripts/local-pg.sh)   → exports PGHOST/PGPORT/PGUSER
set -euo pipefail
BIN=/usr/lib/postgresql/16/bin
DIR=/var/tmp/pgtest
id postgres >/dev/null 2>&1 || useradd -m postgres
if [ ! -d "$DIR/data" ]; then
  mkdir -p "$DIR" && chown postgres "$DIR"
  su postgres -c "$BIN/initdb -D $DIR/data -A trust -U postgres >/dev/null"
fi
if ! su postgres -c "$BIN/pg_ctl -D $DIR/data status" >/dev/null 2>&1; then
  rm -f "$DIR/data/postmaster.pid"
  su postgres -c "$BIN/pg_ctl -D $DIR/data -o '-p 54329 -k $DIR' -l $DIR/log -w start" >/dev/null
fi
echo "export PGHOST=$DIR PGPORT=54329 PGUSER=postgres"
