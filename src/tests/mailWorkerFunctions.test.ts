// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  enabled: false,
  values: {
    MAIL_WORKER_CUTOVER_AT: '2026-09-27T00:00:00Z',
    MAIL_WORKER_DATABASE: '(default)', MAIL_PROVIDER_REGION: 'eu',
    MAIL_FROM: 'sender@example.test',
  } as Record<string, string>,
  secret: vi.fn(() => 'synthetic-test-secret'),
  process: vi.fn(), sweep: vi.fn(), db: vi.fn(() => ({})), provider: vi.fn(() => ({})),
  createTrigger: vi.fn((_options, handler) => handler), schedule: vi.fn((_options, handler) => handler),
}));
vi.mock('firebase-functions/params', () => ({
  defineBoolean: () => ({ value: () => mocks.enabled }),
  defineString: (name: string) => ({ value: () => mocks.values[name] }),
  defineSecret: () => ({ value: mocks.secret }),
}));
vi.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: mocks.createTrigger }));
vi.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: mocks.schedule }));
vi.mock('firebase-admin/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: mocks.db }));
vi.mock('../../server/lib/mailWorker/firestoreStore', () => ({ createFirestoreMailStore: () => ({}) }));
vi.mock('../../server/lib/mailWorker/provider', () => ({ createSendGridProvider: mocks.provider }));
vi.mock('../../server/lib/mailWorker/worker', () => ({ createMailWorker: () => ({ process: mocks.process, sweep: mocks.sweep }) }));
import { handleMailCreated, handleMailRecovery } from '../../server/mailWorkerFunctions';

describe('self-managed function entrypoints', () => {
  beforeEach(() => {
    mocks.enabled = false;
    mocks.values.MAIL_WORKER_CUTOVER_AT = '2026-09-27T00:00:00Z';
    mocks.process.mockReset(); mocks.sweep.mockReset(); mocks.secret.mockClear(); mocks.db.mockClear();
  });
  it('is inert when disabled, without reading secrets or opening Firestore', async () => {
    await handleMailCreated('mail-id'); await handleMailRecovery();
    expect(mocks.secret).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.sweep).not.toHaveBeenCalled();
  });
  it('calls the worker with the configured named database when enabled', async () => {
    mocks.enabled = true;
    await handleMailCreated('mail-id'); await handleMailRecovery();
    expect(mocks.db).toHaveBeenCalledWith({}, '(default)');
    expect(mocks.process).toHaveBeenCalledExactlyOnceWith('mail-id');
    expect(mocks.sweep).toHaveBeenCalledTimes(1);
  });
  it('rejects missing cutover before accessing secrets or database', async () => {
    mocks.enabled = true; mocks.values.MAIL_WORKER_CUTOVER_AT = '';
    await expect(handleMailCreated('mail-id')).rejects.toThrow('MAIL_WORKER_FAILED');
    expect(mocks.secret).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it('redacts SDK errors at the trigger and scheduled invocation boundaries', async () => {
    mocks.enabled = true;
    mocks.process.mockRejectedValue(new Error('private-recipient synthetic-secret'));
    mocks.sweep.mockRejectedValue(new Error('private-recipient synthetic-secret'));
    await expect(handleMailCreated('mail-id')).rejects.toThrow(/^MAIL_WORKER_FAILED$/);
    await expect(handleMailRecovery()).rejects.toThrow(/^MAIL_WORKER_FAILED$/);
  });
  it('registers bounded private event/schedule handlers, with event retries', () => {
    expect(mocks.createTrigger.mock.calls[0][0]).toMatchObject({ document: 'mail/{mailId}', retry: true, maxInstances: 5, concurrency: 1 });
    expect(mocks.schedule.mock.calls[0][0]).toMatchObject({ schedule: 'every 1 minutes', maxInstances: 1, concurrency: 1 });
  });
});
