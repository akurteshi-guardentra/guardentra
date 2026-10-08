-- Append-only application privilege role grants (run as migrator after 001_init).
-- Managed environments MUST provision a separate LOGIN role with a secret-managed
-- credential and GRANT this NOLOGIN role to it. Never hard-code a staging password
-- in migrations or Terraform state.
DO $audit_roles$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_app') THEN
    CREATE ROLE audit_app NOLOGIN;
  END IF;
END
$audit_roles$;

GRANT USAGE ON SCHEMA public TO audit_app;
GRANT SELECT, INSERT ON audit_events TO audit_app;
GRANT SELECT, INSERT ON audit_hash_chain TO audit_app;
GRANT SELECT, INSERT, UPDATE ON audit_outbox TO audit_app;
GRANT SELECT, INSERT, UPDATE ON audit_metadata TO audit_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO audit_app;

REVOKE UPDATE, DELETE ON audit_events FROM audit_app;
REVOKE UPDATE, DELETE ON audit_hash_chain FROM audit_app;
REVOKE DELETE ON audit_outbox FROM audit_app;
