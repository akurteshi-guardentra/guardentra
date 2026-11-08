import type { MailProvider, ProviderMail, ProviderResult } from './provider';

/**
 * Google Workspace delivery through the Gmail API (`users.messages.send`) with
 * keyless domain-wide delegation. No secret or key file is stored: the worker's
 * runtime service account signs its own JWT through the IAM Credentials API and
 * exchanges it for a token that acts as ONE configured sender mailbox with the
 * send-only scope. The delegated mailbox is pinned from deploy config and can
 * never come from a queue document.
 */
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const GMAIL_SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
export const OAUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const METADATA_TOKEN_ENDPOINT =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const TIMEOUT_MS = 15_000;
const TOKEN_SKEW_MS = 5 * 60_000;
const DAILY_LIMIT_RETRY_MS = 60 * 60_000;
const RATE_LIMIT_RETRY_MS = 60_000;

const EMAIL_RE = /^[^\s@<>"(),;:\\[\]]+@[^\s@<>"(),;:\\[\]]+\.[^\s@<>"(),;:\\[\]]+$/;
const SA_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/;

export class GmailTokenError extends Error {
  constructor() { super('GMAIL_TOKEN_UNAVAILABLE'); this.name = 'GmailTokenError'; }
}

export type AccessTokenSource = {
  /** Resolves a bearer token for the sender mailbox. Throws GmailTokenError only. */
  token(): Promise<string>;
  /** Drop a cached token after the API rejects it. */
  invalidate(): void;
};

async function discardBody(response: Response) {
  if (response.body) {
    try { await response.body.cancel(); } catch { /* Cleanup cannot change the outcome. */ }
  }
}

/**
 * Keyless delegated token: metadata token for the runtime service account →
 * IAM Credentials signJwt (sub = sender) → OAuth JWT-bearer exchange.
 * Requires roles/iam.serviceAccountTokenCreator for the service account on itself
 * and a Workspace domain-wide delegation entry for its client ID with
 * GMAIL_SEND_SCOPE only.
 */
export function createDelegatedTokenSource(config: {
  serviceAccount: string; sender: string;
}, deps: { fetcher?: typeof fetch; now?: () => number } = {}): AccessTokenSource {
  if (!SA_RE.test(config.serviceAccount) || !EMAIL_RE.test(config.sender)) {
    throw new Error('MAIL_PROVIDER_CONFIG_INVALID');
  }
  const fetcher = deps.fetcher || fetch;
  const now = deps.now || Date.now;
  let cached: { value: string; expiresAt: number } | null = null;

  async function json(response: Response): Promise<Record<string, unknown> | null> {
    if (!response.ok) { await discardBody(response); return null; }
    try { return await response.json() as Record<string, unknown>; } catch { return null; }
  }

  async function mint(): Promise<{ value: string; expiresAt: number }> {
    const runtime = await json(await fetcher(METADATA_TOKEN_ENDPOINT, {
      headers: { 'Metadata-Flavor': 'Google' }, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
    }));
    if (typeof runtime?.access_token !== 'string') throw new GmailTokenError();

    const iat = Math.floor(now() / 1000);
    const claims = {
      iss: config.serviceAccount, sub: config.sender, scope: GMAIL_SEND_SCOPE,
      aud: OAUTH_TOKEN_ENDPOINT, iat, exp: iat + 3600,
    };
    const signEndpoint = 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/' +
      `${encodeURIComponent(config.serviceAccount)}:signJwt`;
    const signed = await json(await fetcher(signEndpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${runtime.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: JSON.stringify(claims) }),
    }));
    if (typeof signed?.signedJwt !== 'string') throw new GmailTokenError();

    const exchanged = await json(await fetcher(OAUTH_TOKEN_ENDPOINT, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signed.signedJwt,
      }).toString(),
    }));
    const expiresIn = Number(exchanged?.expires_in);
    if (typeof exchanged?.access_token !== 'string' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new GmailTokenError();
    }
    return { value: exchanged.access_token, expiresAt: now() + expiresIn * 1000 };
  }

  return {
    async token() {
      if (cached && cached.expiresAt - TOKEN_SKEW_MS > now()) return cached.value;
      cached = null;
      try { cached = await mint(); }
      catch { throw new GmailTokenError(); } // Never surface SDK/HTTP details.
      return cached.value;
    },
    invalidate() { cached = null; },
  };
}

