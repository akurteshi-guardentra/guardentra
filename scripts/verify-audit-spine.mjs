#!/usr/bin/env node
/**
 * Local / staging gate for Phase 2 audit spine (Track B1).
 * Does not provision Cloud SQL — verifies env + optional HTTP verify endpoint.
 *
 * Usage:
 *   AUDIT_SPINE_ENABLED=true AUDIT_DATABASE_URL=... node scripts/verify-audit-spine.mjs
 *   AUDIT_SPINE_ENABLED=true TENANT_ID=org_x BASE_URL=http://127.0.0.1:8080 node scripts/verify-audit-spine.mjs
 *   # Staging App Hosting / tagged Cloud Run (APP_ENV=production|staging requires Firebase ID token):
 *   AUDIT_SPINE_ENABLED=true TENANT_ID=org_x BASE_URL=https://… AUTH_BEARER=<firebase_id_token> \
 *     node scripts/verify-audit-spine.mjs
 *
 * Optional AUTH_BEARER / FIREBASE_ID_TOKEN: Authorization: Bearer … (required when APP_ENV is production|staging).
 * For tagged *.run.app revisions: use `gcloud run services proxy … --tag=auditspine` and BASE_URL=http://127.0.0.1:PORT
 * so Cloud Run IAM is handled by the proxy; do not try to send both IAM + Firebase tokens in one header.
 */
import process from 'node:process';

const enabled = String(process.env.AUDIT_SPINE_ENABLED || '').toLowerCase() === 'true';
const dbUrl = process.env.AUDIT_DATABASE_URL || '';
const base = (process.env.BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const tenantId = process.env.TENANT_ID || '';
const authBearer = process.env.AUTH_BEARER || process.env.FIREBASE_ID_TOKEN || '';

console.log('Phase 2 audit spine gate');
console.log('------------------------');
console.log('AUDIT_SPINE_ENABLED:', enabled ? 'true' : 'false (default off)');
console.log('AUDIT_DATABASE_URL:', dbUrl ? '(set)' : '(missing)');
console.log('AUTH_BEARER:', authBearer ? '(set)' : '(none)');
console.log('See docs/PHASE2_WEEK0_START_HERE.md and docs/FASTTRACK_PHASE2.md');

if (!enabled) {
  console.log('\nOK: spine intentionally off — App Hosting can boot without Cloud SQL.');
  process.exit(0);
}

const httpOnlyProve =
  Boolean(authBearer) ||
  base.includes('run.app') ||
  base.includes('hosted.app') ||
  base.includes('guardentra.com');

if (!dbUrl && !httpOnlyProve) {
  console.error('\nFAIL: AUDIT_SPINE_ENABLED=true requires AUDIT_DATABASE_URL');
  console.error('Local: docker compose -f docker-compose.audit.yml up -d && npm run migrate:audit');
  console.error('HTTP staging: set BASE_URL + AUTH_BEARER (and TENANT_ID) instead.');
  process.exit(1);
}

if (!tenantId) {
  console.log('\nOK: env looks ready. Set TENANT_ID=... to hit GET /api/audit/verify.');
  process.exit(0);
}

const url = `${base}/api/audit/verify?tenantId=${encodeURIComponent(tenantId)}`;
const headers = {};
if (authBearer) headers.Authorization = `Bearer ${authBearer}`;
try {
  const res = await fetch(url, { headers });
  const text = await res.text();
  console.log('\nGET', url, '→', res.status);
  console.log(text.slice(0, 500));
  if (res.status === 401) {
    console.error(
      '\nHINT: staging/prod require AUTH_BEARER=<Firebase ID token>. For tagged run.app use gcloud run services proxy then BASE_URL=http://127.0.0.1:<port>.'
    );
  }
  if (res.status === 403 && base.includes('run.app')) {
    console.error('\nHINT: 403 on *.run.app is usually Cloud Run IAM — use gcloud run services proxy --tag=auditspine.');
  }
  process.exit(res.ok ? 0 : 1);
} catch (err) {
  console.error('\nFAIL: could not reach verify endpoint', err?.message || err);
  process.exit(1);
}
