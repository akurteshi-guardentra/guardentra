import { getAuditPool, isAuditSpineEnabled } from './pool.ts';
import { redactAuditPayload } from './redact.ts';
import {
  AuditEventIdentityError,
  resolveAuditEventIdentity,
  type ResolvedAuditEventIdentity,
} from './eventIdentity.ts';
import { newEventId, type AuditEmitEnvelope } from './types.ts';

export type EmitResult =
  | { queued: true; eventId: string; sourceEventId: string }
  | { queued: false; eventId: string; sourceEventId: string; duplicate: true }
  | { queued: false; skipped: true; reason: string };

export type StoredAuditEnvelope = AuditEmitEnvelope & {
  eventId: string;
  sourceEventId: string;
  eventIdMapping: ResolvedAuditEventIdentity['mapping'];
};

function nativeIdentity(eventId: string): ResolvedAuditEventIdentity {
  return resolveAuditEventIdentity(eventId);
}

function clientPayload(input: AuditEmitEnvelope): Record<string, unknown> {
  const redacted = redactAuditPayload(input.payload || {});
  if (!redacted || typeof redacted !== 'object' || Array.isArray(redacted)) return {};
  const payload = { ...(redacted as Record<string, unknown>) };
  delete payload.auditIdentity;
  return payload;
}

function buildEnvelope(
  input: AuditEmitEnvelope,
  identity: ResolvedAuditEventIdentity,
): StoredAuditEnvelope {
  const payload = clientPayload(input);
  if (identity.mapping) {
    payload.auditIdentity = {
      mappingVersion: identity.mapping.version,
      sourceEventId: identity.sourceEventId,
      sqlEventId: identity.sqlEventId,
    };
  }
  return {
    eventId: identity.sqlEventId,
    sourceEventId: identity.sourceEventId,
    eventIdMapping: identity.mapping,
    tenantId: input.tenantId.trim(),
    eventType: input.eventType,
    actorId: input.actorId ?? null,
    actorType: input.actorType || 'user',
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    payload,
    schemaVersion: input.schemaVersion ?? 1,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function sameStoredIdentity(
  row: { tenant_id?: string; payload?: StoredAuditEnvelope },
  envelope: StoredAuditEnvelope,
): boolean {
  const stored = row.payload;
  if (!stored || row.tenant_id !== envelope.tenantId || stored.tenantId !== envelope.tenantId) {
    return false;
  }
  if (stored.eventId !== envelope.eventId || stored.sourceEventId !== envelope.sourceEventId) {
    return false;
  }
  if (stored.eventType !== envelope.eventType) return false;
  if ((stored.objectType ?? null) !== (envelope.objectType ?? null)) return false;
  if ((stored.objectId ?? null) !== (envelope.objectId ?? null)) return false;
  if (!envelope.eventIdMapping) return stored.eventIdMapping == null;
  const identity = stored.payload?.auditIdentity as
    | { mappingVersion?: string; sourceEventId?: string; sqlEventId?: string }
    | undefined;
  return (
    stored.eventIdMapping?.version === envelope.eventIdMapping.version &&
    identity?.mappingVersion === envelope.eventIdMapping.version &&
    identity?.sourceEventId === envelope.sourceEventId &&
    identity?.sqlEventId === envelope.eventId
  );
}

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

  const supplied = input.eventId?.trim() || '';
  const identity = supplied ? resolveAuditEventIdentity(supplied) : nativeIdentity(newEventId());
  const envelope = buildEnvelope(input, identity);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO audit_outbox (event_id, tenant_id, payload, status, next_attempt_at)
       VALUES ($1, $2, $3::jsonb, 'pending', now())
       ON CONFLICT (event_id) DO NOTHING
       RETURNING id`,
      [envelope.eventId, envelope.tenantId, JSON.stringify(envelope)],
    );
    let duplicate = false;
    if (!inserted.rowCount) {
      const existing = await client.query(
        `SELECT tenant_id, payload FROM audit_outbox WHERE event_id = $1`,
        [envelope.eventId],
      );
      const row = existing.rows[0] as { tenant_id?: string; payload?: StoredAuditEnvelope } | undefined;
      if (!row || !sameStoredIdentity(row, envelope)) {
        throw new AuditEventIdentityError('audit event identity conflict');
      }
      duplicate = true;
    }
    await client.query('COMMIT');
    if (duplicate) {
      return {
        queued: false,
        eventId: envelope.eventId,
        sourceEventId: envelope.sourceEventId,
        duplicate: true,
      };
    }
    return {
      queued: true,
      eventId: envelope.eventId,
      sourceEventId: envelope.sourceEventId,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
