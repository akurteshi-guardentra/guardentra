// @vitest-environment node
/**
 * GitHub #219 — GE-01 security headers, GE-06 security.txt, GE-07 CORS allowlist.
 *
 * Builds a real Express app with the same wiring order as server.ts
 * (applyEdgeSecurity → /api routes → apiNotFound → static + SPA fallback) and
 * exercises it over HTTP, so preflight, header and fallback behaviour is what a
 * browser would see. server.ts itself is checked by a source contract below.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import {
  ENFORCED_CSP,
  REPORT_ONLY_CSP,
  SECURITY_TXT_EXPIRES,
  apiNotFound,
  applyEdgeSecurity,
  buildSecurityTxt,
  resolveAllowedOrigins,
} from '../../server/middleware/edgeSecurity.ts';
import { requireFirebaseAuth } from '../../server/middleware/requireFirebaseAuth.ts';

const APP_ORIGIN = 'https://app.guardentra.test';
const EXTRA_ORIGIN = 'https://partner.guardentra.test';
const EVIL_ORIGIN = 'https://evil.example';

const env: NodeJS.ProcessEnv = {
  APP_ENV: 'staging',
  PUBLIC_APP_URL: `${APP_ORIGIN}/some/path`,
  CORS_ALLOWED_ORIGINS: `${EXTRA_ORIGIN}, *, not a url`,
};

let server: Server;
let base: string;
let distDir: string;
const savedAppEnv = process.env.APP_ENV;

beforeAll(async () => {
  // requireFirebaseAuth reads process.env directly; force the enforcing path.
  process.env.APP_ENV = 'staging';
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-sec-'));
  fs.mkdirSync(path.join(distDir, 'assets'));
  fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(distDir, 'assets', 'app.js'), 'console.log(1)');

  const app = express();
  applyEdgeSecurity(app, env);
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/portal/session', (req, res) => res.json({ ok: true, got: req.body }));
  app.use('/api/ai', requireFirebaseAuth, (_req, res) => res.json({ reached: true }));
  app.use('/api', apiNotFound);
  app.use('/assets', express.static(path.join(distDir, 'assets')));
  app.use(express.static(distDir));
  app.get('*all', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  process.env.APP_ENV = savedAppEnv;
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(distDir, { recursive: true, force: true });
});

const preflight = (url: string, origin: string) =>
  fetch(`${base}${url}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });

describe('resolveAllowedOrigins', () => {
  it('uses PUBLIC_APP_URL origin plus explicit extras and drops wildcards/garbage', () => {
    expect([...resolveAllowedOrigins(env)].sort()).toEqual([APP_ORIGIN, EXTRA_ORIGIN].sort());
  });

  it('adds localhost only in development-like environments', () => {
    expect(resolveAllowedOrigins({ APP_ENV: 'development' }).has('http://localhost:8080')).toBe(true);
    expect(resolveAllowedOrigins({ APP_ENV: 'production' }).has('http://localhost:8080')).toBe(false);
    // Unset env is production-like (same rule as requireFirebaseAuth).
    expect(resolveAllowedOrigins({}).size).toBe(0);
  });
});

describe('CORS on /api (GE-07)', () => {
  it('allowed origin: preflight succeeds and exposes only the listed headers', async () => {
    const res = await preflight('/api/ai/chat', APP_ORIGIN);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('access-control-allow-headers')).toBe('Authorization,Content-Type,X-Org-Id');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    expect(res.headers.get('vary')).toMatch(/Origin/);
  });

  it('extra configured origin is allowed', async () => {
    const res = await preflight('/api/portal/session', EXTRA_ORIGIN);
    expect(res.headers.get('access-control-allow-origin')).toBe(EXTRA_ORIGIN);
  });

  it('disallowed origin: preflight carries no allow-origin, so the browser blocks it', async () => {
    const res = await preflight('/api/ai/chat', EVIL_ORIGIN);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('access-control-allow-headers')).toBeNull();
  });

  it('never answers with a wildcard, even for a simple GET', async () => {
    for (const origin of [EVIL_ORIGIN, APP_ORIGIN]) {
      const res = await fetch(`${base}/api/health`, { headers: { Origin: origin } });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    }
    const evil = await fetch(`${base}/api/health`, { headers: { Origin: EVIL_ORIGIN } });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('server-to-server calls without Origin (webhooks, Cloud Tasks) still work', async () => {
    const res = await fetch(`${base}/api/portal/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId: 'a1' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, got: { assessmentId: 'a1' } });
  });

  it('vendor portal same-origin POST works', async () => {
    const res = await fetch(`${base}/api/portal/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: APP_ORIGIN },
      body: JSON.stringify({ assessmentId: 'a2' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP_ORIGIN);
  });

  it('CORS does not bypass authorization: allowed origin without a token is still 401', async () => {
    const res = await fetch(`${base}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: APP_ORIGIN },
      body: '{}',
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Authentication required' });
  });

  it('does not add CORS headers to non-API responses', async () => {
    const res = await fetch(`${base}/`, { headers: { Origin: EVIL_ORIGIN } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('security headers (GE-01)', () => {
  const expectHardened = (res: Response) => {
    expect(res.headers.get('strict-transport-security')).toBe('max-age=15552000');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin-allow-popups');
    expect(res.headers.get('permissions-policy')).toContain('camera=()');
    expect(res.headers.get('content-security-policy')).toBe(ENFORCED_CSP);
    expect(res.headers.get('content-security-policy-report-only')).toBe(REPORT_ONLY_CSP);
    expect(res.headers.get('x-powered-by')).toBeNull();
  };

  it('on the HTML shell, deep links, static assets, API, 404 and security.txt', async () => {
    for (const p of ['/', '/vendors/123', '/assets/app.js', '/api/health', '/api/nope', '/.well-known/security.txt']) {
      expectHardened(await fetch(`${base}${p}`));
    }
  });

  it('on preflight responses', async () => {
    expectHardened(await preflight('/api/ai/chat', APP_ORIGIN));
  });

  it('CSP keeps Firebase popup sign-in and Google Fonts working', () => {
    expect(REPORT_ONLY_CSP).toContain('frame-src \'self\' https://*.firebaseapp.com');
    expect(REPORT_ONLY_CSP).toContain('https://fonts.googleapis.com');
    expect(REPORT_ONLY_CSP).toContain('https://fonts.gstatic.com');
    expect(REPORT_ONLY_CSP).toContain('https://*.googleapis.com');
    expect(ENFORCED_CSP).not.toMatch(/script-src|default-src/);
  });
});

describe('security.txt and API fallback (GE-06)', () => {
  it('serves RFC 9116 plain text, not the SPA shell', async () => {
    const res = await fetch(`${base}/.well-known/security.txt`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    const body = await res.text();
    expect(body).not.toContain('<!doctype html>');
    expect(body).toContain('Contact: mailto:admin@guardentra.com');
    expect(body).toContain(`Expires: ${SECURITY_TXT_EXPIRES}`);
    expect(body).toContain(`Canonical: ${APP_ORIGIN}/.well-known/security.txt`);
  });

  it('Expires is a valid future ISO date less than ~13 months from the PR date', () => {
    const expires = Date.parse(SECURITY_TXT_EXPIRES);
    expect(Number.isNaN(expires)).toBe(false);
    expect(expires).toBeGreaterThan(Date.parse('2026-10-27T00:00:00Z'));
    expect(expires - Date.parse('2026-10-27T00:00:00Z')).toBeLessThanOrEqual(400 * 86400_000);
  });

  it('contact is configurable and supports several entries', () => {
    const txt = buildSecurityTxt({ SECURITY_TXT_CONTACT: 'mailto:security@guardentra.com, https://guardentra.com/security' });
    expect(txt).toContain('Contact: mailto:security@guardentra.com\nContact: https://guardentra.com/security\n');
    expect(txt).not.toContain('Canonical:');
  });

  it('unknown /api routes return JSON 404, while SPA deep links still get the shell', async () => {
    const api = await fetch(`${base}/api/does-not-exist`);
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: 'Not found' });
    const spa = await fetch(`${base}/assessments/abc`);
    expect(spa.status).toBe(200);
    expect(await spa.text()).toContain('<div id="root">');
  });
});

describe('server.ts wiring contract', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'server.ts'), 'utf8');

  it('no longer uses the wildcard cors() middleware', () => {
    expect(src).not.toMatch(/import cors from/);
    expect(src).not.toMatch(/app\.use\(cors\(\)\)/);
  });

  it('installs edge security before any /api route and the API 404 before the SPA fallback', () => {
    const edge = src.indexOf('applyEdgeSecurity(app)');
    const firstApi = src.indexOf('app.use("/api/');
    const firstGet = src.indexOf('app.get("/api/health"');
    const notFound = src.indexOf('app.use("/api", apiNotFound)');
    const lastApi = src.lastIndexOf('app.use("/api/');
    const spa = src.indexOf('app.get("*all"');
    const vite = src.indexOf('vite.middlewares');
    expect(edge).toBeGreaterThan(-1);
    expect(edge).toBeLessThan(firstApi);
    expect(edge).toBeLessThan(firstGet);
    expect(notFound).toBeGreaterThan(lastApi);
    expect(notFound).toBeLessThan(spa);
    expect(notFound).toBeLessThan(vite);
  });
});
