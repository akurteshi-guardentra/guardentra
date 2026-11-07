// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { buildMailQueueDocument } from '../../server/lib/mailQueue';
import { listMailInventory } from '../../server/lib/mailWorker/firestoreInventory';
import { createFirestoreMailStore } from '../../server/lib/mailWorker/firestoreStore';
import { applyReport, buildReport } from '../../server/lib/mailWorker/reconcile';
import { createMailWorker, WORKER_OWNER } from '../../server/lib/mailWorker/worker';

const host = process.env.FIRESTORE_EMULATOR_HOST;
// Hard guard against any live Firebase/GCP access from this suite.
if (host && !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new Error('Local emulator required');
describe.skipIf(!host)('mail reconcile against real Firestore (local emulator only)', () => {
  let app: App;
  let db: Firestore;
  beforeAll(() => {
    app = initializeApp({ projectId: 'demo-guardentra-firestore-rules' }, 'mail-reconcile-tests');
    db = getFirestore(app);
  });
  afterAll(async () => { await db.terminate(); await deleteApp(app); });

  it('recovers only post-cutover undelivered docs, once, and leaves everything else untouched', async () => {
    const mail = (n: string) => buildMailQueueDocument({ to: `${n}@example.test`, subject: `S ${n}`, text: `Body ${n}` });
    const pre = db.collection('mail').doc('rc-pre');
    await pre.set(mail('pre'));
    await new Promise(r => setTimeout(r, 20));
    const cutoverMs = Date.now();
    await new Promise(r => setTimeout(r, 20));
    const lost = db.collection('mail').doc('rc-lost');
    const ext = db.collection('mail').doc('rc-ext');
    const owned = db.collection('mail').doc('rc-owned');
    await lost.set(mail('lost'));
    await ext.set({ ...mail('ext'), delivery: { state: 'SUCCESS', attempts: 1 } });
    await owned.set({ ...mail('owned'), delivery: { owner: WORKER_OWNER, state: 'ERROR', code: 'OUTCOME_UNKNOWN', attempts: 1, dueAt: null } });
    // Small page size proves pagination by document id.
    const entries = await listMailInventory(db, { pageSize: 2 });
    const mine = entries.filter(e => e.id.startsWith('rc-'));
    // Projection: only delivery is read, never recipients or bodies.
    expect(JSON.stringify(mine)).not.toMatch(/example\.test|Body /);
    const report = buildReport(mine, { cutoverMs, nowMs: Date.now(), minAgeMs: 0 });
    expect(report.ids).toEqual({
      CANDIDATE: ['rc-lost'], PRE_CUTOVER_UNDELIVERED: ['rc-pre'], WORKER_OUTCOME_UNKNOWN: ['rc-owned'],
    });
    expect(report.counts.FOREIGN_DELIVERY).toBe(1);

    const send = vi.fn(async () => ({ outcome: 'accepted' as const }));
    const worker = () => createMailWorker({ store: createFirestoreMailStore(db), provider: { send }, options: { enabled: true, cutoverMs } });
    // Reconcile racing the live trigger on the same doc still sends once.
    const [applied] = await Promise.all([
      applyReport(report, { process: id => worker().process(id), maxApply: 10 }),
      worker().process('rc-lost'),
    ]);
    expect(applied.applied?.map(a => a.id)).toEqual(['rc-lost']);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await lost.get()).data()?.delivery).toMatchObject({ owner: WORKER_OWNER, state: 'SUCCESS' });

    // Second run: nothing left to recover and no further sends.
    const again = buildReport((await listMailInventory(db)).filter(e => e.id.startsWith('rc-')), { cutoverMs, nowMs: Date.now(), minAgeMs: 0 });
    expect(again.counts.CANDIDATE).toBe(0);
    await applyReport(again, { process: id => worker().process(id), maxApply: 10 });
    expect(send).toHaveBeenCalledTimes(1);
    expect((await pre.get()).data()?.delivery).toBeUndefined();
    expect((await ext.get()).data()?.delivery).toEqual({ state: 'SUCCESS', attempts: 1 });
    expect((await owned.get()).data()?.delivery).toMatchObject({ state: 'ERROR', code: 'OUTCOME_UNKNOWN' });
    await Promise.all([pre, lost, ext, owned].map(r => r.delete()));
  });
});
