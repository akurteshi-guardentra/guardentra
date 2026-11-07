/**
 * Child probe for the Express upgrade regression test (expressUpgrade.test.ts).
 *
 * Boots the REAL server.ts createApp() in production mode (static dist + SPA
 * fallback, no Vite) from a throwaway working directory, serves it on an
 * ephemeral loopback port, and records what a client sees for routing,
 * security middleware, body parsing and static serving. A second, minimal app
 * built with the same express import checks trust-proxy req.ip resolution and
 * the res.send / Content-Disposition paths that changed in Express 5.3.
 *
 * Output: one JSON line on stdout. No network beyond 127.0.0.1, no credentials.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'package.json'));

const work = process.cwd();
const dist = path.join(work, 'dist');
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log("asset")');
fs.writeFileSync(path.join(work, 'secret.txt'), 'outside-dist-must-not-be-served');

const { createApp } = await import(pathToFileURL(path.join(root, 'server.ts')).href);
const express = (await import('express')).default;
const expressVersion = require('express/package.json').version;

const listen = (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });

const PICK = [
  'content-type',
  'content-length',
  'transfer-encoding',
  'cache-control',
  'content-disposition',
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'strict-transport-security',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'cross-origin-opener-policy',
  'permissions-policy',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-powered-by',
  'vary',
];

async function hit(base, name, urlPath, init = {}) {
  const res = await fetch(`${base}${urlPath}`, { redirect: 'manual', ...init });
  const text = await res.text();
  const headers = {};
  for (const key of PICK) {
    const value = res.headers.get(key);
    if (value !== null) headers[key] = value;
  }
  return { name, status: res.status, headers, body: text.slice(0, 200) };
}

const APP_ORIGIN = 'https://app.guardentra.test';
const results = [];

const app = await createApp();
const server = await listen(app);
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const json = { 'Content-Type': 'application/json' };
  results.push(await hit(base, 'health', '/api/health'));
  results.push(await hit(base, 'health HEAD', '/api/health', { method: 'HEAD' }));
  results.push(await hit(base, 'unknown api path', '/api/does-not-exist'));
  results.push(await hit(base, 'unknown nested api path', '/api/portal/nope/deeper'));
  results.push(await hit(base, 'ai without token', '/api/ai/analyze', { method: 'POST', headers: json, body: '{}' }));
  results.push(await hit(base, 'notify without token', '/api/notify/mail', { method: 'POST', headers: json, body: '{}' }));
  results.push(await hit(base, 'audit without token', '/api/audit/export'));
  results.push(
    await hit(base, 'ai with bad bearer', '/api/ai/analyze', {
      method: 'POST',
      headers: { ...json, Authorization: 'Bearer not-a-real-token' },
      body: '{}',
    }),
  );
  results.push(await hit(base, 'org evidence without token', '/api/org/evidence-download'));
  results.push(await hit(base, 'scanner without secret', '/api/internal/evidence-scan', { method: 'POST', headers: json, body: '{}' }));
  results.push(
    await hit(base, 'malformed json body', '/api/portal/session', { method: 'POST', headers: json, body: '{"broken":' }),
  );
  results.push(
    await hit(base, 'oversized json body', '/api/portal/session', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ pad: 'x'.repeat(200 * 1024) }),
    }),
  );
  results.push(
    await hit(base, 'stripe webhook unsigned', '/api/stripe/webhook', { method: 'POST', headers: json, body: '{}' }),
  );
  results.push(
    await hit(base, 'cors preflight allowed origin', '/api/portal/session', {
      method: 'OPTIONS',
      headers: {
        Origin: APP_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    }),
  );
  results.push(
    await hit(base, 'cors preflight evil origin', '/api/portal/session', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    }),
  );
  results.push(await hit(base, 'security.txt', '/.well-known/security.txt'));
  results.push(await hit(base, 'spa root', '/'));
  results.push(await hit(base, 'spa deep link', '/vendors/abc/assessments/xyz'));
  results.push(await hit(base, 'hashed asset', '/assets/app-abc123.js'));
  results.push(await hit(base, 'missing asset', '/assets/missing.js'));
  results.push(await hit(base, 'encoded traversal', '/assets/..%2f..%2fsecret.txt'));
  results.push(await hit(base, 'double-encoded traversal', '/%2e%2e/secret.txt'));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

// Minimal app with the same Express import: behaviours server.ts depends on
// indirectly (trust proxy hop count) and the response paths 5.3 rewrote.
const mini = express();
mini.set('trust proxy', 1);
mini.get('/ip', (req, res) => res.json({ ip: req.ip, ips: req.ips, protocol: req.protocol }));
mini.get('/typed-string', (_req, res) => res.type('text/plain').send('héllo'));
mini.get('/html-string', (_req, res) => res.send('<p>héllo</p>'));
mini.get('/attachment', (_req, res) => res.attachment('../../etc/report.pdf').send('pdf'));
// Same header + string-send sequence as server/routes/audit.ts GET /export.
mini.get('/manual-export', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-t1.csv"');
  res.send('a,b\n1,2\n');
});
mini.get('/params/:id', (req, res) => res.json({ id: req.params.id }));
mini.get('/optional{/:tab}', (req, res) => res.json({ tab: req.params.tab ?? null }));
mini.get('/throws', () => {
  throw new Error('boom');
});
mini.get('/async-throws', async () => {
  throw new Error('async boom');
});
mini.use((err, _req, res, _next) => res.status(500).json({ caught: err.message }));
const miniServer = await listen(mini);
const miniBase = `http://127.0.0.1:${miniServer.address().port}`;
try {
  results.push(await hit(miniBase, 'trust proxy one hop', '/ip', { headers: { 'X-Forwarded-For': '203.0.113.9, 198.51.100.7', 'X-Forwarded-Proto': 'https' } }));
  results.push(await hit(miniBase, 'typed string send', '/typed-string'));
  results.push(await hit(miniBase, 'html string send', '/html-string'));
  results.push(await hit(miniBase, 'attachment basename', '/attachment'));
  results.push(await hit(miniBase, 'audit-style manual export', '/manual-export'));
  results.push(await hit(miniBase, 'route param', '/params/a%20b'));
  results.push(await hit(miniBase, 'optional segment absent', '/optional'));
  results.push(await hit(miniBase, 'optional segment present', '/optional/risk'));
  results.push(await hit(miniBase, 'sync throw reaches error handler', '/throws'));
  results.push(await hit(miniBase, 'async throw reaches error handler', '/async-throws'));
} finally {
  await new Promise((resolve) => miniServer.close(resolve));
}

process.stdout.write(`\n${JSON.stringify({ expressVersion, results })}\n`);
// Route modules may keep timers (rate limiters, SDK clients) alive.
process.exit(0);
