#!/usr/bin/env bash
# Run only against the disposable PostgreSQL 16 CI fixture, never live databases.
set -euo pipefail

if [[ "${PGHOST:-}" != '127.0.0.1' || "${PGDATABASE:-}" != 'guardentra_audit_ci' || "${PGUSER:-}" != 'postgres' ]]; then
  echo 'Refusing migration tests outside the local disposable CI fixture.' >&2
  exit 1
fi
unset PGSERVICE PGSERVICEFILE PGOPTIONS PGHOSTADDR
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

server_version="$(psql -X -A -t -v ON_ERROR_STOP=1 -c 'SHOW server_version_num')"
if [[ "$server_version" -lt 160000 || "$server_version" -ge 170000 ]]; then
  echo 'Migration acceptance requires PostgreSQL 16.' >&2
  exit 1
fi

for pass in 1 2; do
  for migration in migrations/audit/001_init.sql migrations/audit/002_roles.sql; do
    psql -X -v ON_ERROR_STOP=1 --single-transaction -f "$migration"
  done
  echo "Audit migrations execution pass $pass: PASS"
done

psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE ci_audit_login LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT audit_app TO ci_audit_login;
SQL

PGUSER=ci_audit_login psql -X -v ON_ERROR_STOP=1 --single-transaction -f scripts/audit-tests/role-contract.sql
echo 'Audit migration/append-only privilege contract: PASS'
