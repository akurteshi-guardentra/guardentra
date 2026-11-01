/**
 * Strict field-shape checks for audit emit (Phase 2 hardening).
 * Keeps validation dependency-free; Zod can wrap these later if desired.
 */
import type { AuditEmitEnvelope } from './types.ts';

const EVENT_TYPES = new Set([
  'vendor.created',
  'vendor.imported',
  'vendor.invite_queued',
  'triage.completed',
  'assessment.created',
  'assessment.sent',
  'answer.saved',
  'evidence.uploaded',
  'answer.proposed',
  'answer.confirmed',
  'assessment.submitted',
  'exception.reviewed',
  'decision.finalized',
  'report.exported',
  'audit.chain_verified',
  'audit.chain_verification_failed',
]);

export function parseAuditEmitBody(raw: unknown): { ok: true; value: AuditEmitEnvelope } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be an object' };
  const body = raw as Record<string, unknown>;
  const allowed = new Set([
    'tenantId',
    'eventType',
    'eventId',
    'actorId',
    'actorType',
    'objectType',
    'objectId',
    'payload',
    'schemaVersion',
    'createdAt',
  ]);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) return { ok: false, error: `Unexpected field: ${key}` };
  }
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  const eventType = typeof body.eventType === 'string' ? body.eventType.trim() : '';
  if (!tenantId) return { ok: false, error: 'tenantId required' };
  if (!eventType) return { ok: false, error: 'eventType required' };
  if (!EVENT_TYPES.has(eventType)) {
    return { ok: false, error: `Unsupported eventType: ${eventType}` };
  }
  if (body.payload != null && (typeof body.payload !== 'object' || Array.isArray(body.payload))) {
    return { ok: false, error: 'payload must be an object when present' };
  }
  return {
    ok: true,
    value: {
      tenantId,
      eventType,
      eventId: typeof body.eventId === 'string' ? body.eventId : undefined,
      actorId: typeof body.actorId === 'string' ? body.actorId : null,
      actorType: (body.actorType as AuditEmitEnvelope['actorType']) || 'user',
      objectType: typeof body.objectType === 'string' ? body.objectType : undefined,
      objectId: typeof body.objectId === 'string' ? body.objectId : undefined,
      payload: (body.payload as Record<string, unknown>) || {},
      schemaVersion: typeof body.schemaVersion === 'number' ? body.schemaVersion : undefined,
      createdAt: typeof body.createdAt === 'string' ? body.createdAt : undefined,
    },
  };
}

/**
 * #124 F10 — one request can carry several audit events so a vendor clicking
 * through a long questionnaire does not burn one `/api/audit` rate-limit slot
 * per answer (60/min), which silently dropped `answer.saved` events.
 * The cap keeps a single request bounded; each event is still validated with
 * the exact single-event rules above, and any invalid event rejects the whole
 * batch before anything is authorized or written.
 */
export const AUDIT_EMIT_BATCH_MAX = 25;

export function parseAuditEmitBatchBody(
  raw: unknown,
): { ok: true; value: AuditEmitEnvelope[] } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Body must be an object' };
  }
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (key !== 'events') return { ok: false, error: `Unexpected field: ${key}` };
  }
  if (!Array.isArray(body.events)) return { ok: false, error: 'events must be an array' };
  if (body.events.length === 0) return { ok: false, error: 'events must not be empty' };
  if (body.events.length > AUDIT_EMIT_BATCH_MAX) {
    return { ok: false, error: `events must contain at most ${AUDIT_EMIT_BATCH_MAX} items` };
  }
  const value: AuditEmitEnvelope[] = [];
  for (let i = 0; i < body.events.length; i += 1) {
    const parsed = parseAuditEmitBody(body.events[i]);
    if (!parsed.ok) return { ok: false, error: `events[${i}]: ${parsed.error}` };
    value.push(parsed.value);
  }
  return { ok: true, value };
}
