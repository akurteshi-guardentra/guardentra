// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  GMAIL_SEND_ENDPOINT, GMAIL_SEND_SCOPE, METADATA_TOKEN_ENDPOINT, OAUTH_TOKEN_ENDPOINT,
  buildMimeMessage, createDelegatedTokenSource, createGmailApiProvider, type AccessTokenSource,
} from '../../server/lib/mailWorker/gmailProvider';

const SA = 'mail-worker@guardentra-staging.iam.gserviceaccount.com';
const SENDER = 'sender@example.test';
const mail = { to: ['vendor@example.test'], message: { subject: 'Invite', text: 'Hello', html: '<p>Hello</p>' } };

function tokens() {
  const invalidate = vi.fn(() => undefined);
  const source: AccessTokenSource = { token: vi.fn(async () => 'synthetic-access-token'), invalidate };
  return Object.assign(source, { invalidate });
}
function res(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function decodeRaw(fetcher: { mock: { calls: unknown[][] } }) {
  const init = fetcher.mock.calls[0][1] as RequestInit;
  return Buffer.from(JSON.parse(String(init.body)).raw, 'base64url').toString('utf8');
}

describe('buildMimeMessage', () => {
  it('builds multipart/alternative with base64 parts and pinned headers', () => {
    const mime = buildMimeMessage({
      from: 'notifications@example.test', fromName: 'GuardEntra', replyTo: 'support@example.test',
      to: 'vendor@example.test', subject: 'Prüfung', text: 'plain', html: '<b>html</b>', boundary: 'B',
    });
    expect(mime).toContain('From: "GuardEntra" <notifications@example.test>\r\n');
    expect(mime).toContain('To: vendor@example.test\r\n');
    expect(mime).toContain('Reply-To: support@example.test\r\n');
    expect(mime).toContain(`Subject: =?UTF-8?B?${Buffer.from('Prüfung').toString('base64')}?=`);
    expect(mime).toContain('Auto-Submitted: auto-generated');
    expect(mime).toContain('Content-Type: multipart/alternative; boundary="B"');
    expect(mime).toContain(Buffer.from('plain').toString('base64'));
    expect(mime).toContain(Buffer.from('<b>html</b>').toString('base64'));
    expect(mime.endsWith('--B--\r\n')).toBe(true);
  });
  it.each([
    { subject: 'x\r\nBcc: attacker@example.test' },
    { to: 'vendor@example.test\r\nBcc: attacker@example.test' },
    { to: 'a@b.test, c@d.test' },
    { fromName: 'Evil" <attacker@example.test>' },
    { replyTo: 'not-an-email' },
  ])('refuses header injection or malformed addresses %#', override => {
    expect(() => buildMimeMessage({
      from: 'notifications@example.test', to: 'vendor@example.test', subject: 's', text: 't', ...override,
    })).toThrow('MAIL_MESSAGE_INVALID');
  });
});

describe('createGmailApiProvider', () => {
  it('rejects invalid config', () => {
    expect(() => createGmailApiProvider({ from: 'bad', tokens: tokens() })).toThrow('MAIL_PROVIDER_CONFIG_INVALID');
    expect(() => createGmailApiProvider({ from: SENDER, fromName: 'a\nb', tokens: tokens() }))
      .toThrow('MAIL_PROVIDER_CONFIG_INVALID');
  });

  it('posts one raw message to the fixed endpoint without following redirects', async () => {
    const fetcher = vi.fn(async () => res(200, { id: 'synthetic' }));
    const provider = createGmailApiProvider({ from: SENDER, tokens: tokens() }, fetcher as typeof fetch);
    await expect(provider.send(mail)).resolves.toEqual({ outcome: 'accepted' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GMAIL_SEND_ENDPOINT);
    expect(init.redirect).toBe('error');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer synthetic-access-token');
    const mime = decodeRaw(fetcher);
    expect(mime).toContain(`From: ${SENDER}\r\n`);
    expect(mime).toContain('To: vendor@example.test\r\n');
  });

  it.each([
    [429, {}, 'temporary'],
    [403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 'temporary'],
    [403, { error: { errors: [{ reason: 'dailyLimitExceeded' }] } }, 'temporary'],
    [403, { error: { errors: [{ reason: 'forbidden' }] } }, 'permanent'],
    [400, {}, 'permanent'],
    [408, {}, 'unknown'],
    [500, {}, 'unknown'],
    [503, {}, 'unknown'],
  ])('classifies HTTP %i as %s', async (status, body, outcome) => {
    const fetcher = vi.fn(async () => res(status as number, body));
    const provider = createGmailApiProvider({ from: SENDER, tokens: tokens() }, fetcher as typeof fetch);
    expect((await provider.send(mail)).outcome).toBe(outcome);
  });

  it('waits an hour after the daily sending limit', async () => {
    const fetcher = vi.fn(async () => res(403, { error: { errors: [{ reason: 'dailyLimitExceeded' }] } }));
    const provider = createGmailApiProvider({ from: SENDER, tokens: tokens() }, fetcher as typeof fetch);
    expect(await provider.send(mail)).toEqual({ outcome: 'temporary', retryAfterMs: 3_600_000 });
  });

  it('invalidates the token on 401 and retries later (nothing sent)', async () => {
    const t = tokens();
    const fetcher = vi.fn(async () => res(401));
    const provider = createGmailApiProvider({ from: SENDER, tokens: t }, fetcher as typeof fetch);
    expect((await provider.send(mail)).outcome).toBe('temporary');
    expect(t.invalidate).toHaveBeenCalledTimes(1);
  });

  it('treats a token failure as temporary and never calls Gmail', async () => {
    const t = { token: vi.fn(async () => { throw new Error('secret detail'); }), invalidate: vi.fn() };
    const fetcher = vi.fn();
    const provider = createGmailApiProvider({ from: SENDER, tokens: t }, fetcher as typeof fetch);
    expect((await provider.send(mail)).outcome).toBe('temporary');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('maps transport errors to unknown (no auto-replay)', async () => {
    const fetcher = vi.fn(async () => { throw new Error('socket reset'); });
    const provider = createGmailApiProvider({ from: SENDER, tokens: tokens() }, fetcher as typeof fetch);
    expect(await provider.send(mail)).toEqual({ outcome: 'unknown' });
  });

  it('refuses multi-recipient mail and injected subjects before any network call', async () => {
    const fetcher = vi.fn();
    const provider = createGmailApiProvider({ from: SENDER, tokens: tokens() }, fetcher as typeof fetch);
    expect((await provider.send({ ...mail, to: ['a@b.test', 'c@d.test'] })).outcome).toBe('permanent');
    expect((await provider.send({ ...mail, message: { ...mail.message, subject: 'x\nBcc: e@f.test' } })).outcome)
      .toBe('permanent');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('createDelegatedTokenSource', () => {
  function happyFetcher() {
    return vi.fn(async (url: string) => {
      if (url === METADATA_TOKEN_ENDPOINT) return res(200, { access_token: 'runtime-token', expires_in: 3599 });
      if (url.startsWith('https://iamcredentials.googleapis.com/')) return res(200, { keyId: 'k', signedJwt: 'signed.jwt.value' });
      if (url === OAUTH_TOKEN_ENDPOINT) return res(200, { access_token: 'delegated-token', expires_in: 3600 });
      return res(404);
    });
  }

  it('rejects malformed service account or sender', () => {
    expect(() => createDelegatedTokenSource({ serviceAccount: 'nope', sender: SENDER })).toThrow('MAIL_PROVIDER_CONFIG_INVALID');
    expect(() => createDelegatedTokenSource({ serviceAccount: SA, sender: 'x\n@y.z' })).toThrow('MAIL_PROVIDER_CONFIG_INVALID');
  });

  it('signs claims for the pinned sender with the send-only scope and caches the token', async () => {
    const fetcher = happyFetcher();
    let now = 1_800_000_000_000;
    const source = createDelegatedTokenSource({ serviceAccount: SA, sender: SENDER },
      { fetcher: fetcher as unknown as typeof fetch, now: () => now });
    await expect(source.token()).resolves.toBe('delegated-token');
    expect(fetcher).toHaveBeenCalledTimes(3);

    const [signUrl, signInit] = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    expect(signUrl).toBe(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(SA)}:signJwt`);
    expect((signInit.headers as Record<string, string>).Authorization).toBe('Bearer runtime-token');
    const claims = JSON.parse(JSON.parse(String(signInit.body)).payload);
    expect(claims).toMatchObject({ iss: SA, sub: SENDER, scope: GMAIL_SEND_SCOPE, aud: OAUTH_TOKEN_ENDPOINT });
    expect(claims.exp - claims.iat).toBe(3600);

    const exchange = new URLSearchParams(String((fetcher.mock.calls[2] as unknown as [string, RequestInit])[1].body));
    expect(exchange.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(exchange.get('assertion')).toBe('signed.jwt.value');

    now += 30 * 60_000; await source.token();
    expect(fetcher).toHaveBeenCalledTimes(3); // cached
    now += 26 * 60_000; await source.token();
    expect(fetcher).toHaveBeenCalledTimes(6); // refreshed inside the 5-minute skew
    source.invalidate(); await source.token();
    expect(fetcher).toHaveBeenCalledTimes(9);
  });

  it.each(['metadata', 'sign', 'exchange'])('fails closed with a redacted error when %s fails', async step => {
    const base = happyFetcher();
    const fetcher = vi.fn(async (url: string) => {
      if (step === 'metadata' && url === METADATA_TOKEN_ENDPOINT) return res(500, { detail: 'private' });
      if (step === 'sign' && url.startsWith('https://iamcredentials')) return res(403, { detail: 'private' });
      if (step === 'exchange' && url === OAUTH_TOKEN_ENDPOINT) return res(401, { error: 'unauthorized_client' });
      return base(url);
    });
    const source = createDelegatedTokenSource({ serviceAccount: SA, sender: SENDER },
      { fetcher: fetcher as unknown as typeof fetch });
    await expect(source.token()).rejects.toThrow(/^GMAIL_TOKEN_UNAVAILABLE$/);
  });
});
