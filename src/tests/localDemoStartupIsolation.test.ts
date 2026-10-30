import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildLocalDemoEnv } from '../../scripts/local-demo-preflight.mjs';
import { prepareLocalDemoLaunchEnv } from '../../scripts/run-local-demo.mjs';
import {
  createPrivateLocalState,
  isIsolatedLocalStartup,
} from '../../scripts/local-demo-startup-policy.mjs';

const root = path.resolve(__dirname, '../..');
const tsx = path.join(root, 'node_modules/.bin/tsx');
const probe = path.join(root, 'src/tests/localDemoStartupProbe.mjs');

function writeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardentra-sentinel-'));
  const body = [
    'GOOGLE_APPLICATION_CREDENTIALS=/tmp/sentinel-not-a-credential.json',
    'SENDGRID_API_KEY=sentinel-sendgrid',
    'STRIPE_SECRET_KEY=sentinel-stripe',
    'STRIPE_WEBHOOK_SECRET=sentinel-webhook',
    'AUDIT_DATABASE_URL=postgres://sentinel.invalid/audit',
    'API_KEY=sentinel-api',
    'GEMINI_API_KEY=sentinel-gemini-from-file',
    'SENTINEL_FROM_FILE=1',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, '.env.local'), body);
  fs.writeFileSync(path.join(dir, '.env'), 'SENTINEL_FROM_DOTENV=1\nAPI_KEY=sentinel-dotenv\n');
  return dir;
}

function lastJson(stdout: string) {
  const line = stdout.trim().split('\n').filter((entry) => entry.startsWith('{')).at(-1);
  if (!line) throw new Error(`no JSON in stdout:\n${stdout}`);
  return JSON.parse(line);
}

type DemoEnv = Record<string, string | undefined>;

function launchEnv(base: DemoEnv = {}): DemoEnv {
  return prepareLocalDemoLaunchEnv(base) as DemoEnv;
}

function isolatedEnv() {
  return launchEnv({ PATH: process.env.PATH, LANG: 'C.UTF-8' });
}

