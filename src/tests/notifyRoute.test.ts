// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ add: vi.fn(), ensureAdmin: vi.fn() }));
vi.mock('../../server/lib/adminDb', () => ({ getAdminDb: () => ({ collection: () => ({ add: mocks.add }) }) }));
vi.mock('../../server/middleware/requireFirebaseAuth', () => ({ ensureAdmin: mocks.ensureAdmin }));
import router from '../../server/routes/notify';

const handler = router.stack.find(layer => layer.route?.path === '/mail')!.route!.stack[0].handle;
async function request(body: unknown) {
  const res = { code: 200, body: undefined as unknown, status(code: number) { this.code = code; return this; }, json(value: unknown) { this.body = value; return this; } };
  await handler({ body } as never, res as never, (() => {}) as never);
  return res;
}
describe('mail API queue boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.add.mockResolvedValue({ id: 'queue-id' }); });
  it('queues a valid invitation without client-injected delivery/provider fields', async () => {
    const res = await request({ to: 'vendor@example.test', subject: 'Invitation', text: 'Tenant A link', delivery: { state: 'SUCCESS' }, from: 'evil@example.test' });
    expect(res.body).toEqual({ queued: true, id: 'queue-id' });
    expect(mocks.add.mock.calls[0][0]).not.toHaveProperty('delivery');
    expect(mocks.add.mock.calls[0][0]).not.toHaveProperty('from');
  });
  it.each([null, {}, { to: 'invalid', subject: 'x', text: 'x' }, { to: 'a@example.test', subject: 'x', text: 'x', html: {} }])('rejects malformed request before database access', async body => {
    expect((await request(body)).code).toBe(400);
    expect(mocks.ensureAdmin).not.toHaveBeenCalled();
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it('does not log secrets or return false success on queue failure', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.add.mockRejectedValue(new Error('secret-value private@example.test'));
    const res = await request({ to: 'a@example.test', subject: 'x', text: 'x' });
    expect(res.code).toBe(502);
    expect(res.body).toEqual({ error: 'Could not queue email' });
    expect(log).toHaveBeenCalledExactlyOnceWith('[notify] QUEUE_WRITE_FAILED');
    log.mockRestore();
  });
});
