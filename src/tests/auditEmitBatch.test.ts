// @vitest-environment node
/**
 * #124 F10 — batched audit emit.
 *
 * Staging journey evidence (2026-10-31) showed the vendor portal sending one
 * POST /api/audit/emit per question (33 calls in one run). The audit router
 * allows 60 requests per minute per principal, so a vendor moving quickly
 * through a long questionnaire got 429s and the best-effort client dropped
 * those audit events silently. These tests cover the server half of the fix:
 * POST /api/audit/emit-batch validates and authorizes every event with the
 * single-event rules before writing any, and counts once against the limit.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

const h = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  reads: 0,
  emitted: [] as Array<Record<string, unknown>>,
  failEventIndex: -1,
}));

vi.mock('../../server/lib/adminDb.ts', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          h.reads += 1;
          const data = h.docs.get(`${name}/${id}`);
          return { exists: Boolean(data), data: () => data };
        },
      }),
    }),
  }),
}));

vi.mock('../../server/lib/audit/pool.ts', () => ({
  isAuditSpineEnabled: () => true,
}));

vi.mock('../../server/lib/audit/emitIntent.ts', () => ({
  emitAuditIntent: vi.fn(async (input: Record<string, unknown>) => {
    if (h.emitted.length === h.failEventIndex) {
      h.emitted.push({ failed: true });
      throw new Error('outbox unavailable');
    }
    h.emitted.push(input);
    return { queued: true, eventId: `evt_${h.emitted.length}`, sourceEventId: `evt_${h.emitted.length}` };
  }),
}));

vi.mock('../../server/lib/audit/verify.ts', () => ({
  verifyTenantChain: vi.fn(),
  auditVerifyHttpStatus: () => 200,
}));
vi.mock('../../server/lib/audit/export.ts', () => ({ exportTenantAudit: vi.fn() }));

import auditRoutes from '../../server/routes/audit.ts';
import { AUDIT_EMIT_BATCH_MAX, parseAuditEmitBatchBody } from '../../server/lib/audit/emitValidation.ts';
import { AuditAuthorizationError, authorizeAuditEmitBatch } from '../../server/lib/audit/authorization.ts';

function answerSaved(questionId: string, overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 'org-1',
    eventType: 'answer.saved',
    objectType: 'assessment',
    objectId: 'a1',
    payload: { questionId },
    ...overrides,
  };
}

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  // Stand-in for requireFirebaseAuth: the principal comes from test headers.
  app.use((req, _res, next) => {
    const uid = req.header('x-test-uid');
    const portal = req.header('x-test-portal');
    if (uid) (req as any).user = { uid, ...(portal ? { portalAssessmentId: portal } : {}) };
    next();
  });
  app.use('/api/audit', auditRoutes);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  h.docs.clear();
  h.docs.set('users/u1', { organizationId: 'org-1', role: 'admin' });
  h.docs.set('assessments/a1', { organizationId: 'org-1' });
  h.docs.set('assessments/a2', { organizationId: 'org-2' });
  h.reads = 0;
  h.emitted = [];
  h.failEventIndex = -1;
});

let uidCounter = 0;
/** A fresh principal per test so the module-level rate limiter never bleeds across tests. */
function freshPortalHeaders(assessmentId = 'a1') {
  uidCounter += 1;
  return {
    'content-type': 'application/json',
    'x-test-uid': `portal-${uidCounter}`,
    'x-test-portal': assessmentId,
  };
}

async function post(path: string, body: unknown, headers: Record<string, string>) {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as any };
}

describe('parseAuditEmitBatchBody', () => {
  it('accepts up to the cap and applies single-event validation to each item', () => {
    const ok = parseAuditEmitBatchBody({ events: [answerSaved('q1'), answerSaved('q2')] });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.map((e) => e.payload?.questionId)).toEqual(['q1', 'q2']);

    const full = parseAuditEmitBatchBody({
      events: Array.from({ length: AUDIT_EMIT_BATCH_MAX }, (_, i) => answerSaved(`q${i}`)),
    });
    expect(full.ok).toBe(true);
  });

  it('rejects empty, oversized, malformed and unknown-field batches', () => {
    expect(parseAuditEmitBatchBody({ events: [] })).toEqual({ ok: false, error: 'events must not be empty' });
    expect(parseAuditEmitBatchBody({ events: 'x' })).toMatchObject({ ok: false });
    expect(parseAuditEmitBatchBody([answerSaved('q1')])).toMatchObject({ ok: false });
    expect(parseAuditEmitBatchBody({ events: [answerSaved('q1')], extra: 1 })).toEqual({
      ok: false,
      error: 'Unexpected field: extra',
    });
    expect(
      parseAuditEmitBatchBody({
        events: Array.from({ length: AUDIT_EMIT_BATCH_MAX + 1 }, (_, i) => answerSaved(`q${i}`)),
      }),
    ).toMatchObject({ ok: false });
  });

  it('names the offending item when one event is invalid', () => {
    const res = parseAuditEmitBatchBody({
      events: [answerSaved('q1'), answerSaved('q2', { eventType: 'tenant.deleted' })],
    });
    expect(res).toEqual({ ok: false, error: 'events[1]: Unsupported eventType: tenant.deleted' });
  });
});

