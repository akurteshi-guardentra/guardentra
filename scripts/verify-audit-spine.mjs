#!/usr/bin/env node
/**
 * Local / staging gate for Phase 2 audit spine (Track B1).
 * Does not provision Cloud SQL — verifies env + optional HTTP verify endpoint.
 *
 * Usage:
 *   AUDIT_SPINE_ENABLED=true AUDIT_DATABASE_URL=... node scripts/verify-audit-spine.mjs
 *   AUDIT_SPINE_ENABLED=true TENANT_ID=org_x BASE_URL=http://127.0.0.1:8080 node scripts/verify-audit-spine.mjs
 */
import process from 'node:process';

const enabled = String(process.env.AUDIT_SPINE_ENABLED || '').toLowerCase() === 'true';
const dbUrl = process.env.AUDIT_DATABASE_URL || '';
const base = (process.env.BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const tenantId = process.env.TENANT_ID || '';

console.log('Phase 2 audit spine gate');
console.log('------------------------');
console.log('AUDIT_SPINE_ENABLED:', enabled ? 'true' : 'false (default off)');
console.log('AUDIT_DATABASE_URL:', dbUrl ? '(set)' : '(missing)');
console.log('See docs/PHASE2_WEEK0_START_HERE.md and docs/FASTTRACK_PHASE2.md');

if (!enabled) {
  console.log('\nOK: spine intentionally off — App Hosting can boot without Cloud SQL.');
  process.exit(0);
}

if (!dbUrl) {
  console.error('\nFAIL: AUDIT_SPINE_ENABLED=true requires AUDIT_DATABASE_URL');
  console.error('Local: docker compose -f docker-compose.audit.yml up -d && npm run migrate:audit');
  process.exit(1);
}

if (!tenantId) {
  console.log('\nOK: env looks ready. Set TENANT_ID=... to hit GET /api/audit/verify.');
  process.exit(0);
}

const url = `${base}/api/audit/verify?tenantId=${encodeURIComponent(tenantId)}`;
try {
  const res = await fetch(url);
  const text = await res.text();
  console.log('\nGET', url, '→', res.status);
  console.log(text.slice(0, 500));
  process.exit(res.ok ? 0 : 1);
} catch (err) {
  console.error('\nFAIL: could not reach verify endpoint', err?.message || err);
  process.exit(1);
}
