import { canonicalize } from './canonicalize.ts';
import { getAuditPool } from './pool.ts';
import { GENESIS_HASH, sha256Hex } from './types.ts';

export interface VerifyResult {
  ok: boolean;
  tenantId: string;
  checked: number;
  firstBreakSeq?: number;
  message: string;
}

export async function verifyTenantChain(tenantId: string): Promise<VerifyResult> {
  const db = getAuditPool();
  if (!db) {
    return { ok: false, tenantId, checked: 0, message: 'Audit database unavailable' };
  }

  const { rows } = await db.query(
    `SELECT c.seq, c.hash, c.previous_hash, e.event_id, e.tenant_id, e.event_type,
            e.actor_id, e.actor_type, e.object_type, e.object_id, e.payload,
            e.schema_version, e.created_at
     FROM audit_hash_chain c
     JOIN audit_events e ON e.event_id = c.event_id
     WHERE c.tenant_id = $1
     ORDER BY c.seq ASC`,
    [tenantId]
  );

  let expectedPrev = GENESIS_HASH;
  for (const row of rows) {
    if (row.previous_hash !== expectedPrev) {
      return {
        ok: false,
        tenantId,
        checked: rows.length,
        firstBreakSeq: Number(row.seq),
        message: `previous_hash mismatch at seq ${row.seq}`,
      };
    }
    const recordForHash = {
      eventId: row.event_id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      actorId: row.actor_id,
      actorType: row.actor_type,
      objectType: row.object_type,
      objectId: row.object_id,
      payload: row.payload,
      schemaVersion: row.schema_version,
      seq: Number(row.seq),
    };
    const hash = sha256Hex(`${row.previous_hash}\n${canonicalize(recordForHash)}`);
    if (hash !== row.hash) {
      return {
        ok: false,
        tenantId,
        checked: rows.length,
        firstBreakSeq: Number(row.seq),
        message: `hash mismatch at seq ${row.seq}`,
      };
    }
    expectedPrev = row.hash;
  }

  return {
    ok: true,
    tenantId,
    checked: rows.length,
    message: rows.length ? `Verified ${rows.length} link(s)` : 'Empty chain',
  };
}
