// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  rows: new Map<string, { tenant_id: string; payload: any }>(),
  connects: 0,
  query: vi.fn(),
}));
vi.mock('../../server/lib/audit/pool.ts', () => ({
  isAuditSpineEnabled: () => true,
  getAuditPool: () => ({ connect: async () => {
    h.connects += 1;
    return { query: h.query, release: vi.fn() };
  } }),
}));
vi.mock('../../server/lib/adminDb.ts', () => ({
  getAdminDb: () => ({ collection: (name: string) => ({ doc: (id: string) => ({
    get: async () => ({ exists: true, data: () => name === 'users'
      ? { organizationId: 'org-test', role: 'admin' }
      : { organizationId: 'org-test' } }),
  }) }) }),
}));
vi.mock('../../server/lib/audit/verify.ts', () => ({
  verifyTenantChain: vi.fn(), auditVerifyHttpStatus: () => 200,
}));
vi.mock('../../server/lib/audit/export.ts', () => ({ exportTenantAudit: vi.fn() }));

import router from '../../server/routes/audit';
import { emitAuditIntent } from '../../server/lib/audit/emitIntent';
import { materialAuditEventId } from '../../server/lib/audit/materialIntent';
import { resolveAuditEventIdentity } from '../../server/lib/audit/eventIdentity';

const materialId = materialAuditEventId(['org-test', 'assessment.submitted', 'a-test', 'cycle-test']);
const mappedId = resolveAuditEventIdentity(materialId).sqlEventId;
const principals = [
  { uid: 'portal-test', portalAssessmentId: 'a-test' },
  { uid: 'user-test' },
];
const paths = ['/emit', '/emit-batch'];
const materialTypes = [
  'vendor.created', 'vendor.imported', 'vendor.invite_queued', 'triage.completed',
  'assessment.created', 'assessment.sent', 'assessment.submitted', 'decision.finalized',
];
function event(extra: Record<string, unknown> = {}) {
  return { tenantId: 'org-test', eventType: 'answer.saved', objectType: 'assessment',
    objectId: 'a-test', payload: { note: 'synthetic-client' }, ...extra };
}
async function deliver(path: string, principal: object, input: Record<string, unknown>) {
  const handler = (router as any).stack.find((layer: any) => layer.route?.path === path)
    .route.stack[0].handle;
  const res = { statusCode: 200, body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; } };
  // Include a valid first event so batch failure must happen before *any* write.
  const body = path === '/emit-batch' ? { events: [event(), input] } : input;
  await handler({ user: principal, body }, res);
  return res;
}

beforeEach(() => {
  h.rows.clear(); h.connects = 0; h.query.mockReset();
  // Only SQL transport is simulated. Route, parser, authorization, identity
  // mapping and emitAuditIntent are the actual source. No server/network/DB.
  h.query.mockImplementation(async (sql: string, values: any[] = []) => {
    if (sql.startsWith('INSERT INTO audit_outbox')) {
      if (h.rows.has(values[0])) return { rowCount: 0, rows: [] };
      h.rows.set(values[0], { tenant_id: values[1], payload: JSON.parse(values[2]) });
      return { rowCount: 1, rows: [{ id: 'synthetic-row' }] };
    }
    if (sql.includes('SELECT tenant_id, payload FROM audit_outbox')) {
      const row = h.rows.get(values[0]);
      return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
    }
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rowCount: 0, rows: [] };
    throw new Error('Unexpected SQL in synthetic fixture');
  });
});

describe('#74 browser audit vs canonical material identities', () => {
  for (const path of paths) {
    for (const principal of principals) {
      const kind = 'portalAssessmentId' in principal ? 'portal' : 'org';
      it(`${path} ${kind} cannot preplay a canonical submission before the real journal`, async () => {
        const input = event({ eventType: 'assessment.submitted', eventId: materialId });
        const res = await deliver(path, principal, input);
        expect(res.statusCode).toBe(400);
        expect(h.connects).toBe(0);
        expect(h.rows.size).toBe(0);
        const trusted = { ...input, eventId: materialId, eventType: 'assessment.submitted',
          tenantId: 'org-test', objectType: 'assessment', objectId: 'a-test',
          actorType: 'system' as const, payload: { note: 'synthetic-server-attested' } };
        expect(await emitAuditIntent(trusted)).toMatchObject({ queued: true, eventId: mappedId });
        expect(h.rows.get(mappedId)?.payload.payload.note).toBe('synthetic-server-attested');
        expect(await emitAuditIntent(trusted)).toMatchObject({ duplicate: true, queued: false });
      });
      it.each([materialId, mappedId, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'])(
        `${path} ${kind} rejects a supplied identity %s even for ordinary telemetry`, async eventId => {
          expect((await deliver(path, principal, event({ eventId }))).statusCode).toBe(400);
          expect(h.connects).toBe(0); expect(h.rows.size).toBe(0);
        },
      );
      it(`${path} ${kind} keeps ordinary scoped telemetry with server-generated UUIDs`, async () => {
        expect((await deliver(path, principal, event())).statusCode).toBe(200);
        for (const [id, row] of h.rows) {
          expect(id).toMatch(/^[0-9a-f-]{36}$/);
          expect(id).not.toBe(mappedId);
          expect(row.payload.eventType).toBe('answer.saved');
          expect(row.payload.actorId).toBe(principal.uid);
        }
        expect(h.rows.size).toBe(path === '/emit-batch' ? 2 : 1);
      });
    }
    it.each(materialTypes)(`${path} refuses org-authored journal event %s without an id`, async eventType => {
      const objectType = eventType.startsWith('vendor.') || eventType === 'triage.completed'
        ? 'vendor' : 'assessment';
      expect((await deliver(path, { uid: 'user-test' }, event({ eventType, objectType }))).statusCode).toBe(400);
      expect(h.connects).toBe(0); expect(h.rows.size).toBe(0);
    });
  }
});
