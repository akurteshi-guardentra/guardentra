// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  constructEvent: vi.fn(), retrieve: vi.fn(), getApps: vi.fn(), db: null as any,
}));
vi.mock('stripe', () => ({ default: class {
  webhooks = { constructEvent: boundary.constructEvent };
  subscriptions = { retrieve: boundary.retrieve };
} }));
vi.mock('firebase-admin/app', () => ({ getApps: boundary.getApps, getApp: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => boundary.db,
  FieldValue: { serverTimestamp: () => 'synthetic-timestamp' },
}));
vi.mock('../../server/middleware/requireFirebaseAuth', () => ({
  ensureAdmin: vi.fn(), isProductionLike: () => true, requireFirebaseAuth: vi.fn(),
}));
import router from '../../server/routes/stripe';

// Exercise the actual registered route, replacing only external integration
// boundaries. No HTTP listener, provider request, Firebase or payment is used.
const webhook = (router as any).stack.find((layer: any) => layer.route?.path === '/webhook')
  .route.stack[0].handle;
const userPath = 'users/synthetic-user';
const orgPath = 'organizations/synthetic-org';
const eventPath = 'stripeWebhookEvents/evt_synthetic';
let records: Map<string, Record<string, unknown>>;
let committed: string[];
let persistenceFails: boolean;

afterEach(() => vi.unstubAllEnvs());

function subscription(status: string, priceId = 'price_synthetic_growth') {
  return { id: 'sub_synthetic', customer: 'cus_synthetic', status,
    items: { data: [{ price: { id: priceId } }] } };
}
async function deliver(signature = 'synthetic-signature') {
  const res = { statusCode: 200, status(code: number) { this.statusCode = code; return this; },
    send: vi.fn().mockReturnThis() };
  await webhook({ headers: { 'stripe-signature': signature }, body: Buffer.from('synthetic') }, res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_synthetic');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_synthetic');
  vi.stubEnv('STRIPE_PRICE_GROWTH_MONTHLY', 'price_synthetic_growth');
  records = new Map([
    [userPath, { organizationId: 'synthetic-org', role: 'admin' }],
    [orgPath, { planId: 'starter', subscriptionStatus: 'none' }],
  ]);
  committed = [];
  persistenceFails = false;
  boundary.getApps.mockReturnValue([{}]);
  boundary.constructEvent.mockImplementation((_body, signature) => {
    if (signature !== 'synthetic-signature') throw new Error('synthetic invalid signature');
    return { id: 'evt_synthetic', created: 100, type: 'checkout.session.completed', data: { object: {
      client_reference_id: 'synthetic-user', customer: 'cus_synthetic', subscription: 'sub_synthetic',
      metadata: { organizationId: 'synthetic-org' },
    } } };
  });
  boundary.retrieve.mockResolvedValue(subscription('active'));
  boundary.db = {
    collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
    runTransaction: async (fn: any) => {
      const pending: { path: string; data: Record<string, unknown> }[] = [];
      const result = await fn({
        get: async (ref: { path: string }) => ({
          exists: records.has(ref.path), data: () => records.get(ref.path),
        }),
        set: (ref: { path: string }, data: Record<string, unknown>) => pending.push({ path: ref.path, data }),
      });
      if (persistenceFails) throw new Error('synthetic persistence failure');
      for (const write of pending) {
        records.set(write.path, { ...records.get(write.path), ...write.data });
        committed.push(write.path);
      }
      return result;
    },
  };
});

