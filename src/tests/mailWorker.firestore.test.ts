// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { buildMailQueueDocument } from '../../server/lib/mailQueue';
import { createFirestoreMailStore } from '../../server/lib/mailWorker/firestoreStore';
import { createMailWorker, LEASE_MS } from '../../server/lib/mailWorker/worker';

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
});
