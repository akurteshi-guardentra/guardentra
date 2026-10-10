import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MATERIAL_AUDIT_COLLECTION,
  buildMaterialAuditIntentDocument,
  commitPreparedMaterialAuditIntent,
  materialAuditEventId,
  prepareMaterialAuditIntent,
  processMaterialAuditIntentBatch,
  type MaterialAuditIntentDocument,
} from '../../server/lib/audit/materialIntent';

type Stored = Map<string, Record<string, any>>;

function fakeFirestore(initial: Record<string, Record<string, any>> = {}) {
  const rows: Stored = new Map(Object.entries(initial));

  const makeRef = (id: string) => ({
    id,
    path: `${MATERIAL_AUDIT_COLLECTION}/${id}`,
    async update(patch: Record<string, unknown>) {
      const current = rows.get(id);
      if (!current) throw new Error(`missing ${id}`);
      rows.set(id, { ...current, ...patch });
    },
  });

  const db = {
    collection(name: string) {
      expect(name).toBe(MATERIAL_AUDIT_COLLECTION);
      return {
        doc(id: string) {
          return makeRef(id);
        },
        where(field: string, op: string, values: string[]) {
          expect(field).toBe('state');
          expect(op).toBe('in');
          return {
            limit(limit: number) {
              return {
                async get() {
                  const docs = [...rows.entries()]
                    .filter(([, data]) => values.includes(String(data.state)))
                    .slice(0, limit)
                    .map(([id]) => ({ ref: makeRef(id) }));
                  return { docs };
                },
              };
            },
          };
        },
      };
    },
    async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const tx = {
        async get(ref: { id: string }) {
          const data = rows.get(ref.id);
          return {
            exists: Boolean(data),
            data: () => (data ? { ...data } : undefined),
          };
        },
        update(ref: { id: string }, patch: Record<string, unknown>) {
          const current = rows.get(ref.id);
          if (!current) throw new Error(`missing ${ref.id}`);
          rows.set(ref.id, { ...current, ...patch });
        },
        create(ref: { id: string }, data: Record<string, unknown>) {
          if (rows.has(ref.id)) throw new Error('already exists');
          rows.set(ref.id, { ...data });
        },
      };
      return fn(tx);
    },
  };

  return { db: db as any, rows, makeRef };
}

