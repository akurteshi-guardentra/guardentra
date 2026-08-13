#!/usr/bin/env node
/**
 * Prove audit hash-chain + emit shape without requiring live App Hosting.
 * With AUDIT_DATABASE_URL set, also runs verify:audit-spine.
 *
 * Usage: npm run phase2:spine-prove
 */
import process from 'node:process';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

console.log('Phase 2 spine prove');
console.log('-------------------');

const GENESIS = 'GENESIS';
const e1 = { event_id: randomUUID(), payload: '{"a":1}' };
const h1 = sha256(`${GENESIS}|${e1.event_id}|${e1.payload}`);
const broken = sha256(`${GENESIS}|${e1.event_id}|TAMPERED`);
const chainOk = h1 === sha256(`${GENESIS}|${e1.event_id}|${e1.payload}`) && broken !== h1;
console.log('Pure chain integrity:', chainOk ? 'PASS' : 'FAIL');
console.log('Tamper changes hash:', broken !== h1 ? 'PASS' : 'FAIL');

const vitest = spawnSync(
  'npx',
  ['vitest', 'run', 'src/tests/emitValidation.test.ts', '--reporter=dot'],
  { stdio: 'inherit', shell: true }
);
const emitOk = vitest.status === 0;
console.log('Emit validation suite:', emitOk ? 'PASS' : 'FAIL');

const e2e = spawnSync('npm', ['run', 'test:e2e-gate'], { stdio: 'inherit', shell: true });
const e2eOk = e2e.status === 0;
console.log('E2E FastTrack gate:', e2eOk ? 'PASS' : 'FAIL');

const enabled = String(process.env.AUDIT_SPINE_ENABLED || '').toLowerCase() === 'true';
const dbUrl = process.env.AUDIT_DATABASE_URL || '';
const migratorUrl = process.env.AUDIT_DATABASE_URL_MIGRATOR || '';
let liveOk = true;
if (enabled && dbUrl && migratorUrl) {
  console.log('DB configured — running live emit/verify/tamper...');
  const live = spawnSync('npm', ['run', 'phase2:live-prove'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  liveOk = live.status === 0;
  console.log('Live DB prove:', liveOk ? 'PASS' : 'FAIL');
} else if (enabled && dbUrl) {
  console.log('DB configured — running verify:audit-spine...');
  const r = spawnSync('npm', ['run', 'verify:audit-spine'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status || 1);
} else {
  console.log('DB not enabled — skipped live verify (Path A: scripts/phase2-local-spine.ps1).');
}

const ok = chainOk && emitOk && e2eOk && liveOk;
console.log(ok ? '\nDone — prove green.' : '\nDone — prove FAILED.');
process.exit(ok ? 0 : 1);
