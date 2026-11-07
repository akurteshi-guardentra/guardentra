/**
 * #124 F10 — client half of batched audit emit.
 *
 * The vendor portal used to send one /api/audit/emit request per question.
 * `createAuditBatcher` coalesces those best-effort events into
 * /api/audit/emit-batch requests of at most AUDIT_BATCH_MAX, keeps their
 * order, keeps the injected (portal) auth header provider from #63, and never
 * throws into the product flow.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIT_BATCH_MAX, createAuditBatcher, type AuditEmitInput } from '../lib/auditClient';
import { AUDIT_EMIT_BATCH_MAX } from '../../server/lib/audit/emitValidation';

const TOKEN = 'PORTAL_ID_TOKEN_SENTINEL_batch_7c21';

function event(questionId: string): AuditEmitInput {
  return {
    tenantId: 'org-1',
    eventType: 'answer.saved',
    objectType: 'assessment',
    objectId: 'a1',
    payload: { questionId },
  };
}

const portalHeaders = vi.fn(async (base: Record<string, string> = {}) => ({
  ...base,
  Authorization: `Bearer ${TOKEN}`,
}));

function fetchReturning(status: number, body: unknown = {}) {
  return vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
}

function sentEvents(fetchSpy: ReturnType<typeof vi.fn>): string[][] {
  return fetchSpy.mock.calls.map(([, init]: any) =>
    JSON.parse(init.body).events.map((e: AuditEmitInput) => e.payload?.questionId),
  );
}

describe('createAuditBatcher', () => {
  let originalFetch: typeof fetch;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalFetch = global.fetch;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    warn.mockRestore();
    vi.clearAllMocks();
  });

  it('client and server agree on the batch cap', () => {
    expect(AUDIT_BATCH_MAX).toBe(AUDIT_EMIT_BATCH_MAX);
  });

  it('coalesces queued events into one emit-batch request with portal auth after the delay', async () => {
    const fetchSpy = fetchReturning(200, { results: [], failed: 0 });
    global.fetch = fetchSpy as unknown as typeof fetch;
    const batcher = createAuditBatcher({ getAuthHeaders: portalHeaders, flushDelayMs: 1000 });

    batcher.enqueue(event('q1'));
    batcher.enqueue(event('q2'));
    batcher.enqueue(event('q3'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(batcher.pending()).toBe(3);

    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchSpy as any).mock.calls[0];
    expect(url).toBe('/api/audit/emit-batch');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(sentEvents(fetchSpy)).toEqual([['q1', 'q2', 'q3']]);
    expect(batcher.pending()).toBe(0);
  });

  it('33 answers (the staging journey count) become 2 requests, in order, capped at the batch max', async () => {
    const fetchSpy = fetchReturning(200, { results: [], failed: 0 });
    global.fetch = fetchSpy as unknown as typeof fetch;
    const batcher = createAuditBatcher({ getAuthHeaders: portalHeaders });

    const ids = Array.from({ length: 33 }, (_, i) => `q${i + 1}`);
    ids.forEach((id) => batcher.enqueue(event(id)));
    await batcher.flush();

    const batches = sentEvents(fetchSpy);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(AUDIT_BATCH_MAX);
    expect(batches.flat()).toEqual(ids);
  });

  it('keepalive flush marks the request keepalive for page hide / unload', async () => {
    const fetchSpy = fetchReturning(200, { results: [], failed: 0 });
    global.fetch = fetchSpy as unknown as typeof fetch;
    const batcher = createAuditBatcher({ getAuthHeaders: portalHeaders });
    batcher.enqueue(event('q1'));
    await batcher.flush({ keepalive: true });
    expect((fetchSpy as any).mock.calls[0][1].keepalive).toBe(true);
  });

  it('flush with nothing queued sends nothing', async () => {
    const fetchSpy = fetchReturning(200);
    global.fetch = fetchSpy as unknown as typeof fetch;
    await createAuditBatcher({ getAuthHeaders: portalHeaders }).flush();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed without a portal session: no request is sent and flush does not throw', async () => {
    const fetchSpy = fetchReturning(200);
    global.fetch = fetchSpy as unknown as typeof fetch;
    const batcher = createAuditBatcher({
      getAuthHeaders: async () => {
        throw new Error('No signed-in portal session');
      },
    });
    batcher.enqueue(event('q1'));
    await expect(batcher.flush()).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('spine disabled (503) is silent; server failure is logged by type and count only, never the token', async () => {
    global.fetch = fetchReturning(503) as unknown as typeof fetch;
    const batcher = createAuditBatcher({ getAuthHeaders: portalHeaders });
    batcher.enqueue(event('q1'));
    await batcher.flush();
    expect(warn).not.toHaveBeenCalled();

    global.fetch = fetchReturning(502, { failed: 1 }) as unknown as typeof fetch;
    batcher.enqueue(event('q2'));
    await expect(batcher.flush()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls[0]);
    expect(logged).toContain('answer.saved');
    expect(logged).toContain('1 event(s) failed');
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain('q2');
  });
});

describe('VendorPortal audit wiring (#124 F10)', () => {
  const portal = readFileSync(resolve(process.cwd(), 'src/pages/VendorPortal.tsx'), 'utf8');

  it('sends portal audit events through one batcher bound to the portal auth provider', () => {
    expect(portal).not.toContain('emitAuditBestEffort');
    expect(portal).toContain('createAuditBatcher({ getAuthHeaders: getPortalAuthHeaders })');
    expect(portal.match(/portalAudit\.enqueue\(/g)?.length).toBe(4);
  });

  it('flushes queued events before the submit request and when the page is hidden', () => {
    const start = portal.indexOf('const handleSubmit = async () => {');
    const end = portal.indexOf('\n  const goNext', start);
    const submit = portal.slice(start, end);
    const flushAt = submit.indexOf('await portalAudit.flush()');
    expect(flushAt).toBeGreaterThan(-1);
    expect(flushAt).toBeLessThan(submit.indexOf("fetch('/api/portal/submit'"));
    expect(portal).toContain("window.addEventListener('pagehide'");
    expect(portal).toContain('portalAudit.flush({ keepalive: true })');
  });
});
