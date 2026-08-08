import { createHash, randomUUID } from 'node:crypto';

export type AuditActorType = 'user' | 'portal' | 'system' | 'worker';

export type AuditEventType =
  | 'vendor.created'
  | 'vendor.imported'
  | 'vendor.invite_queued'
  | 'triage.completed'
  | 'assessment.created'
  | 'assessment.sent'
  | 'answer.saved'
  | 'evidence.uploaded'
  | 'answer.proposed'
  | 'answer.confirmed'
  | 'assessment.submitted'
  | 'exception.reviewed'
  | 'decision.finalized'
  | 'report.exported'
  | 'audit.chain_verified';

export interface AuditEmitEnvelope {
  eventId?: string;
  tenantId: string;
  eventType: AuditEventType | string;
  actorId?: string | null;
  actorType?: AuditActorType;
  objectType?: string | null;
  objectId?: string | null;
  payload?: Record<string, unknown>;
  schemaVersion?: number;
  createdAt?: string;
}

export const GENESIS_HASH = 'GENESIS';

export function newEventId(): string {
  return randomUUID();
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
