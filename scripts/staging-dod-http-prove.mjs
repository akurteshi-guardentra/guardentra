#!/usr/bin/env node
/**
 * One-shot staging DoD: mint Firebase ID token (ADC + Token Creator on
 * firebase-adminsdk) → HTTP emit → verify against local Cloud Run proxy.
 * Does not persist tokens. Tamper still needs migrator / Auth Proxy (see FASTTRACK).
 *
 * Prereq: gcloud run services proxy … --tag=auditspine --port=8787
 *
 *   AUDIT_SPINE_ENABLED=true BASE_URL=http://127.0.0.1:8787 node scripts/staging-dod-http-prove.mjs
 */
import process from 'node:process';
import dotenv from 'dotenv';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { spawnSync } from 'node:child_process';

dotenv.config({ path: '.env.local' });

const base = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const apiKey = process.env.VITE_FIREBASE_API_KEY;
const sa = 'firebase-adminsdk-fbsvc@guardentra-7f582.iam.gserviceaccount.com';

if (!apiKey) {
  console.error('FAIL: VITE_FIREBASE_API_KEY missing (.env.local)');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    serviceAccountId: sa,
    projectId: 'guardentra-7f582',
  });
}

const uid = process.env.PROVE_UID || 'staging-dod-prove-agent';
const customToken = await getAuth().createCustomToken(uid, { prove: true });
const exch = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  }
);
const exchBody = await exch.json();
if (!exch.ok || !exchBody.idToken) {
  console.error('exchange FAIL', exch.status, JSON.stringify(exchBody).slice(0, 400));
  process.exit(1);
}
const idToken = exchBody.idToken;
console.log('mint: OK');

const tenantId = process.env.TENANT_ID || `staging_dod_${Date.now()}`;
const headers = {
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json',
};

const health = await fetch(`${base}/api/health`);
console.log('health:', health.status);

const emitRes = await fetch(`${base}/api/audit/emit`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    tenantId,
    eventType: 'vendor.created',
    actorType: 'user',
    objectType: 'vendor',
    objectId: 'dod-vendor-1',
    payload: { source: 'staging-dod-prove' },
  }),
});
const emitText = await emitRes.text();
console.log('emit:', emitRes.status, emitText.slice(0, 400));

await new Promise((r) => setTimeout(r, 4000));

const verifyRes = await fetch(
  `${base}/api/audit/verify?tenantId=${encodeURIComponent(tenantId)}`,
  { headers }
);
const verifyText = await verifyRes.text();
console.log('verify:', verifyRes.status, verifyText.slice(0, 500));

const script = spawnSync('npm', ['run', 'verify:audit-spine'], {
  shell: true,
  encoding: 'utf8',
  env: {
    ...process.env,
    AUTH_BEARER: idToken,
    AUDIT_SPINE_ENABLED: 'true',
    BASE_URL: base,
    TENANT_ID: tenantId,
  },
});
process.stdout.write(script.stdout || '');
if (script.stderr) process.stderr.write(script.stderr);
console.log('verify:audit-spine exit:', script.status);

const emitOk = emitRes.ok;
const verifyOk = verifyRes.ok;
let verifyJson = {};
try {
  verifyJson = JSON.parse(verifyText);
} catch {
  /* ignore */
}
const chainOk = verifyJson.ok === true;
const scriptOk = script.status === 0;

console.log(
  `\nSUMMARY emit=${emitOk ? 'PASS' : 'FAIL'} verify_http=${verifyOk ? 'PASS' : 'FAIL'} chain=${chainOk ? 'PASS' : 'FAIL'} script=${scriptOk ? 'PASS' : 'FAIL'} tenantId=${tenantId}`
);
console.log('NOTE: tamper requires migrator DB (Auth Proxy / bastion) — not in this HTTP path.');
process.exit(emitOk && verifyOk && chainOk && scriptOk ? 0 : 1);
