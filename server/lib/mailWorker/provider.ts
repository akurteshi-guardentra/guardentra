import type { MailQueueMessage } from '../mailQueue';

export type ProviderMail = { to: string[]; message: MailQueueMessage };
export type ProviderResult =
  | { outcome: 'accepted' }
  | { outcome: 'temporary'; retryAfterMs?: number }
  | { outcome: 'permanent' }
  | { outcome: 'unknown' };

/** Adapters return classifications, never raw provider errors/responses. */
export interface MailProvider {
  send(mail: ProviderMail): Promise<ProviderResult>;
}

/** HTTPS only, fixed endpoint, no redirects that could forward credentials. */
export function createSendGridProvider(config: {
  apiKey: string;
  from: string;
  region: 'us' | 'eu';
}, fetcher: typeof fetch = fetch): MailProvider {
  if (!config.apiKey.trim() || /[\r\n]/.test(config.apiKey) ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(config.from) ||
      !['us', 'eu'].includes(config.region)) {
    throw new Error('MAIL_PROVIDER_CONFIG_INVALID');
  }
  const endpoint = config.region === 'eu'
    ? 'https://api.eu.sendgrid.com/v3/mail/send'
    : 'https://api.sendgrid.com/v3/mail/send';
  return {
    async send(mail) {
      try {
        const response = await fetcher(endpoint, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalizations: [{ to: mail.to.map(email => ({ email })) }],
            from: { email: config.from }, subject: mail.message.subject,
            content: [
              { type: 'text/plain', value: mail.message.text },
              ...(mail.message.html ? [{ type: 'text/html', value: mail.message.html }] : []),
            ],
          }),
        });
        // Do not read, persist or log response body/headers containing personal data.
        const retryAfter = response.headers.get('retry-after');
        if (response.body) await response.body.cancel();
        if (response.status === 202) return { outcome: 'accepted' };
        if (response.status === 429) {
          const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
          const dateDelay = retryAfter ? Date.parse(retryAfter) - Date.now() : 0;
          return { outcome: 'temporary', retryAfterMs: Math.max(0, seconds * 1000 || dateDelay || 0) };
        }
        // 408 / 5xx / transport errors may follow acceptance. Never auto-replay.
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
