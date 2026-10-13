-- PREPARATION / ADMIN ONLY — not part of the restricted migrator allowlist.
-- Issue #74: repair an existing audit_app that was created LOGIN/password-capable
-- by older 002_roles revisions, or ensure NOLOGIN when role is missing.
--
-- Requires a role administrator (typically postgres with CREATEROLE, not audit_migrator).
-- Never hard-code passwords. Never run through runMigrations()/Cloud Run migrator job.
-- Live Cloud SQL execution requires a separate Owner apply authorization.
--
-- Collision with unexpected privilege roles fails closed for explicit reconciliation.

BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = pg_catalog, public;

DO $admin_harden_audit_app$
DECLARE
  actor pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO actor FROM pg_roles WHERE rolname = current_user;
  IF current_database() <> 'guardentra_audit'
     OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999
     OR actor.rolname = 'audit_migrator'
     OR actor.rolname = 'audit_app'
     OR actor.rolname = 'audit_runtime'
     OR (NOT actor.rolcreaterole AND NOT actor.rolsuper) THEN
    RAISE EXCEPTION 'admin-harden requires a role administrator outside migrator/app identities';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_app') THEN
    CREATE ROLE audit_app NOLOGIN INHERIT
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSE
    ALTER ROLE audit_app WITH NOLOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    ALTER ROLE audit_app WITH PASSWORD NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'audit_app'
      AND NOT rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreatedb
      AND NOT rolcreaterole
      AND NOT rolreplication
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'admin-harden verification failed for audit_app';
  END IF;
END
$admin_harden_audit_app$;
COMMIT;