function hasLineBreak(value: string) { return /[\r\n\0]/.test(value); }

function encodeHeaderWord(value: string) {
  // RFC 2047 only when needed; ASCII printable passes through unchanged.
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function base64Lines(value: string) {
  return (Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g) || ['']).join('\r\n');
}

/** RFC 5322 message. Throws on any header-injection attempt. Exported for tests. */
export function buildMimeMessage(input: {
  from: string; fromName?: string; replyTo?: string; to: string; subject: string; text: string; html?: string;
  boundary?: string;
}): string {
  const { from, fromName, replyTo, to, subject } = input;
  if ([from, fromName || '', replyTo || '', to, subject].some(hasLineBreak) ||
      !EMAIL_RE.test(from) || !EMAIL_RE.test(to) || (replyTo && !EMAIL_RE.test(replyTo)) ||
      (fromName && /["\\<>]/.test(fromName))) {
    throw new Error('MAIL_MESSAGE_INVALID');
  }
  const boundary = input.boundary || `gentra-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const headers = [
    `From: ${fromName ? `"${encodeHeaderWord(fromName)}" <${from}>` : from}`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeHeaderWord(subject)}`,
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',
  ];
  const part = (type: string, body: string) => [
    `--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, 'Content-Transfer-Encoding: base64', '',
    base64Lines(body),
  ].join('\r\n');
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    part('text/plain', input.text),
    ...(input.html ? [part('text/html', input.html)] : []),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

const TEMPORARY_403 = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded',
  'quotaExceeded', 'backendError']);

async function errorReason(response: Response): Promise<string | null> {
  // Read only the machine-readable reason. Never log or persist the body.
  try {
    const body = await response.json() as { error?: { errors?: Array<{ reason?: unknown }>; status?: unknown } };
    const reason = body?.error?.errors?.[0]?.reason;
    return typeof reason === 'string' ? reason : null;
  } catch { return null; }
}

export function createGmailApiProvider(config: {
  from: string; fromName?: string; replyTo?: string; tokens: AccessTokenSource;
}, fetcher: typeof fetch = fetch): MailProvider {
  if (!EMAIL_RE.test(config.from) || (config.replyTo && !EMAIL_RE.test(config.replyTo)) ||
      (config.fromName && (hasLineBreak(config.fromName) || /["\\<>]/.test(config.fromName)))) {
    throw new Error('MAIL_PROVIDER_CONFIG_INVALID');
  }
  return {
    async send(mail: ProviderMail): Promise<ProviderResult> {
      if (mail.to.length !== 1) return { outcome: 'permanent' };
      let raw: string;
      try {
        raw = Buffer.from(buildMimeMessage({
          from: config.from, fromName: config.fromName, replyTo: config.replyTo, to: mail.to[0],
          subject: mail.message.subject, text: mail.message.text, html: mail.message.html,
        }), 'utf8').toString('base64url');
      } catch { return { outcome: 'permanent' }; }

      let token: string;
      // No request has been made yet, so retrying cannot duplicate a send.
      try { token = await config.tokens.token(); }
      catch { return { outcome: 'temporary', retryAfterMs: RATE_LIMIT_RETRY_MS }; }

      try {
        const response = await fetcher(GMAIL_SEND_ENDPOINT, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        if (response.status === 200) { await discardBody(response); return { outcome: 'accepted' }; }
        if (response.status === 401) {
          await discardBody(response); config.tokens.invalidate();
          return { outcome: 'temporary', retryAfterMs: RATE_LIMIT_RETRY_MS };
        }
        if (response.status === 429) {
          await discardBody(response);
          return { outcome: 'temporary', retryAfterMs: RATE_LIMIT_RETRY_MS };
        }
        if (response.status === 403) {
          const reason = await errorReason(response);
          if (reason === 'dailyLimitExceeded') return { outcome: 'temporary', retryAfterMs: DAILY_LIMIT_RETRY_MS };
          if (reason && TEMPORARY_403.has(reason)) return { outcome: 'temporary', retryAfterMs: RATE_LIMIT_RETRY_MS };
          return { outcome: 'permanent' };
        }
        await discardBody(response);
        // 408 / 5xx may follow acceptance. Never auto-replay.
        if (response.status >= 400 && response.status < 500 && response.status !== 408) {
          return { outcome: 'permanent' };
        }
        return { outcome: 'unknown' };
      } catch {
        return { outcome: 'unknown' };
      }
    },
  };
}
