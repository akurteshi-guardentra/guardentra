// Real, disposable PostgreSQL 16 fixture only. No cloud credentials or live DB access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { prepareMigrations, runMigrations } from './core.mjs';

if (process.env.PGHOST !== '127.0.0.1' || process.env.PGDATABASE !== 'guardentra_audit_runner_ci' ||
    process.env.PGUSER !== 'postgres' || process.env.PGPORT !== '5432') {
  throw new Error('Refusing runner test outside disposable local fixture');
}
for (const key of ['PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGHOSTADDR', 'PGPASSWORD']) {
  if (process.env[key]) throw new Error('Unexpected fixture override');
}
const config = { host: '127.0.0.1', port: 5432, database: 'guardentra_audit_runner_ci',
  connectionTimeoutMillis: 10000, ssl: false };
const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
const migrations = await prepareMigrations(new URL('../../migrations/audit/', import.meta.url).pathname, manifest);

test('restricted migrator, repeatability, privileges, history and concurrent execution', async () => {
  const admin = new pg.Client({ ...config, user: 'postgres' });
  const migrator = new pg.Client({ ...config, user: 'audit_migrator' });
  const runtime = new pg.Client({ ...config, user: 'audit_runtime' });
  const blocker = new pg.Client({ ...config, user: 'audit_migrator' });
  await admin.connect();
  try {
    await admin.query(`CREATE EXTENSION pgcrypto;
      CREATE ROLE audit_app NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      CREATE ROLE audit_migrator LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      CREATE ROLE audit_runtime LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      GRANT audit_app TO audit_runtime;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      ALTER SCHEMA public OWNER TO audit_migrator;`);
    await migrator.connect(); await runtime.connect(); await blocker.connect();
    await assert.rejects(runMigrations(admin, migrations, config.database), /identity/);
    await assert.rejects(runMigrations(runtime, migrations, config.database), /identity/);
    assert.deepEqual(await runMigrations(migrator, migrations, config.database), { applied: 2, skipped: 0 });
    assert.deepEqual(await runMigrations(migrator, migrations, config.database), { applied: 0, skipped: 2 });

    const contract = (await readFile(new URL('../audit-tests/role-contract.sql', import.meta.url), 'utf8'))
      .replaceAll('ci_audit_login', 'audit_runtime');
    await runtime.query('BEGIN');
    try { await runtime.query(contract); } finally { await runtime.query('ROLLBACK'); }
    for (const sql of [
      'UPDATE schema_migrations SET sha256 = sha256', 'SET ROLE audit_migrator',
      'CREATE ROLE forbidden_role',
    ]) {
      await runtime.query('BEGIN');
      try { await assert.rejects(runtime.query(sql), error => error.code === '42501'); }
      finally { await runtime.query('ROLLBACK'); }
    }
    assert.equal((await migrator.query("SELECT count(*)::int AS n FROM audit_events WHERE tenant_id = 'ci-only'")).rows[0].n, 0);
    await blocker.query('SELECT pg_advisory_lock(740016, 1)');
    await assert.rejects(runMigrations(migrator, migrations, config.database), /holds the lock/);
    await blocker.query('SELECT pg_advisory_unlock(740016, 1)');
    await admin.query('GRANT audit_app TO audit_migrator');
    await assert.rejects(runMigrations(migrator, migrations, config.database), /membership/);
    await admin.query('REVOKE audit_app FROM audit_migrator');
    await admin.query('GRANT pg_read_all_data TO audit_app');
    await assert.rejects(runMigrations(migrator, migrations, config.database), /membership/);
    await admin.query('REVOKE pg_read_all_data FROM audit_app');
    await migrator.query("UPDATE schema_migrations SET sha256 = 'tampered' WHERE id = '001_init.sql'");
    await assert.rejects(runMigrations(migrator, migrations, config.database), /checksum/);
  } finally {
    for (const client of [blocker, runtime, migrator, admin]) await client.end();
  }
});
