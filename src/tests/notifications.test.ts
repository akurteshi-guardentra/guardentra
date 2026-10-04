import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/authHeaders', () => ({
  authHeaders: vi.fn(async (extra?: HeadersInit) => ({
    Authorization: 'Bearer test',
    ...(extra || {}),
  })),
}));

import { sendNotificationIntent } from '../lib/notifications';

describe('tenant-bound notifications client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends only intentType + objectId, never recipient or message content', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ queued: true, id: 'm1' }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendNotificationIntent({ intentType: 'assessment_invite', objectId: 'assessment-1' })
    ).resolves.toBeUndefined();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      intentType: 'assessment_invite',
      objectId: 'assessment-1',
    });
    expect(String(init.body)).not.toContain('to');
    expect(String(init.body)).not.toContain('subject');
    expect(String(init.body)).not.toContain('text');
  });

  it('surfaces API refusal text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Notification object is outside the authenticated organization' }), {
            status: 403,
          })
      )
    );

    await expect(
      sendNotificationIntent({ intentType: 'vendor_welcome', objectId: 'vendor-1' })
    ).rejects.toThrow('outside the authenticated organization');
  });
});
