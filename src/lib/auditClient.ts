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

/** Must match `AUDIT_EMIT_BATCH_MAX` in server/lib/audit/emitValidation.ts. */
export const AUDIT_BATCH_MAX = 25;

export type AuditBatcher = {
  /** Queue one event; it is sent with others after a short delay. Never throws. */
  enqueue: (input: AuditEmitInput) => void;
  /**
   * Send everything queued now, in order, in chunks of at most
   * `AUDIT_BATCH_MAX`. Best effort: never throws. Pass `keepalive` when the
   * page is being hidden or unloaded so the browser still delivers it.
   */
  flush: (opts?: { keepalive?: boolean }) => Promise<void>;
  /** Number of events waiting to be sent (for tests and diagnostics). */
  pending: () => number;
};

export type AuditBatcherOptions = AuditEmitOptions & {
  /** Delay before an automatic flush after the first queued event. */
  flushDelayMs?: number;
};

/**
 * #124 F10 — coalesces best-effort audit events into `/api/audit/emit-batch`
 * requests. Before this, the vendor portal sent one `/api/audit/emit` request
 * per "Next Question" click; the audit router allows 60 requests a minute per
 * user, so a vendor moving quickly through a long questionnaire got 429s and
 * those `answer.saved` events were dropped silently.
 *
 * Same auth contract as `emitAuditEvent`: headers come from the injected
 * provider, and a provider that fails closed means nothing is sent for that
 * flush. Logs event types and counts only; never headers, tokens or bodies.
 */
export function createAuditBatcher(opts?: AuditBatcherOptions): AuditBatcher {
  const getAuthHeaders = opts?.getAuthHeaders ?? authHeaders;
  const flushDelayMs = opts?.flushDelayMs ?? 1500;
  let queue: AuditEmitInput[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const sendChunk = async (chunk: AuditEmitInput[], keepalive: boolean) => {
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch('/api/audit/emit-batch', {
        method: 'POST',
        headers,
        body: JSON.stringify({ events: chunk }),
        ...(keepalive ? { keepalive: true } : {}),
      });
      if (response.status === 503) return; // spine disabled
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { error?: string; failed?: number };
          if (body?.error) detail = body.error;
          else if (typeof body?.failed === 'number') detail = `${body.failed} event(s) failed`;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
    } catch (err) {
      const types = Array.from(new Set(chunk.map((e) => e.eventType))).join(',');
      console.warn('auditBatch', `${chunk.length} event(s)`, types, err instanceof Error ? err.message : err);
    }
  };

  const flush = (flushOpts?: { keepalive?: boolean }): Promise<void> => {
    clearTimer();
    const keepalive = Boolean(flushOpts?.keepalive);
    // Chain after any flush already running so events stay in queue order.
    inFlight = inFlight.then(async () => {
      while (queue.length) {
        const chunk = queue.slice(0, AUDIT_BATCH_MAX);
        queue = queue.slice(AUDIT_BATCH_MAX);
        await sendChunk(chunk, keepalive);
      }
    });
    return inFlight;
  };

  const enqueue = (input: AuditEmitInput) => {
    queue.push(input);
    if (queue.length >= AUDIT_BATCH_MAX) {
      void flush();
      return;
    }
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, flushDelayMs);
    }
  };

  return { enqueue, flush, pending: () => queue.length };
}
