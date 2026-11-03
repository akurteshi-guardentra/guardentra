import { describe, expect, it, vi } from 'vitest';
import { MATERIAL_AUDIT_COLLECTION } from '../../server/lib/audit/materialIntent';
import {
  VendorMutationError,
  archiveVendorWithDurableAudit,
  assessmentBlocksVendorArchive,
  handleOrgVendorArchive,
  type VendorMutationDeps,
} from '../../server/lib/vendorMutation';

type Row = Record<string, any>;

function fakeFirestore(initial: Record<string, Row> = {}) {
  const rows = new Map<string, Row>(Object.entries(initial));
  const key = (collection: string, id: string) => `${collection}/${id}`;

  const makeRef = (collection: string, id: string) => ({
    collection,
    id,
    path: key(collection, id),
    kind: 'doc' as const,
  });

  const makeQuery = (collection: string, filters: Array<{ field: string; value: unknown }>) => ({
    collection,
    filters,
    kind: 'query' as const,
  });

  const db = {
    collection(collection: string) {
      return {
        doc(id: string) {
          return makeRef(collection, id);
        },
        where(field: string, _op: string, value: unknown) {
          const filters = [{ field, value }];
          const queryApi: any = {
            where(nextField: string, __op: string, nextValue: unknown) {
              filters.push({ field: nextField, value: nextValue });
              return queryApi;
            },
            _build() {
              return makeQuery(collection, [...filters]);
            },
          };
          // Firestore query objects are passed directly to tx.get; mimic that.
          Object.assign(queryApi, makeQuery(collection, filters));
          return queryApi;
        },
      };
    },
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const tx = {
        async get(target: any) {
          if (target?.kind === 'query') {
            const docs = [...rows.entries()]
              .filter(([k]) => k.startsWith(`${target.collection}/`))
              .map(([k, value]) => {
                const id = k.slice(target.collection.length + 1);
                return { id, data: () => ({ ...value }), exists: true };
              })
              .filter((doc) =>
                (target.filters as Array<{ field: string; value: unknown }>).every(
                  (f) => doc.data()[f.field] === f.value,
                ),
              );
            return { docs };
          }
          const value = rows.get(key(target.collection, target.id));
          return {
            exists: Boolean(value),
            data: () => (value ? { ...value } : undefined),
          };
        },
        set(ref: { collection: string; id: string }, data: Row, options?: { merge?: boolean }) {
          const k = key(ref.collection, ref.id);
          const current = rows.get(k) || {};
          rows.set(k, options?.merge ? { ...current, ...data } : { ...data });
        },
        create(ref: { collection: string; id: string }, data: Row) {
          const k = key(ref.collection, ref.id);
          if (rows.has(k)) throw new Error('already exists');
          rows.set(k, { ...data });
        },
      };
      return fn(tx);
    },
  };

  return { db: db as any, rows, key };
}

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

