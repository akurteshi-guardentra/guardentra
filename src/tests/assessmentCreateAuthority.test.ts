import { describe, expect, it, vi } from 'vitest';
import { handleAssessmentCreate } from '../../server/lib/assessmentCreate';

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

function request(body: Record<string, unknown>, token = 'good') {
  return {
    headers: { authorization: `Bearer ${token}` },
    body,
  } as any;
}

function fakeDb(seed: Record<string, Record<string, unknown>>) {
  const rows = new Map(Object.entries(seed));

  const makeRef = (collection: string, id: string) => {
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
      async update(patch: Record<string, unknown>) {
        const current = rows.get(key);
        if (!current) throw new Error(`missing ${key}`);
        rows.set(key, { ...current, ...patch });
      },
    };
  };

  const db: any = {
    collection(name: string) {
      return {
        doc(id: string) {
          return makeRef(name, id);
        },
      };
    },
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const writes: Array<() => void> = [];
      const tx = {
        async get(ref: any) {
          const data = rows.get(ref.key);
          return {
            exists: Boolean(data),
            data: () => (data ? { ...data } : undefined),
            id: ref.id,
          };
        },
        create(ref: any, data: Record<string, unknown>) {
          writes.push(() => {
            if (rows.has(ref.key)) throw new Error('already exists');
            rows.set(ref.key, { ...data });
          });
        },
        update(ref: any, patch: Record<string, unknown>) {
          writes.push(() => {
            const current = rows.get(ref.key);
            if (!current) throw new Error(`missing ${ref.key}`);
            rows.set(ref.key, { ...current, ...patch });
          });
        },
        set(ref: any, patch: Record<string, unknown>, opts?: { merge?: boolean }) {
          writes.push(() => {
            const current = rows.get(ref.key) || {};
            rows.set(ref.key, opts?.merge ? { ...current, ...patch } : { ...patch });
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

const createBody = {
  requestId: 'req-12345678',
  vendorId: 'vendor-1',
  frameworks: ['soc2'],
  frameworkPackIds: ['soc2-v1'],
  frameworkName: 'SOC 2',
  questions: [
    {
      id: 'q1',
      category: 'Access Control',
      question: 'Do you require MFA?',
      required: true,
    },
  ],
  sourceQuestionCount: 1,
  dueAt: '2026-11-01T00:00:00.000Z',
  triageTier: 'Standard',
  reviewCadence: 'annual',
  reminderScheduleId: 'before_and_due',
  reminderSchedule: { daysBeforeDue: [7], onDue: true, daysAfterDue: [] },
};

describe('#162 hosted assessment create authority', () => {
  it('commits assessment, vendor state and durable audit intent together', async () => {
    const { db, rows } = fakeDb({
      'users/user-1': { organizationId: 'org-1', role: 'admin' },
      'vendors/vendor-1': {
        organizationId: 'org-1',
        name: 'Vendor One',
        primaryContactEmail: 'vendor@example.com',
      },
      'organizations/org-1': { name: 'Customer Co' },
    });
    const res = mockRes();

    await handleAssessmentCreate(request(createBody), res, {
      db,
      verifyIdToken: vi.fn(async () => ({ uid: 'user-1' } as any)),
      now: () => new Date('2026-10-07T16:00:00.000Z'),
    });

    expect(res.statusCode).toBe(200);
    const assessmentId = String(res.body.assessmentId);
    const assessment = rows.get(`assessments/${assessmentId}`);
    expect(assessment?.status).toBe('Not Started');
    expect(assessment?.sentAt).toBeUndefined();
    expect(assessment?.organizationId).toBe('org-1');
    expect(assessment?.vendorId).toBe('vendor-1');

    expect(rows.get('vendors/vendor-1')).toMatchObject({
      assessmentStatus: 'Not Started',
    });

    const auditRows = [...rows.entries()].filter(([key]) =>
      key.startsWith('audit_material_intents/'),
    );
    expect(auditRows).toHaveLength(1);
    expect((auditRows[0][1] as any).envelope).toMatchObject({
      tenantId: 'org-1',
      eventType: 'assessment.created',
      objectType: 'assessment',
      objectId: assessmentId,
    });
  });

  it('retries the same request id without creating a second assessment or audit intent', async () => {
    const { db, rows } = fakeDb({
      'users/user-1': { organizationId: 'org-1', role: 'admin' },
      'vendors/vendor-1': { organizationId: 'org-1', name: 'Vendor One' },
      'organizations/org-1': { name: 'Customer Co' },
    });
    const deps = {
      db,
      verifyIdToken: vi.fn(async () => ({ uid: 'user-1' } as any)),
      now: () => new Date('2026-10-07T16:00:00.000Z'),
    };

    const first = mockRes();
    await handleAssessmentCreate(request(createBody), first, deps);
    const second = mockRes();
    await handleAssessmentCreate(request(createBody), second, deps);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.body.deduplicated).toBe(true);
    expect(second.body.assessmentId).toBe(first.body.assessmentId);

    expect([...rows.keys()].filter((k) => k.startsWith('assessments/'))).toHaveLength(1);
    expect(
      [...rows.keys()].filter((k) => k.startsWith('audit_material_intents/')),
    ).toHaveLength(1);
  });

  it('rejects a cross-tenant vendor before any assessment or audit write', async () => {
    const { db, rows } = fakeDb({
      'users/user-1': { organizationId: 'org-1', role: 'admin' },
      'vendors/vendor-1': { organizationId: 'org-2', name: 'Other Tenant Vendor' },
      'organizations/org-1': { name: 'Customer Co' },
    });
    const res = mockRes();

    await handleAssessmentCreate(request(createBody), res, {
      db,
      verifyIdToken: vi.fn(async () => ({ uid: 'user-1' } as any)),
    });

    expect(res.statusCode).toBe(403);
    expect([...rows.keys()].some((k) => k.startsWith('assessments/'))).toBe(false);
    expect(
      [...rows.keys()].some((k) => k.startsWith('audit_material_intents/')),
    ).toBe(false);
  });
});
