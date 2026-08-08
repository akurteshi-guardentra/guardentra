#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_app') THEN
      CREATE ROLE audit_app LOGIN PASSWORD 'audit_app';
    END IF;
  END
  \$\$;
  GRANT CONNECT ON DATABASE guardentra_audit TO audit_app;
EOSQL
