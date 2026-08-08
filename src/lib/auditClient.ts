import { authHeaders } from './authHeaders';

export type AuditEmitInput = {
  eventId?: string;
  tenantId: string;
  eventType: string;
  actorId?: string | null;
  actorType?: string;
  objectType?: string | null;
  objectId?: string | null;
  payload?: Record<string, unknown>;
};

export async function emitAuditEvent(input: AuditEmitInput): Promise<void> {
  const response = await fetch('/api/audit/emit', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  if (response.status === 503) return; // spine disabled
  if (!response.ok) {
    let detail = 'Failed to queue audit event';
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

/** Never blocks the product action on audit failure. */
export async function emitAuditBestEffort(input: AuditEmitInput): Promise<void> {
  try {
    await emitAuditEvent(input);
  } catch (err) {
    console.warn('emitAuditBestEffort', input.eventType, err);
  }
}
