-- Synthetic fixture only. The runner connects as a distinct, unprivileged LOGIN.
DO $contract$
BEGIN
  IF current_user <> 'ci_audit_login' OR session_user <> 'ci_audit_login' THEN
    RAISE EXCEPTION 'Privilege tests must authenticate as the application login';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_app' AND NOT rolcanlogin
      AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN
    RAISE EXCEPTION 'audit_app must remain a non-login, unprivileged role';
  END IF;
END
$contract$;

INSERT INTO audit_events (event_id, tenant_id, event_type)
VALUES ('00000000-0000-4000-8000-000000000074', 'ci-only', 'migration_test');
INSERT INTO audit_hash_chain (tenant_id, event_id, seq, hash, previous_hash)
VALUES ('ci-only', '00000000-0000-4000-8000-000000000074', 1, 'synthetic', 'synthetic');
INSERT INTO audit_outbox (event_id, tenant_id, payload)
VALUES ('00000000-0000-4000-8000-000000000074', 'ci-only', '{}');
UPDATE audit_outbox SET status = 'acked', attempts = 1 WHERE tenant_id = 'ci-only';
INSERT INTO audit_metadata (tenant_id, key, value) VALUES ('ci-only', 'test', 'initial');
UPDATE audit_metadata SET value = 'updated' WHERE tenant_id = 'ci-only';

DO $contract$
DECLARE
  denied_statement text;
BEGIN
  IF (SELECT count(*) FROM audit_events WHERE tenant_id = 'ci-only') <> 1
      OR (SELECT count(*) FROM audit_hash_chain WHERE tenant_id = 'ci-only') <> 1
      OR (SELECT count(*) FROM audit_outbox WHERE tenant_id = 'ci-only' AND status = 'acked') <> 1
      OR (SELECT count(*) FROM audit_metadata WHERE tenant_id = 'ci-only' AND value = 'updated') <> 1 THEN
    RAISE EXCEPTION 'Allowed application operations did not persist';
  END IF;

  BEGIN
    INSERT INTO audit_events (event_id, tenant_id, event_type)
    VALUES ('00000000-0000-4000-8000-000000000074', 'ci-only', 'duplicate');
    RAISE EXCEPTION 'Duplicate event_id was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  FOREACH denied_statement IN ARRAY ARRAY[
    'UPDATE audit_events SET event_type = ''tampered''',
    'DELETE FROM audit_events',
    'TRUNCATE audit_events',
    'UPDATE audit_hash_chain SET hash = ''tampered''',
    'DELETE FROM audit_hash_chain',
    'TRUNCATE audit_hash_chain',
    'DELETE FROM audit_outbox',
    'DELETE FROM audit_metadata',
    'SELECT * FROM schema_migrations',
    'CREATE TABLE public.ci_forbidden (id integer)',
    'ALTER TABLE audit_events ADD COLUMN ci_forbidden integer',
    'DROP TABLE audit_hash_chain',
    'SET ROLE postgres'
  ] LOOP
    BEGIN
      EXECUTE denied_statement;
      RAISE EXCEPTION 'Forbidden application operation succeeded: %', denied_statement;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
END
$contract$;
