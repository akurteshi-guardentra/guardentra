import { getAuditPool, isAuditSpineEnabled } from './pool.ts';
import { persistOutboxPayload } from './hashChain.ts';
import type { AuditEmitEnvelope } from './types.ts';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

function maxAttempts(): number {
  return Math.max(1, parseInt(process.env.AUDIT_OUTBOX_MAX_ATTEMPTS || '8', 10) || 8);
}

function pollMs(): number {
  return Math.max(500, parseInt(process.env.AUDIT_WORKER_POLL_MS || '2000', 10) || 2000);
}

function workerEnabled(): boolean {
  if (!isAuditSpineEnabled()) return false;
  const raw = (process.env.AUDIT_WORKER_ENABLED || 'true').toLowerCase();
  return raw !== 'false' && raw !== '0';
}

export async function processAuditOutboxBatch(limit = 20): Promise<number> {
  const db = getAuditPool();
  if (!db) return 0;

  const claimed = await db.query(
    `UPDATE audit_outbox
     SET status = 'processing', updated_at = now()
     WHERE id IN (
       SELECT id FROM audit_outbox
       WHERE status = 'pending' AND next_attempt_at <= now()
       ORDER BY id
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     RETURNING id, event_id, tenant_id, payload, attempts`,
    [limit]
  );

  let ok = 0;
  for (const row of claimed.rows) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const envelope = row.payload as AuditEmitEnvelope & { eventId: string };
      if (!envelope.eventId) envelope.eventId = row.event_id;
      await persistOutboxPayload(client, envelope);
      await client.query(
        `UPDATE audit_outbox SET status = 'acked', updated_at = now(), last_error = NULL WHERE id = $1`,
        [row.id]
      );
      await client.query('COMMIT');
      ok += 1;
    } catch (err: any) {
      await client.query('ROLLBACK');
      const attempts = Number(row.attempts || 0) + 1;
      const dead = attempts >= maxAttempts();
      const backoffSec = Math.min(3600, 2 ** Math.min(attempts, 10));
      await db.query(
        `UPDATE audit_outbox
         SET status = $2,
             attempts = $3,
             next_attempt_at = now() + ($4 || ' seconds')::interval,
             last_error = $5,
             updated_at = now()
         WHERE id = $1`,
        [row.id, dead ? 'dead' : 'pending', attempts, String(backoffSec), String(err?.message || err).slice(0, 2000)]
      );
      console.error('[audit-worker] persist failed', row.event_id, err?.message || err);
    } finally {
      client.release();
    }
  }
  return ok;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await processAuditOutboxBatch();
  } catch (err) {
    console.error('[audit-worker] tick error', err);
  } finally {
    running = false;
  }
}

export function startAuditWorker(): void {
  if (!workerEnabled()) {
    console.log('[audit-worker] disabled');
    return;
  }
  if (timer) return;
  console.log(`[audit-worker] starting poll every ${pollMs()}ms`);
  void tick();
  timer = setInterval(() => void tick(), pollMs());
}

export function stopAuditWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
