-- Issue #74: harden audit_app after 002_roles may have created a login-capable role.
-- Idempotent. Safe when PR #183 already created audit_app as NOLOGIN.
-- Managed environments MUST provision a separate login-capable role with a
-- secret-managed credential and GRANT audit_app TO that role. Never hard-code
-- credentials in migrations.
--
-- This migration does NOT apply itself. Owner-approved migration runner only.

DO $harden_audit_app$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_app') THEN
    ALTER ROLE audit_app WITH NOLOGIN;
    -- Clear any password left by older unsafe 002_roles revisions.
    ALTER ROLE audit_app WITH PASSWORD NULL;
  ELSE
    CREATE ROLE audit_app NOLOGIN;
  END IF;
END
$harden_audit_app$;

GRANT USAGE ON SCHEMA public TO audit_app;
GRANT SELECT, INSERT ON audit_events TO audit_app;
GRANT SELECT, INSERT ON audit_hash_chain TO audit_app;
GRANT SELECT, INSERT, UPDATE ON audit_outbox TO audit_app;
GRANT SELECT, INSERT, UPDATE ON audit_metadata TO audit_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO audit_app;

REVOKE UPDATE, DELETE ON audit_events FROM audit_app;
REVOKE UPDATE, DELETE ON audit_hash_chain FROM audit_app;
REVOKE DELETE ON audit_outbox FROM audit_app;
