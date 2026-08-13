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
