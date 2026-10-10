import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export function migrationDigest(sql) {
  // Git's Windows checkout can use CRLF; hash canonical LF SQL text.
  return createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
}

export async function prepareMigrations(dir, manifest) {
  const expected = ['001_init.sql', '002_roles.sql'];
  const actual = (await readdir(dir)).filter(name => name.endsWith('.sql')).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected) ||
      JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(expected)) {
    throw new Error('Migration set differs from reviewed manifest');
  }
  return Promise.all(expected.map(async id => {
    const sql = await readFile(path.join(dir, id), 'utf8');
    const sha256 = migrationDigest(sql);
    if (sha256 !== manifest[id]) throw new Error('Migration checksum mismatch');
    return { id, sql, sha256 };
  }));
}

export function managedConfig(env) {
  const instance = 'guardentra-staging:us-central1:guardentra-staging-audit';
  if (env.AUDIT_INSTANCE_CONNECTION_NAME !== instance ||
      env.AUDIT_DATABASE_NAME !== 'guardentra_audit' ||
      env.AUDIT_DATABASE_USER !== 'audit_migrator' ||
      env.CLOUD_RUN_JOB !== 'guardentra-audit-migrator-74' ||
      !env.AUDIT_MIGRATOR_PASSWORD ||
      env.AUDIT_DATABASE_URL || env.AUDIT_DATABASE_URL_MIGRATOR ||
      env.GOOGLE_APPLICATION_CREDENTIALS || env.GOOGLE_CREDENTIALS ||
      env.GOOGLE_OAUTH_ACCESS_TOKEN) {
    throw new Error('Managed staging configuration rejected');
  }
  return { instance, database: 'guardentra_audit', user: 'audit_migrator',
    password: env.AUDIT_MIGRATOR_PASSWORD };
}

export async function runMigrations(client, migrations, database = 'guardentra_audit') {
  const { rows: [identity] } = await client.query(`
    SELECT current_database() AS database, current_user AS actor, session_user AS session,
      current_setting('server_version_num')::integer AS version,
      r.rolcanlogin, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls
    FROM pg_roles r WHERE r.rolname = current_user`);
  if (!identity || identity.database !== database || identity.actor !== 'audit_migrator' ||
      identity.session !== 'audit_migrator' || identity.version < 160000 ||
      identity.version >= 170000 || !identity.rolcanlogin || identity.rolsuper ||
      identity.rolcreatedb || identity.rolcreaterole || identity.rolreplication ||
      identity.rolbypassrls) throw new Error('Restricted migrator identity check failed');
  const memberships = await client.query(`SELECT rolname FROM pg_roles
    WHERE rolname <> current_user AND pg_has_role(current_user, oid, 'MEMBER')`);
  if (memberships.rowCount) throw new Error('Unexpected migrator role membership');
  const inheritedAppRoles = await client.query(`SELECT rolname FROM pg_roles
    WHERE rolname <> 'audit_app' AND pg_has_role('audit_app', oid, 'MEMBER')`);
  if (inheritedAppRoles.rowCount) throw new Error('Unexpected application privilege-role membership');
  const prereqs = await client.query(`SELECT
    EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner
      WHERE n.nspname = 'public' AND r.rolname = 'audit_migrator') AS owns_schema,
    EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS extension_ready,
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_app' AND NOT rolcanlogin
      AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
      AND NOT rolreplication AND NOT rolbypassrls) AS role_ready`);
  if (Object.values(prereqs.rows[0]).some(value => value !== true)) {
    throw new Error('Administrative bootstrap prerequisites missing');
  }
  await client.query("SET statement_timeout = '60s'");
  await client.query("SET lock_timeout = '10s'");
  await client.query("SET search_path = public, pg_catalog");
  const { rows: [lock] } = await client.query('SELECT pg_try_advisory_lock(740016, 1) AS acquired');
  if (!lock.acquired) throw new Error('Another migration execution holds the lock');
  let applied = 0;
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(), sha256 TEXT NOT NULL)`);
    const owner = await client.query(`SELECT tableowner FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'schema_migrations'`);
    if (owner.rows[0]?.tableowner !== 'audit_migrator') throw new Error('Migration history ownership mismatch');
    // Legacy history without hashes must fail for explicit reconciliation, never infer hashes.
    const history = await client.query('SELECT id, sha256 FROM public.schema_migrations');
    const expected = new Map(migrations.map(m => [m.id, m.sha256]));
    for (const row of history.rows) {
      if (!expected.has(row.id) || expected.get(row.id) !== row.sha256) {
        throw new Error('Existing migration history checksum mismatch');
      }
    }
    const existing = new Set(history.rows.map(row => row.id));
    for (const migration of migrations) {
      if (existing.has(migration.id)) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO public.schema_migrations (id, sha256) VALUES ($1, $2)',
          [migration.id, migration.sha256]);
        await client.query('COMMIT');
        applied++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return { applied, skipped: migrations.length - applied };
  } finally {
    await client.query('SELECT pg_advisory_unlock(740016, 1)');
  }
}
