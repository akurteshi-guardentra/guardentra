// Real disposable PostgreSQL only. This is not a live SQL execution entry point.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (process.env.PGHOST !== '127.0.0.1' || process.env.PGPORT !== '5432' ||
    process.env.PGUSER !== 'postgres' || process.env.PGDATABASE !== 'guardentra_audit_bootstrap_ci') {
  throw new Error('Refusing bootstrap test outside disposable fixture');
}
for (const key of ['PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGHOSTADDR', 'PGPASSWORD']) {
  if (process.env[key]) throw new Error('Unexpected fixture override');
}
const config = { host: '127.0.0.1', port: 5432, database: 'guardentra_audit_bootstrap_ci',
  connectionTimeoutMillis: 10000, ssl: false };
const source = await readFile(new URL('./bootstrap-prerequisites.sql', import.meta.url), 'utf8');
if (source.split("'guardentra_audit'").length !== 2) throw new Error('Bootstrap target guard changed');
const sql = source.replace("'guardentra_audit'", "'guardentra_audit_bootstrap_ci'");

test('non-superuser bootstrap checks target, collisions, rollback and locked-down roles', async () => {
  const initial = new pg.Client({ ...config, user: 'postgres' });
  const admin = new pg.Client({ ...config, user: 'postgres' });
  const root = new pg.Client({ ...config, user: 'bootstrap_ci_root' });
  let rootConnected = false;
  await initial.connect();
  const rejected = async (client, text, pattern) => {
    try { await assert.rejects(client.query(text), pattern); }
    finally { await client.query('ROLLBACK'); }
  };
  try {
    await initial.query('CREATE ROLE bootstrap_ci_root LOGIN SUPERUSER');
    await root.connect(); rootConnected = true;
    // PostgreSQL's original bootstrap OID cannot lose SUPERUSER. Rename that
    // fixture identity, then create the distinct limited postgres actor to test.
    await initial.end();
    await root.query(`ALTER ROLE postgres RENAME TO bootstrap_ci_initial_root;
      CREATE ROLE postgres LOGIN NOSUPERUSER CREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;
      ALTER DATABASE guardentra_audit_bootstrap_ci OWNER TO postgres;`);
    await admin.connect();
    assert.equal((await admin.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper, false);

    const wrongDatabase = new pg.Client({ ...config, user: 'postgres', database: 'postgres' });
    await wrongDatabase.connect();
    try { await rejected(wrongDatabase, sql, /identity\/target/); }
    finally { await wrongDatabase.end(); }

    await root.query('CREATE ROLE bootstrap_ci_viewer LOGIN');
    const wrongActor = new pg.Client({ ...config, user:'bootstrap_ci_viewer' });
    await wrongActor.connect();
    try { await rejected(wrongActor, sql, /identity\/target/); }
    finally { await wrongActor.end(); }
    await root.query('SELECT pg_advisory_lock(740016, 1)');
    try { await rejected(admin, sql, /holds the lock/); }
    finally { await root.query('SELECT pg_advisory_unlock(740016, 1)'); }

    await root.query('CREATE ROLE audit_app NOLOGIN');
    await rejected(admin, sql, /collision/);
    await root.query('DROP ROLE audit_app');
    await root.query('CREATE TABLE public.bootstrap_ci_sentinel(id integer)');
    await rejected(admin, sql, /fresh empty/);
    await root.query('DROP TABLE public.bootstrap_ci_sentinel');

    const failMidway = sql.replace('CREATE EXTENSION pgcrypto WITH SCHEMA public;', 'SELECT 1 / 0;');
    await rejected(admin, failMidway, /division by zero/);
    assert.equal((await root.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname IN ('audit_app','audit_migrator','audit_runtime')")).rows[0].n, 0);

    await admin.query(sql);
    const roles = await root.query(`SELECT rolname, rolcanlogin, rolsuper, rolcreatedb,
      rolcreaterole, rolreplication, rolbypassrls FROM pg_roles
      WHERE rolname IN ('audit_app','audit_migrator','audit_runtime')`);
    assert.equal(roles.rowCount, 3);
    for (const row of roles.rows) {
      for (const key of ['rolcanlogin','rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls']) {
        assert.equal(row[key], false);
      }
    }
    const passwords = await root.query("SELECT count(*)::int AS n FROM pg_authid WHERE rolname IN ('audit_app','audit_migrator','audit_runtime') AND rolpassword IS NOT NULL");
    assert.equal(passwords.rows[0].n, 0);
    const owner = await root.query("SELECT r.rolname FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='public'");
    assert.equal(owner.rows[0].rolname, 'audit_migrator');
    const access = await root.query(`SELECT
      has_database_privilege('audit_migrator', current_database(), 'CREATE') AS db_create,
      has_database_privilege('audit_runtime', current_database(), 'TEMP') AS runtime_temp,
      has_schema_privilege('audit_runtime', 'public', 'CREATE') AS runtime_create,
      has_schema_privilege('audit_migrator', 'public', 'CREATE') AS migrator_create`);
    assert.deepEqual(access.rows[0], { db_create:false, runtime_temp:false, runtime_create:false, migrator_create:true });
    const cannotLogin = new pg.Client({ ...config, user:'audit_migrator' });
    try { await assert.rejects(cannotLogin.connect(), error => error.code === '28000'); }
    finally { await cannotLogin.end(); }
    await rejected(admin, sql, /ownership prerequisite|collision/);
  } finally {
    if (rootConnected) await root.end();
    await admin.end();
  }
});
