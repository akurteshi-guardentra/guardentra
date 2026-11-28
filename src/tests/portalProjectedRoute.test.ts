// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ verify: vi.fn(), mint: vi.fn(), read: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: boundary.verify, createCustomToken: boundary.mint }) }));
vi.mock('../../server/middleware/requireFirebaseAuth', () => ({ ensureAdmin: vi.fn() }));
vi.mock('../../server/lib/adminDb', () => ({ getAdminDb: () => ({
  collection: (name: string) => ({ doc: (id: string) => ({ get: () => boundary.read(name, id) }) }),
}) }));
import router from '../../server/routes/portal';
const handler = (path: string) => (router as any).stack.find((l: any) => l.route?.path === path).route.stack.at(-1).handle;
const legacy = { status: 'Completed', portalOpen: false, vendorName: 'Vendor', requesterOrgName: 'Org',
  completedAt: '2026-11-01T00:00:00Z', decisionOutcome: 'approved', decisionNotes: 'internal note', decidedByName: 'reviewer@example.com' };
beforeEach(() => {
  vi.clearAllMocks();
  boundary.verify.mockResolvedValue({ uid: 'portal_a', portalAssessmentId: 'a' });
  boundary.mint.mockResolvedValue('synthetic-custom-token');
  boundary.read.mockResolvedValue({ exists: true, data: () => legacy });
});
async function call(path: string, id = 'a', authorization = 'Bearer synthetic') {
  const res = { statusCode: 200, body: null as any,
    status(n: number) { this.statusCode = n; return this; },
    json(body: unknown) { this.body = body; return this; } };
  await handler(path)({ headers: { authorization }, body: { assessmentId: id } }, res);
  return res;
}
describe('#124 actual portal projected routes', () => {
  it('serves a safe historical receipt from the existing session read', async () => {
    const res = await call('/session');
    expect(res.statusCode).toBe(200);
    expect(res.body.assessmentReadMode).toBe('projected');
    expect(res.body.assessment).toMatchObject({ vendorName: 'Vendor', status: 'Completed', decisionOutcome: 'approved' });
    expect(JSON.stringify(res.body)).not.toContain('internal note');
    expect(JSON.stringify(res.body)).not.toContain('reviewer@example.com');
    expect(boundary.read).toHaveBeenCalledTimes(1);
  });
  it('keeps direct scan reads available for documents without private fields', async () => {
    boundary.read.mockResolvedValue({ exists: true, data: () => ({ status: 'In Progress', portalOpen: true, requesterOrgName: 'Org' }) });
    expect((await call('/session')).body.assessmentReadMode).toBe('direct');
  });
  it('applies the same projection to a same-assessment authenticated refresh', async () => {
    const res = await call('/assessment-view');
    expect(res.statusCode).toBe(200);
    expect(res.body.assessment.completedAt).toBe(legacy.completedAt);
    expect(res.body.assessment).not.toHaveProperty('decisionNotes');
    expect(boundary.mint).not.toHaveBeenCalled();
  });
  it('refuses cross-assessment identity before database lookup', async () => {
    expect((await call('/assessment-view', 'other')).statusCode).toBe(403);
    expect(boundary.read).not.toHaveBeenCalled();
  });
  it('refuses an organization token and an unauthenticated request', async () => {
    boundary.verify.mockResolvedValue({ uid: 'org-admin' });
    expect((await call('/assessment-view')).statusCode).toBe(403);
    expect((await call('/assessment-view', 'a', '')).statusCode).toBe(401);
    expect(boundary.read).not.toHaveBeenCalled();
  });
  it('does not disclose missing or closed never-submitted documents', async () => {
    boundary.read.mockResolvedValue({ exists: false });
    expect((await call('/assessment-view')).statusCode).toBe(404);
    boundary.read.mockResolvedValue({ exists: true, data: () => ({ status: 'Not Started', portalOpen: false }) });
    expect((await call('/assessment-view')).statusCode).toBe(403);
  });
  it('reports persistence failure without returning an assessment', async () => {
    boundary.read.mockRejectedValue(new Error('synthetic failure'));
    const res = await call('/assessment-view');
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toHaveProperty('assessment');
  });
});
