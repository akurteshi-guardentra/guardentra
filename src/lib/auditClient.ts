import { authHeaders, type AuthHeaderProvider } from './authHeaders';

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

export type AuditEmitOptions = {
  /**
   * Header provider for this call. Defaults to the default-app `authHeaders`
   * (org/admin path — unchanged). Vendor-portal call sites must pass
   * `getPortalAuthHeaders` from `lib/vendor/portalAuth.ts` explicitly instead
   * of relying on this default, so a portal-originated event can never be
   * authorized (or silently dropped) using the wrong Firebase app's session
   * (GitHub #63).
   */
  getAuthHeaders?: AuthHeaderProvider;
};

export async function emitAuditEvent(input: AuditEmitInput, opts?: AuditEmitOptions): Promise<void> {
  const getAuthHeaders = opts?.getAuthHeaders ?? authHeaders;
  // Header resolution happens before the request is built. A provider that
  // fails closed (e.g. no signed-in portal session) throws here, so no
  // request — authenticated or not — is ever sent for that call.
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/audit/emit', {
    method: 'POST',
    headers,
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

/**
 * Never blocks the product action on audit failure. Still fails closed at the
 * network layer (see `emitAuditEvent`) — this only prevents that failure from
 * propagating to the caller's UI flow. Logs the event type and error only;
 * never headers, tokens, or request bodies.
 */
export async function emitAuditBestEffort(input: AuditEmitInput, opts?: AuditEmitOptions): Promise<void> {
  try {
    await emitAuditEvent(input, opts);
  } catch (err) {
    console.warn('emitAuditBestEffort', input.eventType, err instanceof Error ? err.message : err);
  }
}