describe('#226 vendor archive durable audit coupling', () => {
  it('marks terminal vs open assessments correctly for the archive guard', () => {
    expect(assessmentBlocksVendorArchive({ status: 'Archived' })).toBe(false);
    expect(assessmentBlocksVendorArchive({ decisionOutcome: 'approved' })).toBe(false);
    expect(assessmentBlocksVendorArchive({ decisionOutcome: 'conditional' })).toBe(false);
    expect(assessmentBlocksVendorArchive({ decisionOutcome: 'rejected' })).toBe(false);
    expect(assessmentBlocksVendorArchive({ status: 'Under Review' })).toBe(true);
    expect(assessmentBlocksVendorArchive({ decisionOutcome: 'remediate' })).toBe(true);
  });

  it('archives vendor, decrements vendorCount, and writes one pending audit intent', async () => {
    const { db, rows } = fakeFirestore({
      'organizations/org1': { vendorCount: 2, planId: 'starter' },
      'vendors/v1': {
        name: 'Acme',
        organizationId: 'org1',
        status: 'Active',
      },
      'assessments/a1': {
        organizationId: 'org1',
        vendorId: 'v1',
        status: 'Completed',
        decisionOutcome: 'approved',
      },
    });

    const result = await archiveVendorWithDurableAudit({
      db,
      organizationId: 'org1',
      actorId: 'admin1',
      vendorId: 'v1',
      reason: 'smoke cleanup',
      nowIso: '2026-11-03T08:00:00.000Z',
    });

    expect(result).toEqual({ vendorId: 'v1', alreadyArchived: false });
    expect(rows.get('vendors/v1')).toMatchObject({
      status: 'Archived',
      archivedBy: 'admin1',
      archiveReason: 'smoke cleanup',
      archivedAt: '2026-11-03T08:00:00.000Z',
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
        eventType: 'vendor.archived',
        actorId: 'admin1',
        objectType: 'vendor',
        objectId: 'v1',
      },
    });
  });

  it('is idempotent when the vendor is already archived', async () => {
    const { db, rows } = fakeFirestore({
      'organizations/org1': { vendorCount: 1, planId: 'starter' },
      'vendors/v1': {
        name: 'Acme',
        organizationId: 'org1',
        status: 'Archived',
        archivedAt: '2026-11-01T00:00:00.000Z',
      },
    });

    const result = await archiveVendorWithDurableAudit({
      db,
      organizationId: 'org1',
      actorId: 'admin1',
      vendorId: 'v1',
    });

    expect(result.alreadyArchived).toBe(true);
    expect(rows.get('organizations/org1')?.vendorCount).toBe(1);
    expect(
      [...rows.keys()].filter((k) => k.startsWith(`${MATERIAL_AUDIT_COLLECTION}/`)),
    ).toHaveLength(0);
  });

  it('blocks archive when an open assessment remains', async () => {
    const { db, rows } = fakeFirestore({
      'organizations/org1': { vendorCount: 1, planId: 'starter' },
      'vendors/v1': { name: 'Acme', organizationId: 'org1', status: 'Active' },
      'assessments/a1': {
        organizationId: 'org1',
        vendorId: 'v1',
        status: 'Under Review',
      },
    });

    await expect(
      archiveVendorWithDurableAudit({
        db,
        organizationId: 'org1',
        actorId: 'admin1',
        vendorId: 'v1',
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'vendor_has_open_assessments',
    } satisfies Partial<VendorMutationError>);

    expect(rows.get('vendors/v1')?.status).toBe('Active');
    expect(rows.get('organizations/org1')?.vendorCount).toBe(1);
  });

  it.each([
    {
      label: 'missing vendorCount',
      org: { planId: 'starter' },
      expectCount: undefined,
    },
    {
      label: 'zero vendorCount',
      org: { vendorCount: 0, planId: 'starter' },
      expectCount: 0,
    },
    {
      label: 'negative (inconsistent) vendorCount',
      org: { vendorCount: -1, planId: 'starter' },
      expectCount: -1,
    },
    {
      label: 'non-integer (inconsistent) vendorCount',
      org: { vendorCount: 1.5, planId: 'starter' },
      expectCount: 1.5,
    },
  ])('fails closed without writes when $label', async ({ org, expectCount }) => {
    const { db, rows } = fakeFirestore({
      'organizations/org1': org,
      'vendors/v1': { name: 'Drifted', organizationId: 'org1', status: 'Active' },
    });

    await expect(
      archiveVendorWithDurableAudit({
        db,
        organizationId: 'org1',
        actorId: 'admin1',
        vendorId: 'v1',
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'vendor_count_inconsistent',
    } satisfies Partial<VendorMutationError>);

    expect(rows.get('vendors/v1')?.status).toBe('Active');
    expect(rows.get('organizations/org1')?.vendorCount).toBe(expectCount);
    expect(
      [...rows.keys()].filter((k) => k.startsWith(`${MATERIAL_AUDIT_COLLECTION}/`)),
    ).toHaveLength(0);
  });

  it('records previous and next vendorCount on a successful archive audit intent', async () => {
    const { db, rows } = fakeFirestore({
      'organizations/org1': { vendorCount: 3, planId: 'starter' },
      'vendors/v1': { name: 'Acme', organizationId: 'org1', status: 'Active' },
    });

    await archiveVendorWithDurableAudit({
      db,
      organizationId: 'org1',
      actorId: 'admin1',
      vendorId: 'v1',
      nowIso: '2026-11-03T09:00:00.000Z',
    });

    const auditDocs = [...rows.entries()].filter(([k]) =>
      k.startsWith(`${MATERIAL_AUDIT_COLLECTION}/`),
    );
    expect(auditDocs).toHaveLength(1);
    expect(auditDocs[0][1].envelope.payload).toMatchObject({
      previousVendorCount: 3,
      nextVendorCount: 2,
    });
    expect(rows.get('organizations/org1')?.vendorCount).toBe(2);
    expect(rows.get('vendors/v1')?.status).toBe('Archived');
  });

  it('rejects cross-tenant archive attempts', async () => {
    const { db } = fakeFirestore({
      'organizations/org1': { vendorCount: 1 },
      'vendors/v1': { name: 'Acme', organizationId: 'other-org', status: 'Active' },
    });

    await expect(
      archiveVendorWithDurableAudit({
        db,
        organizationId: 'org1',
        actorId: 'admin1',
        vendorId: 'v1',
      }),
    ).rejects.toMatchObject({ status: 403, code: 'vendor_forbidden' });
  });

  it('requires admin/owner and derives tenant from the authenticated user', async () => {
    const archiveVendor = vi.fn(async () => ({ vendorId: 'v1', alreadyArchived: false }));
    const deps: VendorMutationDeps = {
      verifyIdToken: async () => ({ uid: 'u1' }) as any,
      getUser: async () => ({ organizationId: 'org1', role: 'member' }),
      createVendor: async () => ({ vendorId: 'x', deduplicated: false }),
      archiveVendor,
    };

    const memberRes = mockRes();
    await handleOrgVendorArchive(
      { headers: { authorization: 'Bearer t' }, body: { vendorId: 'v1' } } as any,
      memberRes,
      deps,
    );
    expect(memberRes.statusCode).toBe(403);
    expect(archiveVendor).not.toHaveBeenCalled();

    deps.getUser = async () => ({ organizationId: 'org1', role: 'admin' });
    const adminRes = mockRes();
    await handleOrgVendorArchive(
      { headers: { authorization: 'Bearer t' }, body: { vendorId: 'v1', reason: 'cleanup' } } as any,
      adminRes,
      deps,
    );
    expect(adminRes.statusCode).toBe(200);
    expect(archiveVendor).toHaveBeenCalledWith({
      organizationId: 'org1',
      actorId: 'u1',
      vendorId: 'v1',
      reason: 'cleanup',
    });
  });

  it('returns 401 before body validation when unauthenticated', async () => {
    const deps: VendorMutationDeps = {
      verifyIdToken: async () => {
        throw new Error('no');
      },
      getUser: async () => null,
      createVendor: async () => ({ vendorId: 'x', deduplicated: false }),
      archiveVendor: async () => ({ vendorId: 'v1', alreadyArchived: false }),
    };
    const res = mockRes();
    await handleOrgVendorArchive({ headers: {}, body: {} } as any, res, deps);
    expect(res.statusCode).toBe(401);
  });
});