describe('local demo startup isolation', () => {
  it('builds a private launch environment and drops the parent home', () => {
    const env = launchEnv({
      PATH: '/usr/bin:/bin',
      LANG: 'C',
      HOME: '/home/operator',
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/should-not-pass.json',
      SENDGRID_API_KEY: 'sentinel-sendgrid',
    });
    expect(env.HOME).not.toBe('/home/operator');
    expect(String(env.HOME).startsWith(String(env.GUARDENTRA_LOCAL_STATE_DIR))).toBe(true);
    expect(env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
    expect(env.SENDGRID_API_KEY).toBeUndefined();
    expect(env.NODE_OPTIONS).toContain('local-demo-block-egress.mjs');
    expect(isIsolatedLocalStartup(env)).toBe(true);
  });

  it('rejects a local-demo flag that is missing isolation', () => {
    const env = buildLocalDemoEnv();
    expect(isIsolatedLocalStartup({ APP_ENV: 'production' })).toBe(false);
    expect(() => isIsolatedLocalStartup(env)).toThrow(/private state root/);
    expect(() => isIsolatedLocalStartup({ ...env, GCLOUD_PROJECT: 'guardentra-prod' })).toThrow(/GCLOUD_PROJECT/);
    expect(() => isIsolatedLocalStartup({
      ...isolatedEnv(),
      SENDGRID_API_KEY: 'sentinel-sendgrid',
    })).toThrow(/forbidden SENDGRID_API_KEY/);
    expect(() => isIsolatedLocalStartup({
      ...isolatedEnv(),
      GEMINI_API_KEY: 'sentinel-live-gemini',
    })).toThrow(/Gemini/);
  });

  it('rejects linked, shared, and credential-bearing state directories', () => {
    const env = isolatedEnv();
    const rootDir = String(env.GUARDENTRA_LOCAL_STATE_DIR);
    const homeDir = String(env.HOME);
    const cloudDir = String(env.CLOUDSDK_CONFIG);
    const linked = path.join(os.tmpdir(), `guardentra-link-${process.pid}`);
    fs.symlinkSync(rootDir, linked);
    expect(() => isIsolatedLocalStartup({ ...env, GUARDENTRA_LOCAL_STATE_DIR: linked })).toThrow(/link/);
    fs.unlinkSync(linked);

    fs.chmodSync(homeDir, 0o755);
    expect(() => isIsolatedLocalStartup(env)).toThrow(/private/);
    fs.chmodSync(homeDir, 0o700);

    fs.writeFileSync(
      path.join(cloudDir, 'application_default_credentials.json'),
      '{"type":"sentinel"}\n',
    );
    expect(() => isIsolatedLocalStartup(env)).toThrow(/credential file/);
  });

  it('does not let checkout env files reach the route module during isolated startup', () => {
    const dir = writeFixture();
    const result = spawnSync(tsx, [probe, 'loadenv'], {
      cwd: dir,
      env: isolatedEnv(),
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.status, result.stderr).toBe(0);
    const observed = lastJson(result.stdout);
    expect(observed.sentinel).toBe('');
    expect(observed.sendgrid).toBe('');
    expect(observed.stripe).toBe('');
    expect(observed.webhook).toBe('');
    expect(observed.auditUrl).toBe('');
    expect(observed.apiKey).toBe('');
    expect(observed.credentials).toBe('');
    expect(observed.gemini).toBe('your_gemini_api_key_here');
  }, 40_000);

  it('still loads env files for ordinary startup', () => {
    const dir = writeFixture();
    const result = spawnSync(tsx, [probe, 'loadenv'], {
      cwd: dir,
      env: {
        PATH: process.env.PATH,
        HOME: os.tmpdir(),
        NODE_ENV: 'development',
      },
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(result.status, result.stderr).toBe(0);
    const observed = lastJson(result.stdout);
    expect(observed.sentinel).toBe('1');
    expect(observed.sendgrid).toBe('sentinel-sendgrid');
    expect(observed.credentials).toContain('sentinel-not-a-credential');
  }, 40_000);

  it('skips Vite env files and client keys only for the isolated local runtime', () => {
    const dir = writeFixture();
    const local = spawnSync(tsx, [probe, 'vite'], {
      cwd: dir,
      env: { ...isolatedEnv(), PROBE_VITE_MODE: 'development' },
      encoding: 'utf8',
      timeout: 40_000,
    });
    expect(local.status, local.stderr).toBe(0);
    const localCfg = lastJson(local.stdout);
    expect(localCfg.thrown).toBeNull();
    expect(localCfg.host).toBe('127.0.0.1');
    expect(localCfg.envDir).toBe(false);
    expect(localCfg.apiKey).toBe('""');
    expect(localCfg.gemini).toBe('""');
    expect(localCfg.reads).toEqual([]);

    const localProduction = spawnSync(tsx, [probe, 'vite'], {
      cwd: dir,
      env: { ...isolatedEnv(), PROBE_VITE_MODE: 'production' },
      encoding: 'utf8',
      timeout: 40_000,
    });
    expect(localProduction.status, localProduction.stderr).toBe(0);
    const refused = lastJson(localProduction.stdout);
    expect(refused.thrown).toContain('LOCAL_STARTUP_REFUSED');

    const ordinary = spawnSync(tsx, [probe, 'vite'], {
      cwd: dir,
      env: {
        PATH: process.env.PATH,
        HOME: os.tmpdir(),
        PROBE_VITE_MODE: 'development',
      },
      encoding: 'utf8',
      timeout: 40_000,
    });
    expect(ordinary.status, ordinary.stderr).toBe(0);
    const ordinaryCfg = lastJson(ordinary.stdout);
    expect(ordinaryCfg.thrown).toBeNull();
    expect(ordinaryCfg.host).toBe('0.0.0.0');
    expect(ordinaryCfg.envDir).toBeNull();
    expect(ordinaryCfg.reads.some((file: string) => file.endsWith('.env.local'))).toBe(true);
    expect(ordinaryCfg.gemini).toBe(JSON.stringify('sentinel-gemini-from-file'));

    const production = spawnSync(tsx, [probe, 'vite'], {
      cwd: dir,
      env: {
        PATH: process.env.PATH,
        HOME: os.tmpdir(),
        PROBE_VITE_MODE: 'production',
        GEMINI_API_KEY: 'sentinel-gemini-from-process',
      },
      encoding: 'utf8',
      timeout: 40_000,
    });
    expect(production.status, production.stderr).toBe(0);
    const productionCfg = lastJson(production.stdout);
    expect(productionCfg.host).toBe('0.0.0.0');
    expect(productionCfg.apiKey).toBe('""');
    expect(productionCfg.gemini).toBe('""');
  }, 120_000);
});

describe('private state helper', () => {
  it('creates directories the policy accepts', () => {
    const state = createPrivateLocalState() as DemoEnv;
    const env = {
      ...buildLocalDemoEnv(),
      ...state,
    };
    expect(isIsolatedLocalStartup(env)).toBe(true);
    expect(fs.statSync(String(state.HOME)).mode & 0o077).toBe(0);
  });
});
