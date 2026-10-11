#!/usr/bin/env bash
# Aplica las migraciones sobre un PostgreSQL local con un "stub" de Supabase y
# ejecuta las pruebas de RLS. Requiere psql y un servidor PostgreSQL accesible.
#   PGURL=postgres://usuario:clave@localhost:5432/postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
PGURL="${PGURL:-postgres://postgres@localhost:5432/postgres}"
DB="snackeats_test_$$"
psql "$PGURL" -v ON_ERROR_STOP=1 -q -c "create database $DB"
trap 'psql "$PGURL" -q -c "drop database if exists $DB" >/dev/null' EXIT
TEST_URL="${PGURL%/*}/$DB"
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/rls_test.sql
