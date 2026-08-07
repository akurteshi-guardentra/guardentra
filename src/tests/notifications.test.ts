import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/authHeaders', () => ({
  authHeaders: vi.fn(async (extra?: HeadersInit) => ({
    Authorization: 'Bearer test',
    ...(extra || {}),
  })),
}));

import { sendEmail, sendEmailBestEffort } from '../lib/notifications';

describe('notifications sendEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves when the notify API queues mail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ queued: true, id: 'm1' }), { status: 200 }))
    );
    await expect(
      sendEmail({ to: 'akurteshi@guardentra.com', subject: 'Hi', text: 'Body' })
    ).resolves.toBeUndefined();
  });

  it('surfaces API error text on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Could not queue email' }), { status: 502 })
      )
    );
    await expect(
      sendEmail({ to: 'akurteshi@guardentra.com', subject: 'Hi', text: 'Body' })
    ).rejects.toThrow('Could not queue email');
  });

  it('sendEmailBestEffort swallows failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'nope' }), { status: 502 }))
    );
    await expect(
      sendEmailBestEffort({ to: 'akurteshi@guardentra.com', subject: 'Hi', text: 'Body' })
    ).resolves.toBeUndefined();
  });
});
