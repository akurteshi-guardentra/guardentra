// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { buildMailQueueDocument, validateMailInput } from '../../server/lib/mailQueue';
import { createSendGridProvider, type MailProvider, type ProviderResult } from '../../server/lib/mailWorker/provider';
import { createMailWorker, LEASE_MS, MAX_ATTEMPTS, WORKER_OWNER, type Delivery, type MailRecord, type MailStore } from '../../server/lib/mailWorker/worker';

const invitation = { to: 'vendor@example.test', subject: 'Security assessment', text: 'Tenant A invitation: https://example.test/portal/assessment-a' };
const queued = () => buildMailQueueDocument(invitation);
function fixture(result: ProviderResult = { outcome: 'accepted' }) {
  let time = 1_000;
  let record: MailRecord | null = { data: queued(), createdAtMs: 1_000 };
  const store: MailStore = {
    async transact(_id, fn) {
      const change = fn(record && structuredClone(record));
      if (change.delivery && record) record.data.delivery = structuredClone(change.delivery);
      return change.value;
    },
    async due(at) {
      const d = record?.data.delivery as Delivery;
      return d?.dueAt != null && d.dueAt <= at ? ['mail-a'] : [];
    },
  };
  const send = vi.fn<MailProvider['send']>().mockResolvedValue(result);
  const observe = vi.fn();
  const options = { enabled: true, cutoverMs: 1_000 };
  const worker = createMailWorker({ store, provider: { send }, options, now: () => time, observe });
  return {
    worker, store, send, observe, options,
    record: () => record!, delivery: () => record?.data.delivery as Delivery,
    advance: (ms: number) => { time += ms; }, remove: () => { record = null; },
  };
}

describe('mail input validation', () => {
  it('accepts a valid invitation and optional HTML', () => {
    expect(validateMailInput(invitation)).toBeNull();
    expect(validateMailInput({ ...invitation, html: '<p>Invite</p>' })).toBeNull();
  });
  it.each([
    null, [], {}, { ...invitation, to: ['vendor@example.test'] },
    { ...invitation, to: 'x\r\nBcc: y@example.test' },
    { ...invitation, subject: 'Hi\nBcc: x' }, { ...invitation, text: ' ' },
    { ...invitation, html: {} }, { ...invitation, html: null },
    { ...invitation, html: 12 },
  ])('rejects malformed input without reflecting it: %j', input => {
    expect(validateMailInput(input)?.status).toBe(400);
  });
  it('rejects oversized content', () => {
    expect(validateMailInput({ ...invitation, html: 'x'.repeat(10001) })?.status).toBe(413);
  });
});