describe('authorizeAuditEmitBatch', () => {
  it('reads the scoped assessment once for many events on the same object', async () => {
    const events = parseAuditEmitBatchBody({
      events: Array.from({ length: 20 }, (_, i) => answerSaved(`q${i}`)),
    });
    if (!events.ok) throw new Error(events.error);
    const actors = await authorizeAuditEmitBatch({ uid: 'p1', portalAssessmentId: 'a1' }, events.value);
    expect(actors).toHaveLength(20);
    expect(actors.every((a) => a.actorType === 'portal' && a.actorId === 'p1' && a.tenantId === 'org-1')).toBe(true);
    expect(h.reads).toBe(1);
  });

  it('rejects the whole batch when any event is outside the portal scope', async () => {
    await expect(
      authorizeAuditEmitBatch({ uid: 'p1', portalAssessmentId: 'a1' }, [
        answerSaved('q1') as any,
        answerSaved('q2', { objectId: 'a2' }) as any,
      ]),
    ).rejects.toBeInstanceOf(AuditAuthorizationError);
  });
});

describe('POST /api/audit/emit-batch', () => {
  it('queues every event in order with server-derived actor identity', async () => {
    const res = await post(
      '/api/audit/emit-batch',
      {
        events: [
          answerSaved('q1', { actorId: 'forged', actorType: 'system' }),
          answerSaved('q2'),
          { ...answerSaved('q3'), eventType: 'evidence.uploaded' },
        ],
      },
      freshPortalHeaders(),
    );
    expect(res.status).toBe(200);
    expect(res.body.failed).toBe(0);
    expect(res.body.results.map((r: any) => r.index)).toEqual([0, 1, 2]);
    expect(h.emitted.map((e: any) => [e.eventType, e.payload.questionId])).toEqual([
      ['answer.saved', 'q1'],
      ['answer.saved', 'q2'],
      ['evidence.uploaded', 'q3'],
    ]);
    for (const e of h.emitted as any[]) {
      expect(e.actorType).toBe('portal');
      expect(e.actorId).toMatch(/^portal-/);
      expect(e.tenantId).toBe('org-1');
    }
  });

  it('writes nothing when one event fails authorization', async () => {
    const res = await post(
      '/api/audit/emit-batch',
      { events: [answerSaved('q1'), { ...answerSaved('q2'), eventType: 'decision.finalized' }] },
      freshPortalHeaders(),
    );
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('portal_audit_event_forbidden');
    expect(h.emitted).toHaveLength(0);
  });

  it('writes nothing for an invalid batch and requires an authenticated principal', async () => {
    const invalid = await post('/api/audit/emit-batch', { events: [] }, freshPortalHeaders());
    expect(invalid.status).toBe(400);
    const anon = await post(
      '/api/audit/emit-batch',
      { events: [answerSaved('q1')] },
      { 'content-type': 'application/json' },
    );
    expect(anon.status).toBe(401);
    expect(h.emitted).toHaveLength(0);
  });

  it('reports a per-event write failure as 502 without hiding the events that were queued', async () => {
    h.failEventIndex = 1;
    const res = await post(
      '/api/audit/emit-batch',
      { events: [answerSaved('q1'), answerSaved('q2'), answerSaved('q3')] },
      freshPortalHeaders(),
    );
    expect(res.status).toBe(502);
    expect(res.body.failed).toBe(1);
    expect(res.body.results[0]).toMatchObject({ index: 0, queued: true });
    expect(res.body.results[1]).toEqual({ index: 1, error: 'outbox unavailable' });
    expect(res.body.results[2]).toMatchObject({ index: 2, queued: true });
  });

  it('regression: 75 answers in one minute are all queued via batches, while single emits hit 429 at 61', async () => {
    const headers = freshPortalHeaders();
    for (let b = 0; b < 3; b += 1) {
      const res = await post(
        '/api/audit/emit-batch',
        { events: Array.from({ length: 25 }, (_, i) => answerSaved(`q${b * 25 + i}`)) },
        headers,
      );
      expect(res.status).toBe(200);
    }
    expect(h.emitted).toHaveLength(75);

    const singles = freshPortalHeaders();
    const statuses: number[] = [];
    for (let i = 0; i < 61; i += 1) {
      statuses.push((await post('/api/audit/emit', answerSaved(`s${i}`), singles)).status);
    }
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
  });
});
