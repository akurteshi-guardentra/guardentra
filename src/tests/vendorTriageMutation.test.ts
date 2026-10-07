import { describe, expect, it, vi } from 'vitest';
import {
  handleOrgVendorTriage,
  parseTriageAnswers,
  saveVendorTriageWithDurableAudit,
} from '../../server/lib/vendorTriageMutation';

function fakeDb(seed: Record<string, Record<string, unknown>>) {
  const rows = new Map(Object.entries(seed));

  function ref(collection: string, id: string) {
    const key = `${collection}/${id}`;
    return {
      id,
      key,
      async get() {
        const data = rows.get(key);
        return {
          exists: Boolean(data),
          data: () => (data ? { ...data } : undefined),
          id,
        };
      },
    };
  }

  const db: any = {
    collection(name: string) {
      return {
        doc(id: string) {
          return ref(name, id);
        },
      };
    },
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const writes: Array<() => void> = [];
      const tx = {
        async get(target: any) {
          const data = rows.get(target.key);
          return {
            exists: Boolean(data),
            data: () => (data ? { ...data } : undefined),
            id: target.id,
          };
        },
        create(target: any, data: Record<string, unknown>) {
          writes.push(() => {
            if (rows.has(target.key)) throw new Error('already exists');
            rows.set(target.key, { ...data });
          });
        },
        set(target: any, patch: Record<string, unknown>, opts?: { merge?: boolean }) {
          writes.push(() => {
            const current = rows.get(target.key) || {};
            rows.set(target.key, opts?.merge ? { ...current, ...patch } : { ...patch });
          });
        },
      };
      const result = await fn(tx);
      writes.forEach((write) => write());
      return result;
    },
  };

  return { db, rows };
}

const answers = {
  dataExposure: ['personal'],
  accessLevel: 'user',
  businessCriticality: 'high',
  requirements: ['soc2_customers'],
  reviewCadence: 'semi_annual',
} as const;

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

describe('#168 server-authoritative FastTrack triage', () => {
  it('normalizes and validates the five authoritative signals', () => {
    const parsed = parseTriageAnswers({
      ...answers,
      dataExposure: ['personal', 'personal'],
      requirements: ['soc2_customers'],
    });
    expect(parsed.dataExposure).toEqual(['personal']);
    expect(parsed.reviewCadence).toBe('semi_annual');
    expect(() =>
      parseTriageAnswers({ ...answers, accessLevel: 'root-everywhere' }),
    ).toThrow('accessLevel is invalid');
  });

  it('commits triage, vendor review date and durable audit intent atomically', async () => {
    const { db, rows } = fakeDb({
      'users/user-1': { organizationId: 'org-1', role: 'admin' },
      'vendors/vendor-1': { organizationId: 'org-1', name: 'Vendor One' },
    });

    const result = await saveVendorTriageWithDurableAudit({
      db,
      organizationId: 'org-1',
      actorId: 'user-1',
      vendorId: 'vendor-1',
      answers: parseTriageAnswers(answers),
      now: new Date('2026-10-08T00:00:00.000Z'),
    });

    expect(result.deduplicated).toBe(false);
    expect(result.recommendation.tier).toBe('Standard');
    expect(rows.get('vendor_triage/vendor-1')).toMatchObject({
      organizationId: 'org-1',
      vendorId: 'vendor-1',
      tier: 'Standard',
      completedBy: 'user-1',
    });
    expect(rows.get('vendors/vendor-1')?.nextReviewAt).toBeTruthy();

    const audits = [...rows.entries()].filter(([key]) =>
      key.startsWith('audit_material_intents/'),
    );
    expect(audits).toHaveLength(1);
    expect((audits[0][1] as any).envelope).toMatchObject({
      tenantId: 'org-1',
      eventType: 'triage.completed',
      objectType: 'vendor',
      objectId: 'vendor-1',
    });
  });

  it('retries the same normalized triage without a second audit or timestamp mutation', async () => {
    const { db, rows } = fakeDb({
      'users/user-1': { organizationId: 'org-1', role: 'admin' },
      'vendors/vendor-1': { organizationId: 'org-1', name: 'Vendor One' },
    });
    const normalized = parseTriageAnswers(answers);

    const first = await saveVendorTriageWithDurableAudit({
      db,
      organizationId: 'org-1',
      actorId: 'user-1',
      vendorId: 'vendor-1',
      answers: normalized,
      now: new Date('2026-10-08T00:00:00.000Z'),
    });
    const second = await saveVendorTriageWithDurableAudit({
      db,
      organizationId: 'org-1',
      actorId: 'user-1',
      vendorId: 'vendor-1',
      answers: normalized,
      now: new Date('2026-10-09T00:00:00.000Z'),
    });

    expect(second.deduplicated).toBe(true);
    expect(second.completedAt).toBe(first.completedAt);
    expect(
      [...rows.keys()].filter((key) => key.startsWith('audit_material_intents/')),
    ).toHaveLength(1);
    expect(rows.get('vendor_triage/vendor-1')?.completedAt).toBe(
      '2026-10-08T00:00:00.000Z',
    );
  });

  it('fails closed on a cross-tenant vendor before writing triage or audit state', async () => {
    const { db, rows } = fakeDb({
      'users/user-1': { organizationId: 'org-1', role: 'admin' },
      'vendors/vendor-1': { organizationId: 'org-2', name: 'Other Tenant' },
    });

    await expect(
      saveVendorTriageWithDurableAudit({
        db,
        organizationId: 'org-1',
        actorId: 'user-1',
        vendorId: 'vendor-1',
        answers: parseTriageAnswers(answers),
      }),
    ).rejects.toMatchObject({ status: 403, code: 'cross_tenant_vendor' });

    expect(rows.has('vendor_triage/vendor-1')).toBe(false);
    expect(
      [...rows.keys()].some((key) => key.startsWith('audit_material_intents/')),
    ).toBe(false);
  });

  it('derives tenant and recommendation server-side through the HTTP handler', async () => {
    const { db } = fakeDb({
      'users/user-1': {
        organizationId: 'org-1',
        role: 'member',
        email: 'member@example.com',
      },
      'vendors/vendor-1': { organizationId: 'org-1', name: 'Vendor One' },
    });
    const res = mockRes();

    await handleOrgVendorTriage(
      {
        headers: { authorization: 'Bearer good' },
        body: {
          vendorId: 'vendor-1',
          answers,
          tier: 'Enhanced',
          frameworks: ['hipaa'],
        },
      } as any,
      res,
      {
        db,
        verifyIdToken: vi.fn(async () => ({ uid: 'user-1' } as any)),
        now: () => new Date('2026-10-08T00:00:00.000Z'),
      },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.recommendation.tier).toBe('Standard');
    expect(res.body.recommendation.frameworks).not.toEqual(['hipaa']);
  });
});