describe('mail delivery state machine', () => {
  it('delivers only the queued recipient/content, and preserves the queue payload', async () => {
    const f = fixture();
    f.record().data.organizationId = 'tenant-a';
    f.record().data.from = 'attacker@example.test';
    expect(await f.worker.process('mail-a')).toBe('SUCCESS');
    expect(f.send).toHaveBeenCalledExactlyOnceWith({ to: [invitation.to], message: queued().message });
    expect(f.record().data.message).toEqual(queued().message);
    expect(f.delivery()).toMatchObject({ state: 'SUCCESS', code: 'ACCEPTED', dueAt: null, attempts: 1 });
    expect(JSON.stringify(f.observe.mock.calls)).not.toContain('tenant-a');
    expect(JSON.stringify(f.observe.mock.calls)).not.toContain(invitation.to);
    expect(JSON.stringify(f.observe.mock.calls)).not.toContain('assessment-a');
  });
  it('concurrent duplicate events and terminal replay send once', async () => {
    const f = fixture();
    await Promise.all([f.worker.process('mail-a'), f.worker.process('mail-a')]);
    await f.worker.process('mail-a');
    expect(f.send).toHaveBeenCalledTimes(1);
  });
  it('retries definite temporary rejection only after durable due time', async () => {
    const f = fixture({ outcome: 'temporary', retryAfterMs: 120_000 });
    expect(await f.worker.process('mail-a')).toBe('RETRY');
    expect(f.delivery().dueAt).toBe(121_000);
    await f.worker.process('mail-a');
    expect(f.send).toHaveBeenCalledTimes(1);
    f.send.mockResolvedValue({ outcome: 'accepted' });
    f.advance(120_000);
    await f.worker.sweep();
    expect(f.delivery()).toMatchObject({ state: 'SUCCESS', attempts: 2 });
  });
  it('exhausts retries and never sends a sixth attempt', async () => {
    const f = fixture({ outcome: 'temporary' });
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) {
      await f.worker.process('mail-a');
      f.advance(1_000_000);
    }
    expect(f.send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(f.delivery()).toMatchObject({ state: 'ERROR', code: 'RETRY_EXHAUSTED', dueAt: null });
  });
  it('holds permanent failure without retry', async () => {
    const f = fixture({ outcome: 'permanent' });
    await f.worker.process('mail-a');
    f.advance(1_000_000);
    await f.worker.sweep();
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(f.delivery().code).toBe('PROVIDER_REJECTED');
  });
  it('redacts thrown provider secrets and holds unknown acceptance', async () => {
    const f = fixture();
    f.send.mockRejectedValue(new Error('Bearer test-only-secret recipient@example.test'));
    await f.worker.process('mail-a');
    await f.worker.process('mail-a');
    expect(f.delivery().code).toBe('OUTCOME_UNKNOWN');
    expect(f.send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify([f.delivery(), f.observe.mock.calls])).not.toMatch(/test-only-secret|recipient@/);
  });
  it('recovers an expired lease without resending; fences a late provider response', async () => {
    const f = fixture();
    let resolve!: (result: ProviderResult) => void;
    f.send.mockImplementation(() => new Promise(r => { resolve = r; }));
    const pending = f.worker.process('mail-a');
    await vi.waitFor(() => expect(f.send).toHaveBeenCalledTimes(1));
    f.advance(LEASE_MS);
    await f.worker.sweep();
    expect(f.delivery().code).toBe('OUTCOME_UNKNOWN');
    resolve({ outcome: 'accepted' });
    await pending;
    expect(f.delivery().code).toBe('OUTCOME_UNKNOWN');
    expect(f.send).toHaveBeenCalledTimes(1);
  });
  it('holds a lost completion write after provider acceptance', async () => {
    const f = fixture();
    const transact = f.store.transact;
    let calls = 0;
    f.store.transact = async (...args) => {
      if (++calls === 2) throw new Error('synthetic storage unavailable');
      return transact(...args);
    };
    await expect(f.worker.process('mail-a')).rejects.toThrow();
    f.store.transact = transact;
    f.advance(LEASE_MS);
    await f.worker.sweep();
    expect(f.delivery().code).toBe('OUTCOME_UNKNOWN');
    expect(f.send).toHaveBeenCalledTimes(1);
  });
  it('never calls the provider before successful claim persistence', async () => {
    const f = fixture();
    f.store.transact = async () => { throw new Error('synthetic claim failure'); };
    await expect(f.worker.process('mail-a')).rejects.toThrow();
    expect(f.send).not.toHaveBeenCalled();
  });
  it('rejects malformed queued payload and ignores message.to override', async () => {
    const f = fixture();
    f.record().data.to = ['invalid'];
    (f.record().data.message as Record<string, unknown>).to = 'valid@example.test';
    await f.worker.process('mail-a');
    expect(f.delivery().code).toBe('INVALID_QUEUE');
    expect(f.send).not.toHaveBeenCalled();
  });
  it.each(['PENDING', 'PROCESSING', 'ERROR', 'SUCCESS', 'RETRY'])('skips extension-owned %s', async state => {
    const f = fixture();
    f.record().data.delivery = { state };
    expect(await f.worker.process('mail-a')).toBe('skipped');
    expect(f.send).not.toHaveBeenCalled();
  });
  it('uses Firestore creation time, not the client supplied timestamp, for cutover', async () => {
    const f = fixture();
    f.record().createdAtMs = 999;
    f.record().data.createdAt = '2099-01-01T00:00:00Z';
    expect(await f.worker.process('mail-a')).toBe('skipped');
    expect(f.send).not.toHaveBeenCalled();
  });
  it('does nothing when disabled or the document is missing', async () => {
    const f = fixture();
    f.options.enabled = false;
    await f.worker.process('mail-a');
    await f.worker.sweep();
    f.options.enabled = true;
    f.remove();
    await f.worker.process('mail-a');
    expect(f.send).not.toHaveBeenCalled();
  });
  it('observability failure cannot turn acceptance into resend', async () => {
    const f = fixture();
    f.observe.mockImplementation(() => { throw new Error('observer failed'); });
    await f.worker.process('mail-a');
    await f.worker.process('mail-a');
    expect(f.delivery().owner).toBe(WORKER_OWNER);
    expect(f.delivery().state).toBe('SUCCESS');
    expect(f.send).toHaveBeenCalledTimes(1);
  });
});

describe('replaceable SendGrid adapter', () => {
  const config = { apiKey: 'synthetic-test-secret', from: 'sender@example.test', region: 'us' as const };
  it.each([
    [202, 'accepted'], [429, 'temporary'], [400, 'permanent'], [401, 'permanent'],
    [403, 'permanent'], [408, 'unknown'], [500, 'unknown'], [503, 'unknown'], [200, 'unknown'],
  ])('maps HTTP %i to %s without exposing response content', async (status, outcome) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('test-secret-with-private-recipient', { status }));
    const result = await createSendGridProvider(config, fetcher).send({ to: [invitation.to], message: queued().message });
    expect(result.outcome).toBe(outcome);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(fetcher.mock.calls[0][0]).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(fetcher.mock.calls[0][1]?.redirect).toBe('error');
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it('honors Retry-After for a confirmed 429', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429, headers: { 'retry-after': '180' } }));
    expect(await createSendGridProvider(config, fetcher).send({ to: [invitation.to], message: queued().message }))
      .toEqual({ outcome: 'temporary', retryAfterMs: 180_000 });
  });
  it('does not expose thrown transport errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('Authorization: secret'));
    expect(await createSendGridProvider(config, fetcher).send({ to: [invitation.to], message: queued().message }))
      .toEqual({ outcome: 'unknown' });
  });
  it('rejects missing configuration without reflecting it', () => {
    expect(() => createSendGridProvider({ ...config, from: 'invalid-secret' })).toThrow('MAIL_PROVIDER_CONFIG_INVALID');
    expect(() => createSendGridProvider({ ...config, apiKey: '' })).toThrow('MAIL_PROVIDER_CONFIG_INVALID');
  });
});
