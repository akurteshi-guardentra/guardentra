import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { managedConfig, migrationDigest, prepareMigrations } from './core.mjs';

const valid = { CLOUD_RUN_JOB: 'guardentra-audit-migrator-74',
  AUDIT_INSTANCE_CONNECTION_NAME: 'guardentra-staging:us-central1:guardentra-staging-audit',
  AUDIT_DATABASE_NAME: 'guardentra_audit', AUDIT_DATABASE_USER: 'audit_migrator',
  AUDIT_MIGRATOR_PASSWORD: 'synthetic-fixture-only' };

test('rejects other environments, identities, URL fallback and credential overrides', () => {
  assert.equal(managedConfig(valid).user, 'audit_migrator');
  for (const [key, value] of [
    ['AUDIT_INSTANCE_CONNECTION_NAME', 'guardentra-prod:us-central1:guardentra-audit'],
    ['AUDIT_DATABASE_NAME', 'postgres'], ['AUDIT_DATABASE_USER', 'postgres'],
    ['CLOUD_RUN_JOB', 'other-job'], ['AUDIT_MIGRATOR_PASSWORD', ''],
    ['AUDIT_DATABASE_URL', 'synthetic'], ['AUDIT_DATABASE_URL_MIGRATOR', 'synthetic'],
    ['GOOGLE_APPLICATION_CREDENTIALS', 'synthetic'], ['GOOGLE_CREDENTIALS', 'synthetic'],
    ['GOOGLE_OAUTH_ACCESS_TOKEN', 'synthetic'],
  ]) assert.throws(() => managedConfig({ ...valid, [key]: value }));
});

test('reviewed SQL set and checksums reject edits or extra migrations', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ge-migration-manifest-'));
  try {
    const sql = 'SELECT 1;\n';
    const manifest = { '001_init.sql': migrationDigest(sql), '002_roles.sql': migrationDigest(sql) };
    for (const name of Object.keys(manifest)) await writeFile(path.join(dir, name), sql);
    assert.equal((await prepareMigrations(dir, manifest)).length, 2);
    await writeFile(path.join(dir, '001_init.sql'), 'SELECT 2;\n');
    await assert.rejects(prepareMigrations(dir, manifest), /checksum/);
    await writeFile(path.join(dir, '003_extra.sql'), sql);
    await assert.rejects(prepareMigrations(dir, manifest), /set/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('committed manifest matches migrations with canonical Windows line endings', async () => {
  const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
  const dir = new URL('../../migrations/audit/', import.meta.url).pathname;
  assert.equal((await prepareMigrations(dir, manifest)).length, 2);
  assert.equal(migrationDigest('SELECT 1;\r\n'), migrationDigest('SELECT 1;\n'));
});
