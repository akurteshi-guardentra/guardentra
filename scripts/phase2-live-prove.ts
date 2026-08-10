/**
 * Live Path A prove: emit → outbox drain → verify OK → tamper → verify FAIL → restore.
 * Requires Docker audit DB (scripts/phase2-local-spine.ps1).
 *
 * Usage:
 *   AUDIT_SPINE_ENABLED=true \
 *   AUDIT_DATABASE_URL=postgres://audit_app:audit_app@localhost:5433/guardentra_audit \
 *   AUDIT_DATABASE_URL_MIGRATOR=postgres://audit_migrator:audit_migrator@localhost:5433/guardentra_audit \
 *   npx tsx scripts/phase2-live-prove.ts
 */
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';
import { emitAuditIntent } from '../server/lib/audit/emitIntent.ts';
import { processAuditOutboxBatch } from '../server/lib/audit/worker.ts';
import { verifyTenantChain } from '../server/lib/audit/verify.ts';
import { closeAuditPool } from '../server/lib/audit/pool.ts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Client } = pg;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  console.log('Phase 2 live spine prove (emit / drain / tamper)');
  console.log('-------------------------------------------------');

  requireEnv('AUDIT_DATABASE_URL');
  const migratorUrl = requireEnv('AUDIT_DATABASE_URL_MIGRATOR');
  if (String(process.env.AUDIT_SPINE_ENABLED || '').toLowerCase() !== 'true') {
    throw new Error('AUDIT_SPINE_ENABLED must be true');
  }

  const tenantId = `prove_${Date.now()}`;
  const emit = await emitAuditIntent({
    tenantId,
    eventType: 'vendor.created',
    actorType: 'system',
    objectType: 'vendor',
    objectId: 'prove-vendor-1',
    payload: { source: 'phase2-live-prove' },
  });
  if (!('queued' in emit) || !emit.queued) {
    throw new Error(`emit failed: ${JSON.stringify(emit)}`);
  }
  console.log('emit queued:', emit.eventId);

  const drained = await processAuditOutboxBatch(20);
  console.log('outbox drained:', drained);

  const ok = await verifyTenantChain(tenantId);
  console.log('verify after emit:', ok.ok ? 'PASS' : `FAIL (${ok.message})`, `checked=${ok.checked}`);
  if (!ok.ok) process.exit(1);

  const migrator = new Client({ connectionString: migratorUrl });
  await migrator.connect();
  try {
    const row = await migrator.query<{ hash: string; seq: number }>(
      `SELECT hash, seq FROM audit_hash_chain WHERE tenant_id = $1 ORDER BY seq ASC LIMIT 1`,
      [tenantId]
    );
    if (!row.rowCount) throw new Error('no chain row to tamper');
    const original = row.rows[0].hash;
    const seq = row.rows[0].seq;

    await migrator.query(`UPDATE audit_hash_chain SET hash = $1 WHERE tenant_id = $2 AND seq = $3`, [
      'deadbeef'.padEnd(64, '0'),
      tenantId,
      seq,
    ]);
    const bad = await verifyTenantChain(tenantId);
    console.log(
      'verify after tamper:',
      !bad.ok ? 'PASS (detected)' : 'FAIL (missed tamper)',
      bad.message || ''
    );
    if (bad.ok) process.exit(1);

    await migrator.query(`UPDATE audit_hash_chain SET hash = $1 WHERE tenant_id = $2 AND seq = $3`, [
      original,
      tenantId,
      seq,
    ]);
    const restored = await verifyTenantChain(tenantId);
    console.log('verify after restore:', restored.ok ? 'PASS' : `FAIL (${restored.message})`);
    if (!restored.ok) process.exit(1);
  } finally {
    await migrator.end();
  }

  await closeAuditPool();
  console.log('\nLive prove green.');
}

main().catch(async (err) => {
  console.error('Live prove FAILED:', err?.message || err);
  try {
    await closeAuditPool();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
