-- Issue #74: restricted-migrator-safe verification + privilege assert for audit_app.
--
-- Role ATTRIBUTE changes (CREATE/ALTER NOLOGIN, PASSWORD NULL) require a role
-- administrator and are intentionally OUT OF SCOPE for audit_migrator.
-- Fresh empty databases obtain NOLOGIN audit_app via bootstrap-prerequisites.sql.
-- Existing LOGIN/password roles must be repaired only through the separate
-- admin-harden path (scripts/audit-managed-staging/admin-harden-audit-app.sql)
-- before this migration is allowed to succeed.
--
-- This migration does NOT apply itself. Owner-approved migration runner only.
-- It never invents LOGIN, never hard-codes passwords, and never skips verification.

DO $verify_audit_app_nologin$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_app') THEN
    RAISE EXCEPTION
      'audit_app missing: run administrative bootstrap (bootstrap-prerequisites.sql) before migrations';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'audit_app'
      AND (
        rolcanlogin
        OR rolsuper
        OR rolcreatedb
        OR rolcreaterole
        OR rolreplication
        OR rolbypassrls
      )
  ) THEN
    RAISE EXCEPTION
      'audit_app is not a restricted NOLOGIN privilege role; run admin-harden-audit-app.sql under a role administrator, then retry migrations';
  END IF;
END
$verify_audit_app_nologin$;

GRANT USAGE ON SCHEMA public TO audit_app;
GRANT SELECT, INSERT ON audit_events TO audit_app;
GRANT SELECT, INSERT ON audit_hash_chain TO audit_app;
GRANT SELECT, INSERT, UPDATE ON audit_outbox TO audit_app;
GRANT SELECT, INSERT, UPDATE ON audit_metadata TO audit_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO audit_app;

REVOKE UPDATE, DELETE ON audit_events FROM audit_app;
REVOKE UPDATE, DELETE ON audit_hash_chain FROM audit_app;
REVOKE DELETE ON audit_outbox FROM audit_app;
