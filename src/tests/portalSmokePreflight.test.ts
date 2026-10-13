// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(process.cwd(), 'src/tests/portal.smoke.mjs');
const base = 'https://guardentra--guardentra-staging.us-east4.hosted.app';
const validArgs = ['--project', 'guardentra-staging', '--open', 'synthetic-open',
  '--closed', 'synthetic-closed', '--other-open', 'synthetic-other', '--allow-test-upload'];
function run(args: string[], overrides: Record<string, string> = {}) {
  const env = { ...process.env, PORTAL_API_BASE: base, VITE_FIREBASE_API_KEY: 'test-only-not-a-credential',
    VITE_FIREBASE_PROJECT_ID: '', GCLOUD_PROJECT: '', GOOGLE_CLOUD_PROJECT: '',
    VITE_FIRESTORE_DATABASE_ID: '', FIRESTORE_EMULATOR_HOST: '',
    FIREBASE_AUTH_EMULATOR_HOST: '', FIREBASE_STORAGE_EMULATOR_HOST: '', ...overrides };
  return spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8', timeout: 5000 });
}
function rejected(args: string[], overrides: Record<string, string>, expected: string) {
  const result = run(args, overrides);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(2);
  expect(result.stderr).toContain(expected);
  expect(result.stdout).not.toContain('PASS');
  expect(result.stderr).not.toContain('test-only-not-a-credential');
}
describe('live portal smoke refuses unsafe configuration before network preflight', () => {
  it('requires explicit synthetic upload opt-in', () =>
    rejected(validArgs.filter(v => v !== '--allow-test-upload'), {}, '--allow-test-upload'));
  it('rejects the production project', () =>
    rejected(validArgs.map(v => v === 'guardentra-staging' ? 'guardentra-prod' : v), {}, 'Explicit staging project'));
  it.each(['http://localhost:8080', 'https://guardentra.com',
    base + '?token=do-not-log', base + '/wrong-path'])('rejects mismatched API origin %s', api =>
      rejected(validArgs, { PORTAL_API_BASE: api }, 'Explicit staging project'));
  it('requires an explicit API key instead of .env.local fallback', () =>
    rejected(validArgs, { VITE_FIREBASE_API_KEY: '' }, 'Missing explicit staging'));
  it('requires all synthetic fixture IDs', () =>
    rejected(validArgs.filter((_, i) => i !== 6 && i !== 7), {}, 'distinct valid'));
  it('rejects duplicate fixture IDs', () =>
    rejected(validArgs.map(v => v === 'synthetic-other' ? 'synthetic-open' : v), {}, 'distinct valid'));
  it.each(['../other', 'with space', 'has.dot'])('rejects invalid fixture ID %s', id =>
    rejected(validArgs.map(v => v === 'synthetic-open' ? id : v), {}, 'distinct valid'));
  it.each(['VITE_FIREBASE_PROJECT_ID', 'GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT'])('rejects conflicting %s', key =>
    rejected(validArgs, { [key]: 'guardentra-7f582' }, 'Conflicting Firebase project'));
  it('rejects a named database', () =>
    rejected(validArgs, { VITE_FIRESTORE_DATABASE_ID: 'wrong-database' }, '(default) Firestore'));
  it.each(['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST'])('rejects %s', key =>
    rejected(validArgs, { [key]: '127.0.0.1:9099' }, 'Emulator overrides'));
});
