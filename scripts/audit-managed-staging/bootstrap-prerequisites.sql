-- PREPARATION ONLY: no credential provisioning or cloud execution is authorized.
-- One-time empty-database bootstrap. Collisions/repeats fail; never adopt/alter roles.
-- LOGIN/password provisioning and the live execution packet are separate steps.
BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = pg_catalog, public;

DO $audit_bootstrap_guard$
DECLARE
  actor pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO actor FROM pg_roles WHERE rolname = current_user;
  IF current_database() <> 'guardentra_audit'
     OR current_user <> 'postgres' OR session_user <> 'postgres'
     OR current_setting('server_version_num')::integer NOT BETWEEN 160000 AND 169999
     OR actor.rolsuper OR NOT actor.rolcreaterole THEN
    RAISE EXCEPTION 'Restricted bootstrap identity/target check failed';
  END IF;
  IF NOT pg_try_advisory_xact_lock(740016, 1) THEN
    RAISE EXCEPTION 'Another audit execution holds the lock';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = current_database()
      AND pg_has_role(current_user, datdba, 'USAGE'))
     OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public'
      AND pg_has_role(current_user, nspowner, 'USAGE'))
     OR NOT has_database_privilege(current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'Bootstrap database/schema ownership prerequisite missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
      ('audit_app', 'audit_migrator', 'audit_runtime')) THEN
    RAISE EXCEPTION 'Audit role collision requires explicit reconciliation';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public' AND oid IN (
      SELECT relnamespace FROM pg_class UNION SELECT pronamespace FROM pg_proc
      UNION SELECT typnamespace FROM pg_type UNION SELECT collnamespace FROM pg_collation
      UNION SELECT oprnamespace FROM pg_operator UNION SELECT connamespace FROM pg_conversion
      UNION SELECT opcnamespace FROM pg_opclass UNION SELECT opfnamespace FROM pg_opfamily))
     OR EXISTS (SELECT 1 FROM pg_extension WHERE extname <> 'plpgsql')
     OR EXISTS (SELECT 1 FROM pg_namespace WHERE left(nspname, 3) <> 'pg_'
      AND nspname NOT IN ('public', 'information_schema'))
     OR EXISTS (SELECT 1 FROM pg_event_trigger) THEN
    RAISE EXCEPTION 'Bootstrap requires a fresh empty database';
  END IF;
END
$audit_bootstrap_guard$;

CREATE ROLE audit_app NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE audit_migrator NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE audit_runtime NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE EXTENSION pgcrypto WITH SCHEMA public;

GRANT audit_app TO audit_runtime WITH INHERIT TRUE;
GRANT audit_app TO audit_runtime WITH SET FALSE;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

DO $audit_bootstrap_ownership$
BEGIN
  -- Non-superuser ownership transfer requires temporary CREATE and SET privileges.
  EXECUTE format('GRANT CREATE ON DATABASE %I TO audit_migrator', current_database());
  GRANT audit_migrator TO postgres WITH SET TRUE;
  ALTER SCHEMA public OWNER TO audit_migrator;
  EXECUTE format('REVOKE CREATE ON DATABASE %I FROM audit_migrator', current_database());
  GRANT audit_migrator TO postgres WITH SET FALSE;
  GRANT audit_migrator TO postgres WITH INHERIT FALSE;
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO audit_migrator, audit_runtime', current_database());
END
$audit_bootstrap_ownership$;

DO $audit_bootstrap_verify$
BEGIN
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN
      ('audit_app', 'audit_migrator', 'audit_runtime') AND NOT rolcanlogin
      AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolreplication AND NOT rolbypassrls) <> 3
     OR EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
      WHERE r.rolname IN ('audit_app', 'audit_migrator'))
     OR (SELECT count(*) FROM pg_auth_members m
      JOIN pg_roles parent ON parent.oid = m.roleid
      JOIN pg_roles child ON child.oid = m.member
      WHERE child.rolname = 'audit_runtime') <> 1
     OR NOT EXISTS (SELECT 1 FROM pg_auth_members m
      JOIN pg_roles parent ON parent.oid = m.roleid
      JOIN pg_roles child ON child.oid = m.member
      WHERE parent.rolname = 'audit_app' AND child.rolname = 'audit_runtime'
      AND m.inherit_option AND NOT m.set_option AND NOT m.admin_option)
     OR NOT EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner
      WHERE n.nspname = 'public' AND r.rolname = 'audit_migrator')
     OR has_database_privilege('audit_migrator', current_database(), 'CREATE')
     OR has_database_privilege('audit_runtime', current_database(), 'CREATE')
     OR has_database_privilege('audit_runtime', current_database(), 'TEMP')
     OR has_schema_privilege('audit_runtime', 'public', 'CREATE')
     OR NOT has_schema_privilege('audit_migrator', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Bootstrap privilege verification failed';
  END IF;
END
$audit_bootstrap_verify$;
COMMIT;
