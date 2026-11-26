// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ db: vi.fn(), ensureAdmin: vi.fn() }));
vi.mock('../../server/lib/adminDb', () => ({ getAdminDb: boundary.db }));
vi.mock('../../server/middleware/requireFirebaseAuth', () => ({ ensureAdmin: boundary.ensureAdmin }));
import { handleOrgVendorArchive, handleOrgVendorCreate } from '../../server/lib/vendorMutation';
import notifyRouter from '../../server/routes/notify';

const mail = (notifyRouter as any).stack.find((layer: any) => layer.route?.path === '/mail')
  .route.stack[0].handle;
const principal = { uid: 'portal_synthetic-assessment', portalAssessmentId: 'synthetic-assessment' };
function response() {
  return { statusCode: 200, body: null as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; } };
}
beforeEach(() => {
  vi.clearAllMocks();
  boundary.db.mockImplementation(() => { throw new Error('Database access forbidden by synthetic test'); });
});

describe('#210 portal tokens never acquire organization API authority from a profile', () => {
  it.each([handleOrgVendorCreate, handleOrgVendorArchive])(
    'refuses vendor mutation %s before reading an admin-shaped profile', async handler => {
      const deps = {
        verifyIdToken: vi.fn(async () => principal as any),
        getUser: vi.fn(async () => ({ organizationId: 'synthetic-org', role: 'admin' })),
        createVendor: vi.fn(async () => ({ vendorId: 'synthetic-vendor', deduplicated: false })),
        archiveVendor: vi.fn(async () => ({ vendorId: 'synthetic-vendor', alreadyArchived: false })),
      };
      const res = response();
      await handler({ headers: { authorization: 'Bearer synthetic' }, body: {
        vendorId: 'synthetic-vendor', name: 'Synthetic Vendor', category: 'SaaS', criticality: 'Low',
        primaryContactEmail: 'vendor@synthetic.example', source: 'create',
      } } as any, res as any, deps);
      expect(res.statusCode).toBe(403);
      expect(deps.getUser).not.toHaveBeenCalled();
      expect(deps.createVendor).not.toHaveBeenCalled();
      expect(deps.archiveVendor).not.toHaveBeenCalled();
    },
  );

  it.each(['vendor_welcome', 'assessment_invite', 'assessment_reminder'])(
    'refuses portal mail intent %s before database or queue work', async intentType => {
      const res = response();
      await mail({ user: principal, body: { intentType, objectId: 'synthetic-object' } }, res);
      expect(res.statusCode).toBe(403);
      expect(boundary.db).not.toHaveBeenCalled();
      expect(boundary.ensureAdmin).not.toHaveBeenCalled();
    },
  );
  it('does not classify an ordinary organization principal as a portal token', async () => {
    const res = response();
    await mail({ user: { uid: 'synthetic-member' }, body: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('invalid_intent_shape');
  });
});
