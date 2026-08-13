import { getAuditPool, isAuditSpineEnabled } from './pool.ts';
import { redactAuditPayload } from './redact.ts';
import { newEventId, type AuditEmitEnvelope } from './types.ts';

export type EmitResult =
  | { queued: true; eventId: string }
  | { queued: false; eventId: string; duplicate: true }
  | { queued: false; skipped: true; reason: string };

export async function emitAuditIntent(input: AuditEmitEnvelope): Promise<EmitResult> {
  if (!isAuditSpineEnabled()) {
    return { queued: false, skipped: true, reason: 'AUDIT_SPINE_ENABLED=false' };
  }
  const db = getAuditPool();
  if (!db) {
    return { queued: false, skipped: true, reason: 'no_database' };
  }
  if (!input.tenantId?.trim() || !input.eventType?.trim()) {
    throw new Error('tenantId and eventType are required');
  }

  const eventId = input.eventId || newEventId();
  const envelope = {
    eventId,
    tenantId: input.tenantId.trim(),
    eventType: input.eventType,
    actorId: input.actorId ?? null,
    actorType: input.actorType || 'user',
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    payload: redactAuditPayload(input.payload || {}) as Record<string, unknown>,
    schemaVersion: input.schemaVersion ?? 1,
    createdAt: input.createdAt || new Date().toISOString(),
  };

  const result = await db.query(
    `INSERT INTO audit_outbox (event_id, tenant_id, payload, status, next_attempt_at)
     VALUES ($1, $2, $3::jsonb, 'pending', now())
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [eventId, envelope.tenantId, JSON.stringify(envelope)]
  );

  if (!result.rowCount) {
    return { queued: false, eventId, duplicate: true };
  }
  return { queued: true, eventId };
}