describe('#144 completed checkout reconciles current subscription state', () => {
  it('refuses a checkout completed by a non-administrator without any writes', async () => {
    records.set(userPath, { organizationId: 'synthetic-org', role: 'member' });
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
  });
  it.each([userPath, orgPath])('refuses a different customer mapping on %s atomically', async path => {
    records.set(path, { ...records.get(path), stripeCustomerId: 'cus_existing' });
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
    expect(records.get(path)?.stripeCustomerId).toBe('cus_existing');
  });
  it.each([userPath, orgPath])('refuses a different subscription mapping on %s atomically', async path => {
    records.set(path, { ...records.get(path), stripeSubscriptionId: 'sub_existing' });
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
    expect(records.get(path)?.stripeSubscriptionId).toBe('sub_existing');
  });
  it('refuses a foreign organization in checkout metadata without writes', async () => {
    records.set(userPath, { organizationId: 'other-org', role: 'admin' });
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
  });
  it('refuses a subscription belonging to a different provider customer', async () => {
    boundary.retrieve.mockResolvedValue({ ...subscription('active'), customer: 'cus_other' });
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
  });
  it('preserves reconciliation for an already-matching customer/subscription pair', async () => {
    for (const path of [userPath, orgPath]) {
      records.set(path, { ...records.get(path), stripeCustomerId: 'cus_synthetic', stripeSubscriptionId: 'sub_synthetic' });
    }
    expect((await deliver()).statusCode).toBe(200);
    expect(records.get(orgPath)?.planId).toBe('growth');
  });
  it('durably skips stale checkout without replacing a newer subscription mapping', async () => {
    records.set(userPath, { organizationId: 'synthetic-org', role: 'member' });
    records.set(orgPath, { stripeCustomerId: 'cus_newer', stripeSubscriptionId: 'sub_newer',
      stripeLastEventCreated: 200, stripeLastEventId: 'evt_newer',
      stripeLastEventType: 'customer.subscription.updated' });
    expect((await deliver()).statusCode).toBe(200);
    expect(committed).toEqual([eventPath]);
    expect(records.get(orgPath)?.stripeSubscriptionId).toBe('sub_newer');
    expect(records.get(eventPath)?.staleSkipped).toBe(true);
  });
  it('does not acknowledge a competing checkout or overwrite the first completed mapping', async () => {
    await deliver();
    const first = structuredClone(records.get(orgPath));
    committed = [];
    boundary.constructEvent.mockReturnValue({ id: 'evt_competing', created: 101,
      type: 'checkout.session.completed', data: { object: {
        client_reference_id: 'synthetic-user', customer: 'cus_competing', subscription: 'sub_competing',
        metadata: { organizationId: 'synthetic-org' },
      } } });
    boundary.retrieve.mockResolvedValue({ ...subscription('active'), id: 'sub_competing', customer: 'cus_competing' });
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
    expect(records.get(orgPath)).toEqual(first);
    expect(records.has('stripeWebhookEvents/evt_competing')).toBe(false);
  });
  it.each(['canceled', 'unpaid', 'incomplete_expired'])(
    'does not activate paid limits when the current subscription is %s', async status => {
      boundary.retrieve.mockResolvedValue(subscription(status));
      expect((await deliver()).statusCode).toBe(200);
      expect(records.get(userPath)?.subscriptionStatus).toBe('canceled');
      expect(records.get(orgPath)).toMatchObject({
        subscriptionStatus: 'canceled', planId: 'starter', vendorCap: 25, seatCap: 3,
      });
      expect(records.get(eventPath)?.status).toBe('processed');
    },
  );

  // Reuse the existing subscription.updated semantics; do not invent a new
  // trialing/past_due entitlement policy in the checkout-completion path.
  it.each(['active', 'trialing', 'past_due'])(
    'preserves current %s status and the existing catalog entitlement policy', async status => {
      boundary.retrieve.mockResolvedValue(subscription(status));
      expect((await deliver()).statusCode).toBe(200);
      expect(records.get(userPath)?.subscriptionStatus).toBe(status);
      expect(records.get(orgPath)).toMatchObject({
        subscriptionStatus: status, planId: 'growth', vendorCap: 150, seatCap: 10,
      });
    },
  );

  it('does not acknowledge a persistence failure or leave partial writes', async () => {
    persistenceFails = true;
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
    expect(records.has(eventPath)).toBe(false);
  });
  it('does not reapply a duplicate processed checkout', async () => {
    await deliver();
    const before = structuredClone([...records]);
    committed = [];
    expect((await deliver()).statusCode).toBe(200);
    expect(committed).toEqual([]);
    expect([...records]).toEqual(before);
  });
  it('does not overwrite a newer subscription event', async () => {
    records.set(orgPath, { planId: 'starter', subscriptionStatus: 'canceled',
      stripeLastEventCreated: 200, stripeLastEventId: 'evt_newer',
      stripeLastEventType: 'customer.subscription.deleted' });
    expect((await deliver()).statusCode).toBe(200);
    expect(records.get(orgPath)?.subscriptionStatus).toBe('canceled');
    expect(committed).toEqual([eventPath]);
    expect(records.get(eventPath)?.staleSkipped).toBe(true);
  });
  it.each([userPath, orgPath])('refuses missing mapping %s without writes', async path => {
    records.delete(path);
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
  });
  it.each(['active', 'canceled'])('refuses an unmapped catalog price for %s without writes', async status => {
    boundary.retrieve.mockResolvedValue(subscription(status, 'price_unknown'));
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
  });
  it('refuses provider reconciliation failure without writes', async () => {
    boundary.retrieve.mockRejectedValue(new Error('synthetic provider unavailable'));
    expect((await deliver()).statusCode).toBe(500);
    expect(committed).toEqual([]);
  });
  it('refuses missing Firebase persistence', async () => {
    boundary.getApps.mockReturnValue([]);
    expect((await deliver()).statusCode).toBe(503);
    expect(committed).toEqual([]);
  });
  it('honors a signature-verification rejection before reconciliation', async () => {
    expect((await deliver('invalid')).statusCode).toBe(400);
    expect(boundary.retrieve).not.toHaveBeenCalled();
    expect(committed).toEqual([]);
  });
});
