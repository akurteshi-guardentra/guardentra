// @vitest-environment node
/**
 * Express 5.2.1 -> 5.3.0 regression guard.
 *
 * Runs src/tests/expressUpgradeProbe.mjs in a child process: it boots the real
 * server.ts createApp() in production mode from a throwaway directory and
 * records what an HTTP client sees. These assertions pin the routing, auth
 * gating, edge security headers, CORS allowlist, body-parser limits, static
 * caching, SPA fallback and traversal behaviour that the app relies on, plus
 * the Express internals 5.3 rewrote (res.send charset, Content-Disposition,
 * error propagation, path-to-regexp v8 params, trust proxy).
 *
 * The same probe produced identical results on 5.2.1 except for the
 * Content-Disposition quoting noted below (see PR description for the diff).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

type Hit = { name: string; status: number; headers: Record<string, string>; body: string };

const root = path.resolve(__dirname, '../..');
const tsx = path.join(root, 'node_modules/.bin/tsx');
const probe = path.join(root, 'src/tests/expressUpgradeProbe.mjs');

let version = '';
const hits = new Map<string, Hit>();
const get = (name: string) => {
  const hit = hits.get(name);
  expect(hit, name).toBeTruthy();
  return hit as Hit;
};

beforeAll(() => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'express-upgrade-'));
  try {
    const run = spawnSync(tsx, [probe], {
      cwd,
      encoding: 'utf8',
      timeout: 60_000,
      // Isolated env: no credentials, no parent .env, demo project only.
      env: {
        PATH: process.env.PATH,
        HOME: cwd,
        LANG: 'C.UTF-8',
        SKIP_LISTEN: '1',
        NODE_ENV: 'production',
        APP_ENV: 'staging',
        GOOGLE_CLOUD_PROJECT: 'demo-guardentra-express',
        FIREBASE_STORAGE_BUCKET: 'demo-guardentra-express.appspot.com',
        PUBLIC_APP_URL: 'https://app.guardentra.test',
      },
    });
    const line = run.stdout.trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
    if (run.status !== 0 || !line) {
      throw new Error(`probe failed (status ${run.status})\n${run.stderr}\n${run.stdout}`);
    }
    const parsed = JSON.parse(line) as { expressVersion: string; results: Hit[] };
    version = parsed.expressVersion;
    for (const hit of parsed.results) hits.set(hit.name, hit);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}, 90_000);

const SECURITY_HEADERS = [
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'cross-origin-opener-policy',
  'permissions-policy',
  'content-security-policy',
  'content-security-policy-report-only',
];

describe('Express upgrade: real createApp() over HTTP', () => {
  it('runs on the Express version this branch locks', () => {
    expect(version).toBe('5.3.0');
  });

  it('applies edge security headers to every real-app response and hides x-powered-by', () => {
    const realApp = [...hits.values()].filter(
      (h) => !['trust proxy one hop', 'typed string send', 'html string send', 'attachment basename',
        'audit-style manual export', 'route param', 'optional segment absent', 'optional segment present',
        'sync throw reaches error handler', 'async throw reaches error handler'].includes(h.name),
    );
    expect(realApp.length).toBeGreaterThanOrEqual(20);
    for (const hit of realApp) {
      for (const header of SECURITY_HEADERS) expect(hit.headers[header], `${hit.name}: ${header}`).toBeTruthy();
      expect(hit.headers['x-powered-by'], hit.name).toBeUndefined();
    }
  });

  it('serves health as JSON, including HEAD', () => {
    expect(get('health').status).toBe(200);
    expect(JSON.parse(get('health').body).status).toBe('ok');
    expect(get('health HEAD').status).toBe(200);
    expect(get('health HEAD').body).toBe('');
  });

  it('returns JSON 404 for unknown /api paths instead of the SPA shell', () => {
    for (const name of ['unknown api path', 'unknown nested api path']) {
      expect(get(name).status).toBe(404);
      expect(get(name).headers['content-type']).toMatch(/^application\/json/);
      expect(JSON.parse(get(name).body)).toEqual({ error: 'Not found' });
    }
  });

  it('keeps Firebase-auth and scanner-secret gates closed', () => {
    for (const name of ['ai without token', 'notify without token', 'audit without token', 'org evidence without token']) {
      expect(get(name).status, name).toBe(401);
      expect(JSON.parse(get(name).body).error).toBe('Authentication required');
    }
    expect(get('ai with bad bearer').status).toBe(401);
    expect(get('scanner without secret').status).toBe(401);
  });

  it('rejects malformed and oversized JSON without leaking a stack trace', () => {
    expect(get('malformed json body').status).toBe(400);
    expect(get('oversized json body').status).toBe(413);
    for (const name of ['malformed json body', 'oversized json body']) {
      expect(get(name).body).not.toMatch(/\bat \S+ \(|node_modules|SyntaxError/);
    }
  });

  it('still refuses an unsigned Stripe webhook', () => {
    expect(get('stripe webhook unsigned').status).toBe(400);
  });

  it('allows CORS only for the configured app origin', () => {
    const ok = get('cors preflight allowed origin');
    expect(ok.status).toBe(204);
    expect(ok.headers['access-control-allow-origin']).toBe('https://app.guardentra.test');
    expect(get('cors preflight evil origin').headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves security.txt as utf-8 plain text', () => {
    const hit = get('security.txt');
    expect(hit.status).toBe(200);
    expect(hit.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(hit.body).toMatch(/^Contact: /);
  });

  it('keeps SPA fallback, asset caching and traversal containment', () => {
    for (const name of ['spa root', 'spa deep link', 'missing asset', 'encoded traversal', 'double-encoded traversal']) {
      expect(get(name).status, name).toBe(200);
      expect(get(name).headers['cache-control'], name).toBe('no-cache');
      expect(get(name).body, name).toBe('<!doctype html><div id="root"></div>');
    }
    expect(get('hashed asset').headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(get('hashed asset').body).toBe('console.log("asset")');
  });
});

describe('Express upgrade: internals changed in 5.3', () => {
  it('resolves req.ip one hop from the edge with trust proxy = 1', () => {
    const body = JSON.parse(get('trust proxy one hop').body);
    expect(body).toEqual({ ip: '198.51.100.7', ips: ['198.51.100.7'], protocol: 'https' });
  });

  it('adds charset=utf-8 to string bodies with and without a preset type', () => {
    expect(get('typed string send').headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(get('typed string send').body).toBe('héllo');
    expect(get('html string send').headers['content-type']).toBe('text/html; charset=utf-8');
    const exp = get('audit-style manual export');
    expect(exp.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(exp.headers['content-disposition']).toBe('attachment; filename="audit-t1.csv"');
  });

  it('strips directories from res.attachment filenames', () => {
    // 5.3 passes basename() to content-disposition 2.x, which leaves a plain
    // token unquoted; 5.2.1 sent filename="report.pdf". The app does not call
    // res.attachment/res.download (audit export sets the header itself).
    expect(get('attachment basename').headers['content-disposition']).toBe('attachment; filename=report.pdf');
  });

  it('decodes route params and supports optional segments', () => {
    expect(JSON.parse(get('route param').body)).toEqual({ id: 'a b' });
    expect(JSON.parse(get('optional segment absent').body)).toEqual({ tab: null });
    expect(JSON.parse(get('optional segment present').body)).toEqual({ tab: 'risk' });
  });

  it('routes sync and async handler errors to the error middleware', () => {
    expect(get('sync throw reaches error handler').status).toBe(500);
    expect(JSON.parse(get('sync throw reaches error handler').body)).toEqual({ caught: 'boom' });
    expect(JSON.parse(get('async throw reaches error handler').body)).toEqual({ caught: 'async boom' });
  });
});
