// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ create: vi.fn(), db: null as any }));
vi.mock('stripe', () => ({ default: class {
  checkout = { sessions: { create: boundary.create } };
} }));
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], getApp: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => boundary.db, FieldValue: {} }));
vi.mock('../../server/middleware/requireFirebaseAuth', () => ({
  ensureAdmin: vi.fn(), isProductionLike: () => true, requireFirebaseAuth: vi.fn(),
}));
import router from '../../server/routes/stripe';

const checkout = (router as any).stack.find((layer: any) =>
  layer.route?.path === '/create-checkout-session').route.stack.at(-1).handle;
let records: Map<string, Record<string, unknown>>;
let readsFail: boolean;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_synthetic');
  vi.stubEnv('PUBLIC_APP_URL', 'https://synthetic.example');
  vi.stubEnv('STRIPE_PRICE_GROWTH_MONTHLY', 'price_synthetic_growth');
  readsFail = false;
  records = new Map([
    ['users/admin', { role: 'admin', organizationId: 'org-1' }],
    ['organizations/org-1', { planId: 'starter', subscriptionStatus: 'none' }],
  ]);
  boundary.create.mockResolvedValue({ url: 'https://synthetic.example/checkout' });
  boundary.db = { collection: (name: string) => ({ doc: (id: string) => ({
    get: async () => {
      if (readsFail) throw new Error('synthetic database unavailable');
      return { exists: records.has(`${name}/${id}`), data: () => records.get(`${name}/${id}`) };
    },
  }) }) };
});
afterEach(() => vi.unstubAllEnvs());

async function start(user: object = { uid: 'admin', email: 'admin@synthetic.example' }) {
  const res = { statusCode: 200, status(code: number) { this.statusCode = code; return this; },
    json: vi.fn().mockReturnThis() };
  await checkout({ user, body: { priceId: 'price_synthetic_growth' } }, res);
  return res;
}

describe('#144 checkout creation requires tenant billing authority', () => {
  it.each(['member', 'viewer', '', undefined])('refuses role %s before creating a Stripe session', async role => {
    records.set('users/admin', { role, organizationId: 'org-1' });
    expect((await start()).statusCode).toBe(403);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it.each(['admin', 'owner'])('preserves an initial checkout for an explicit %s', async role => {
    records.set('users/admin', { role, organizationId: 'org-1' });
    expect((await start()).statusCode).toBe(200);
    expect(boundary.create).toHaveBeenCalledWith(expect.objectContaining({
      client_reference_id: 'admin', metadata: expect.objectContaining({ organizationId: 'org-1' }),
    }));
  });
  it('refuses portal claims even if the profile has admin authority', async () => {
    expect((await start({ uid: 'admin', portalAssessmentId: 'asm-1' })).statusCode).toBe(403);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it.each(['stripeCustomerId', 'stripeSubscriptionId'])('refuses an org with existing %s', async field => {
    records.set('organizations/org-1', { [field]: 'existing-provider-id' });
    expect((await start()).statusCode).toBe(409);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it('refuses an active org even when its provider mapping is incomplete', async () => {
    records.set('organizations/org-1', { subscriptionStatus: 'active' });
    expect((await start()).statusCode).toBe(409);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it('refuses a previously linked user instead of creating another customer', async () => {
    records.set('users/admin', { role: 'admin', organizationId: 'org-1', stripeCustomerId: 'existing' });
    expect((await start()).statusCode).toBe(409);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it('fails closed when the organization is missing or cannot be read', async () => {
    records.delete('organizations/org-1');
    expect((await start()).statusCode).toBe(503);
    readsFail = true;
    expect((await start()).statusCode).toBe(503);
    expect(boundary.create).not.toHaveBeenCalled();
  });
});
