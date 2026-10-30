// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { buildMailQueueDocument } from '../../server/lib/mailQueue';
import { createFirestoreMailStore } from '../../server/lib/mailWorker/firestoreStore';
import { createMailWorker, LEASE_MS, WORKER_OWNER } from '../../server/lib/mailWorker/worker';

const host = process.env.FIRESTORE_EMULATOR_HOST;
// Hard guard against any live Firebase/GCP access from this suite.
if (host && !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Local emulator required');
describe.skipIf(!host)('mail worker real Firestore transactions (local emulator only)', () => {
  let app: App;
  let db: Firestore;
  beforeAll(() => {
    app = initializeApp({ projectId: 'demo-guardentra-firestore-rules' }, 'mail-worker-tests');
    db = getFirestore(app);
  });
  afterAll(async () => { await db.terminate(); await deleteApp(app); });
  it('serializes independent concurrent workers and excludes terminal records from due query', async () => {
    const ref = db.collection('mail').doc();
    await ref.set(buildMailQueueDocument({ to: 'tenant-a@example.test', subject: 'Invite A', text: 'A link only' }));
    const send = vi.fn(async () => ({ outcome: 'accepted' as const }));
    const create = () => createMailWorker({ store: createFirestoreMailStore(db), provider: { send }, options: { enabled: true, cutoverMs: 0 } });
    await Promise.all([create().process(ref.id), create().process(ref.id), create().process(ref.id)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await ref.get()).data()?.delivery.state).toBe('SUCCESS');
    expect(await createFirestoreMailStore(db).due(Date.now(), 20)).not.toContain(ref.id);
    await ref.delete();
  });
  it('recovers retry state after worker recreation using the indexed due query', async () => {
    const ref = db.collection('mail').doc();
    await ref.set(buildMailQueueDocument({ to: 'tenant-b@example.test', subject: 'Invite B', text: 'B link only' }));
    let time = Date.now();
    const store = createFirestoreMailStore(db);
    const create = (outcome: 'temporary' | 'accepted') => createMailWorker({ store, provider: { send: async () => ({ outcome }) }, options: { enabled: true, cutoverMs: 0 }, now: () => time });
    await create('temporary').process(ref.id);
    expect((await ref.get()).data()?.delivery.state).toBe('RETRY');
    expect(await store.due(time, 20)).not.toContain(ref.id);
    time += LEASE_MS;
    expect(await store.due(time, 20)).toContain(ref.id);
    await create('accepted').sweep();
    expect((await ref.get()).data()?.delivery).toMatchObject({ state: 'SUCCESS', attempts: 2 });
    await ref.delete();
  });
  it('foreign overdue records cannot starve an owned retry beyond the recovery limit', async () => {
    const refs = Array.from({ length: 20 }, () => db.collection('mail').doc());
    const owned = db.collection('mail').doc();
    const at = Date.now();
    const batch = db.batch();
    for (const ref of refs) {
      batch.set(ref, {
        ...buildMailQueueDocument({ to: 'legacy@example.test', subject: 'Legacy', text: 'Legacy' }),
        delivery: { owner: 'another.consumer', state: 'RETRY', dueAt: 1 },
      });
    }
    batch.set(owned, {
      ...buildMailQueueDocument({ to: 'owned@example.test', subject: 'Owned', text: 'Owned' }),
      delivery: {
        owner: WORKER_OWNER, state: 'RETRY', attempts: 1, attemptId: 'previous',
        startedAt: at - LEASE_MS, updatedAt: at - LEASE_MS, dueAt: at - 1, code: 'RATE_LIMITED',
      },
    });
    await batch.commit();
    try {
      const store = createFirestoreMailStore(db);
      expect(await store.due(at, 20)).toEqual([owned.id]);
      const send = vi.fn(async () => ({ outcome: 'accepted' as const }));
      await createMailWorker({
        store, provider: { send }, options: { enabled: true, cutoverMs: 0 }, now: () => at,
      }).sweep();
      expect(send).toHaveBeenCalledTimes(1);
      expect((await owned.get()).data()?.delivery).toMatchObject({ state: 'SUCCESS', attempts: 2 });
      for (const ref of refs) {
        expect((await ref.get()).data()?.delivery.owner).toBe('another.consumer');
      }
    } finally {
      const cleanup = db.batch();
      for (const ref of [...refs, owned]) cleanup.delete(ref);
      await cleanup.commit();
    }
  }, 30_000);

});
