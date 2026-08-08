import type pg from 'pg';
import { canonicalize } from './canonicalize.ts';
import { GENESIS_HASH, sha256Hex, type AuditEmitEnvelope } from './types.ts';

export async function persistOutboxPayload(
  client: pg.PoolClient,
  envelope: AuditEmitEnvelope & { eventId: string }
): Promise<void> {
  const existing = await client.query(`SELECT 1 FROM audit_events WHERE event_id = $1`, [
    envelope.eventId,
  ]);
  if (existing.rowCount) return;

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [envelope.tenantId]);

  const last = await client.query(
    `SELECT hash, seq FROM audit_hash_chain
     WHERE tenant_id = $1
     ORDER BY seq DESC
     LIMIT 1`,
    [envelope.tenantId]
  );
  const previousHash = last.rows[0]?.hash || GENESIS_HASH;
  const nextSeq = Number(last.rows[0]?.seq || 0) + 1;

  await client.query(
    `INSERT INTO audit_events (
       event_id, tenant_id, event_type, actor_id, actor_type,
       object_type, object_id, payload, schema_version, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9, now())`,
    [
      envelope.eventId,
      envelope.tenantId,
      envelope.eventType,
      envelope.actorId ?? null,
      envelope.actorType || 'user',
      envelope.objectType ?? null,
      envelope.objectId ?? null,
      JSON.stringify(envelope.payload || {}),
      envelope.schemaVersion ?? 1,
    ]
  );

  // Omit wall-clock timestamps from the hash input so PG timestamptz round-trips
  // cannot break verification; seq + eventId establish order.
  const recordForHash = {
    eventId: envelope.eventId,
    tenantId: envelope.tenantId,
    eventType: envelope.eventType,
    actorId: envelope.actorId ?? null,
    actorType: envelope.actorType || 'user',
    objectType: envelope.objectType ?? null,
    objectId: envelope.objectId ?? null,
    payload: envelope.payload || {},
    schemaVersion: envelope.schemaVersion ?? 1,
    seq: nextSeq,
  };
  const hash = sha256Hex(`${previousHash}\n${canonicalize(recordForHash)}`);

  await client.query(
    `INSERT INTO audit_hash_chain (tenant_id, event_id, seq, hash, previous_hash)
     VALUES ($1,$2,$3,$4,$5)`,
    [envelope.tenantId, envelope.eventId, nextSeq, hash, previousHash]
  );
}
