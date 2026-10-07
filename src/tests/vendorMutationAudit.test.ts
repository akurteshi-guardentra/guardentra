import { describe, expect, it, vi } from 'vitest';
import { MATERIAL_AUDIT_COLLECTION } from '../../server/lib/audit/materialIntent';
import {
  VendorMutationError,
  createVendorWithDurableAudit,
  deterministicVendorId,
  handleOrgVendorCreate,
  type VendorCreateInput,
  type VendorMutationDeps,
} from '../../server/lib/vendorMutation';

function fakeFirestore(initial: Record<string, Record<string, any>> = {}) {
  const rows = new Map<string, Record<string, any>>(Object.entries(initial));
  const key = (collection: string, id: string) => `${collection}/${id}`;

  const makeRef = (collection: string, id: string) => ({ collection, id, path: key(collection, id) });

  const db = {
    collection(collection: string) {
      return {
        doc(id: string) {
          return makeRef(collection, id);
        },
      };
    },
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const tx = {
        async get(ref: { collection: string; id: string }) {
          const value = rows.get(key(ref.collection, ref.id));
          return {
            exists: Boolean(value),
            data: () => (value ? { ...value } : undefined),
          };
        },
        create(ref: { collection: string; id: string }, data: Record<string, unknown>) {
          const k = key(ref.collection, ref.id);
          if (rows.has(k)) throw new Error('already exists');
          rows.set(k, { ...data });
        },
        set(
          ref: { collection: string; id: string },
          data: Record<string, unknown>,
          options?: { merge?: boolean },
        ) {
          const k = key(ref.collection, ref.id);
          const current = rows.get(k) || {};
          rows.set(k, options?.merge ? { ...current, ...data } : { ...data });
        },
      };
      return fn(tx);
    },
  };

  return { db: db as any, rows, key };
}

const vendor: VendorCreateInput = {
  name: 'Acme Cloud',
  category: 'SaaS',
  criticality: 'High',
  primaryContactName: 'Vera',
  primaryContactEmail: 'vendor@example.com',
  source: 'create',
};

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(n: number) {
      this.statusCode = n;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

describe('#160 vendor create durable audit coupling', () => {
  it('uses a stable normalized vendor identity for retry deduplication', () => {
    const a = deterministicVendorId('org1', vendor);
    const b = deterministicVendorId('org1', {
      ...vendor,
      name: '  ACME   CLOUD ',
      category: 'saas',
      primaryContactEmail: 'VENDOR@EXAMPLE.COM',
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^vendor_[a-f0-9]{40}$/);
  });

  it('commits vendor, vendorCount and one pending audit journal entry atomically', async () => {
    const { db, rows, key } = fakeFirestore({
      'organizations/org1': {
        vendorCount: 0,
        vendorCap: 2,
        planId: 'starter',
      },
    });

    const result = await createVendorWithDurableAudit({
      db,
      organizationId: 'org1',
      actorId: 'user1',
      ownerName: 'Owner One',
      vendor,
      nowIso: '2026-10-07T15:00:00.000Z',
    });

    expect(result.deduplicated).toBe(false);
    expect(rows.get(key('vendors', result.vendorId))).toMatchObject({
      organizationId: 'org1',
      name: 'Acme Cloud',
      assessmentStatus: 'Not Started',
    });
    expect(rows.get('organizations/org1')?.vendorCount).toBe(1);

    const auditDocs = [...rows.entries()].filter(([k]) =>
      k.startsWith(`${MATERIAL_AUDIT_COLLECTION}/`),
    );
    expect(auditDocs).toHaveLength(1);
    expect(auditDocs[0][1]).toMatchObject({
      state: 'pending',
      envelope: {
        tenantId: 'org1',
        eventType: 'vendor.created',
        actorId: 'user1',
        objectType: 'vendor',
        objectId: result.vendorId,
      },
    });
  });

  it('response-loss retry returns the same vendor without incrementing the cap counter twice', async () => {
    const { db, rows } = fakeFirestore({
      'organizations/org1': {
        vendorCount: 0,
        vendorCap: 2,
        planId: 'starter',
      },
    });
    const args = {
      db,
      organizationId: 'org1',
      actorId: 'user1',
      ownerName: 'Owner One',
      vendor,
      nowIso: '2026-10-07T15:00:00.000Z',
    };

    const first = await createVendorWithDurableAudit(args);
    const retry = await createVendorWithDurableAudit(args);

    expect(retry).toEqual({ vendorId: first.vendorId, deduplicated: true });
    expect(rows.get('organizations/org1')?.vendorCount).toBe(1);
    expect(
      [...rows.keys()].filter((k) => k.startsWith(`${MATERIAL_AUDIT_COLLECTION}/`)),
    ).toHaveLength(1);
  });

  it('fails the whole transaction at the vendor cap before vendor or audit creation', async () => {
    const { db, rows } = fakeFirestore({
      'organizations/org1': {
        vendorCount: 1,
        vendorCap: 1,
        planId: 'starter',
      },
    });

    await expect(
      createVendorWithDurableAudit({
        db,
        organizationId: 'org1',
        actorId: 'user1',
        ownerName: 'Owner One',
        vendor,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'vendor_cap_reached',
    } satisfies Partial<VendorMutationError>);

    expect([...rows.keys()].filter((k) => k.startsWith('vendors/'))).toHaveLength(0);
    expect(
      [...rows.keys()].filter((k) => k.startsWith(`${MATERIAL_AUDIT_COLLECTION}/`)),
    ).toHaveLength(0);
  });

  it('derives tenant and owner from authenticated user state, not request input', async () => {
    const createVendor = vi.fn(async () => ({ vendorId: 'vendor_1', deduplicated: false }));
    const deps: VendorMutationDeps = {
      verifyIdToken: vi.fn(async () => ({ uid: 'user1', email: 'token@example.com' }) as any),
      getUser: vi.fn(async () => ({
        organizationId: 'org-authoritative',
        role: 'admin',
        displayName: 'Authoritative Owner',
      })),
      createVendor,
    };
    const req: any = {
      headers: { authorization: 'Bearer token' },
      body: {
        ...vendor,
        organizationId: 'org-attacker',
        ownerName: 'Attacker',
      },
    };
    const res = mockRes();

    await handleOrgVendorCreate(req, res, deps);

    expect(res.statusCode).toBe(200);
    expect(createVendor).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-authoritative',
        actorId: 'user1',
        ownerName: 'Authoritative Owner',
      }),
    );
    expect(createVendor.mock.calls[0][0]).not.toHaveProperty('organizationId', 'org-attacker');
  });
});