describe('#156 durable material audit intent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds stable deterministic event ids for the same semantic transition', () => {
    const a = materialAuditEventId([
      'org-1',
      'decision.finalized',
      'asm-1',
      'submission-1',
      'approved',
    ]);
    const b = materialAuditEventId([
      'org-1',
      'decision.finalized',
      'asm-1',
      'submission-1',
      'approved',
    ]);
    const changed = materialAuditEventId([
      'org-1',
      'decision.finalized',
      'asm-1',
      'submission-2',
      'approved',
    ]);

    expect(a).toBe(b);
    expect(a).toMatch(/^mat_[a-f0-9]{64}$/);
    expect(changed).not.toBe(a);
  });

  it('prepares a journal read before the caller commits product and audit writes', async () => {
    const { db, rows } = fakeFirestore();
    const tx = {
      get: vi.fn(async () => ({ exists: false })),
      create: vi.fn(),
    } as any;

    const eventId = materialAuditEventId(['org-1', 'decision.finalized', 'asm-1']);
    const prepared = await prepareMaterialAuditIntent(tx, db, {
      eventId,
      tenantId: 'org-1',
      eventType: 'decision.finalized',
      actorId: 'user-1',
      objectType: 'assessment',
      objectId: 'asm-1',
      payload: { outcome: 'approved' },
    });

    expect(tx.get).toHaveBeenCalledTimes(1);
    expect(prepared.exists).toBe(false);
    expect(prepared.document.state).toBe('pending');
    commitPreparedMaterialAuditIntent(tx, prepared);
    expect(tx.create).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(0);
  });

  it('leaves a durable pending document while the audit spine is disabled', async () => {
    vi.stubEnv('AUDIT_SPINE_ENABLED', 'false');
    const eventId = materialAuditEventId(['org-1', 'decision.finalized', 'asm-1']);
    const doc = buildMaterialAuditIntentDocument({
      eventId,
      tenantId: 'org-1',
      eventType: 'decision.finalized',
      objectType: 'assessment',
      objectId: 'asm-1',
    });
    const { db, rows } = fakeFirestore({ [eventId]: doc });

    const emit = vi.fn();
    await expect(
      processMaterialAuditIntentBatch(10, { db, emit: emit as any }),
    ).resolves.toBe(0);

    expect(emit).not.toHaveBeenCalled();
    expect(rows.get(eventId)?.state).toBe('pending');
  });

  it('recovers a lost acknowledgement without duplicating the audit event', async () => {
    vi.stubEnv('AUDIT_SPINE_ENABLED', 'true');
    vi.stubEnv('AUDIT_MATERIAL_MAX_ATTEMPTS', '8');

    const eventId = materialAuditEventId(['org-1', 'decision.finalized', 'asm-1']);
    const doc = buildMaterialAuditIntentDocument({
      eventId,
      tenantId: 'org-1',
      eventType: 'decision.finalized',
      actorId: 'user-1',
      objectType: 'assessment',
      objectId: 'asm-1',
      payload: { outcome: 'approved' },
    });
    const { db, rows } = fakeFirestore({ [eventId]: doc });

    const emit = vi
      .fn()
      .mockRejectedValueOnce(new Error('response lost after durable outbox insert'))
      .mockResolvedValueOnce({ queued: false, eventId, duplicate: true });

    const t0 = new Date('2026-10-07T12:00:00.000Z');
    await expect(
      processMaterialAuditIntentBatch(10, {
        db,
        emit: emit as any,
        now: () => t0,
      }),
    ).resolves.toBe(0);

    expect(rows.get(eventId)?.state).toBe('pending');
    expect(rows.get(eventId)?.attempts).toBe(1);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0].eventId).toBe(eventId);

    const t1 = new Date(t0.getTime() + 5_000);
    await expect(
      processMaterialAuditIntentBatch(10, {
        db,
        emit: emit as any,
        now: () => t1,
      }),
    ).resolves.toBe(1);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[1][0].eventId).toBe(eventId);
    expect(rows.get(eventId)?.state).toBe('relayed');
    expect(rows.get(eventId)?.lastError).toBeNull();
  });

  it('runs durable Firestore relay before draining the Postgres outbox', () => {
    const worker = readFileSync(
      resolve(process.cwd(), 'server/lib/audit/worker.ts'),
      'utf8',
    );
    const materialIndex = worker.indexOf('await processMaterialAuditIntentBatch()');
    const outboxIndex = worker.indexOf('await processAuditOutboxBatch()');

    expect(materialIndex).toBeGreaterThan(-1);
    expect(outboxIndex).toBeGreaterThan(materialIndex);
  });

  it('reclaims a stale processing lease using the same event id', async () => {
    vi.stubEnv('AUDIT_SPINE_ENABLED', 'true');

    const eventId = materialAuditEventId(['org-1', 'decision.finalized', 'asm-2']);
    const base = buildMaterialAuditIntentDocument({
      eventId,
      tenantId: 'org-1',
      eventType: 'decision.finalized',
      objectType: 'assessment',
      objectId: 'asm-2',
    });
    const stale: MaterialAuditIntentDocument = {
      ...base,
      state: 'processing',
      leaseUntilMs: new Date('2026-10-07T11:59:00.000Z').getTime(),
    };
    const { db, rows } = fakeFirestore({ [eventId]: stale });
    const emit = vi.fn(async () => ({ queued: true, eventId }));

    await expect(
      processMaterialAuditIntentBatch(10, {
        db,
        emit: emit as any,
        now: () => new Date('2026-10-07T12:00:00.000Z'),
      }),
    ).resolves.toBe(1);

    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ eventId }));
    expect(rows.get(eventId)?.state).toBe('relayed');
  });
});
