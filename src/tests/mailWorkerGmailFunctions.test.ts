// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  enabled: false,
  values: {
    MAIL_WORKER_CUTOVER_AT: '2026-09-27T00:00:00Z', MAIL_WORKER_DATABASE: '(default)',
    MAIL_WORKER_SERVICE_ACCOUNT: 'mail-worker@guardentra-staging.iam.gserviceaccount.com',
    MAIL_GMAIL_SENDER: 'admin@example.test', MAIL_FROM: 'notifications@example.test',
    MAIL_FROM_NAME: '', MAIL_REPLY_TO: '',
  } as Record<string, string>,
  defineSecret: vi.fn(),
  process: vi.fn(), sweep: vi.fn(), db: vi.fn(() => ({})),
  provider: vi.fn(() => ({})), tokens: vi.fn(() => ({})),
  createTrigger: vi.fn((_options, handler) => handler), schedule: vi.fn((_options, handler) => handler),
}));
vi.mock('firebase-functions/params', () => ({
  defineBoolean: () => ({ value: () => mocks.enabled }),
  defineString: (name: string) => ({ value: () => mocks.values[name] }),
  defineSecret: mocks.defineSecret,
}));
vi.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: mocks.createTrigger }));
vi.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: mocks.schedule }));
vi.mock('firebase-admin/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: mocks.db }));
vi.mock('../../server/lib/mailWorker/firestoreStore', () => ({ createFirestoreMailStore: () => ({}) }));
vi.mock('../../server/lib/mailWorker/gmailProvider', () => ({
  createGmailApiProvider: mocks.provider, createDelegatedTokenSource: mocks.tokens,
}));
vi.mock('../../server/lib/mailWorker/worker', () => ({ createMailWorker: () => ({ process: mocks.process, sweep: mocks.sweep }) }));
import { handleMailCreated, handleMailRecovery, resetGmailWorkerForTests } from '../../server/mailWorkerGmailFunctions';

describe('Gmail (Google Workspace) function entrypoints', () => {
  beforeEach(() => {
    mocks.enabled = false;
    mocks.values.MAIL_WORKER_CUTOVER_AT = '2026-09-27T00:00:00Z';
    mocks.process.mockReset(); mocks.sweep.mockReset(); mocks.db.mockClear();
    mocks.provider.mockClear(); mocks.tokens.mockClear();
    resetGmailWorkerForTests();
  });
  it('binds no secret at all', () => {
    expect(mocks.defineSecret).not.toHaveBeenCalled();
    expect(mocks.createTrigger.mock.calls[0][0]).not.toHaveProperty('secrets');
    expect(mocks.schedule.mock.calls[0][0]).not.toHaveProperty('secrets');
  });
  it('is inert when disabled, without minting tokens or opening Firestore', async () => {
    await handleMailCreated('mail-id'); await handleMailRecovery();
    expect(mocks.tokens).not.toHaveBeenCalled();
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it('pins the delegated sender and runtime identity from deploy params', async () => {
    mocks.enabled = true;
    await handleMailCreated('mail-id'); await handleMailRecovery();
    expect(mocks.tokens).toHaveBeenCalledExactlyOnceWith({
      serviceAccount: 'mail-worker@guardentra-staging.iam.gserviceaccount.com', sender: 'admin@example.test',
    });
    expect((mocks.provider.mock.calls[0] as unknown[])[0]).toMatchObject({ from: 'notifications@example.test' });
    expect(mocks.db).toHaveBeenCalledWith({}, '(default)');
    expect(mocks.process).toHaveBeenCalledExactlyOnceWith('mail-id');
    expect(mocks.sweep).toHaveBeenCalledTimes(1);
  });
  it('rejects a missing cutover before opening Firestore', async () => {
    mocks.enabled = true; mocks.values.MAIL_WORKER_CUTOVER_AT = '';
    await expect(handleMailCreated('mail-id')).rejects.toThrow(/^MAIL_WORKER_FAILED$/);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it('redacts errors at the invocation boundaries', async () => {
    mocks.enabled = true;
    mocks.process.mockRejectedValue(new Error('private-recipient'));
    mocks.sweep.mockRejectedValue(new Error('private-recipient'));
    await expect(handleMailCreated('mail-id')).rejects.toThrow(/^MAIL_WORKER_FAILED$/);
    await expect(handleMailRecovery()).rejects.toThrow(/^MAIL_WORKER_FAILED$/);
  });
  it('registers the same bounded handlers as the SendGrid variant', () => {
    expect(mocks.createTrigger.mock.calls[0][0]).toMatchObject({ document: 'mail/{mailId}', retry: true, maxInstances: 5, concurrency: 1 });
    expect(mocks.schedule.mock.calls[0][0]).toMatchObject({ schedule: 'every 1 minutes', maxInstances: 1, concurrency: 1 });
  });
});
