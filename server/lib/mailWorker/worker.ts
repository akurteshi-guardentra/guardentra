import { randomUUID } from 'node:crypto';
import { MAIL_QUEUE_SOURCE, validateMailInput } from '../mailQueue';
import type { MailProvider, ProviderMail, ProviderResult } from './provider';

export const WORKER_OWNER = 'guardentra.mail.v1';
export const LEASE_MS = 120_000;
export const MAX_ATTEMPTS = 5;
export type DeliveryCode = 'ACCEPTED' | 'RATE_LIMITED' | 'PROVIDER_REJECTED' |
  'OUTCOME_UNKNOWN' | 'INVALID_QUEUE' | 'RETRY_EXHAUSTED';
export type Delivery = {
  owner: typeof WORKER_OWNER;
  state: 'PROCESSING' | 'RETRY' | 'SUCCESS' | 'ERROR';
  attempts: number;
  attemptId: string;
  startedAt: number;
  updatedAt: number;
  /** Epoch milliseconds: lease expiration or retry due time; null on terminal. */
  dueAt: number | null;
  code: DeliveryCode | null;
};
export type MailRecord = { data: Record<string, unknown>; createdAtMs: number };
export interface MailStore {
  /** Callback may repeat. It MUST NOT perform side effects. */
  transact<T>(id: string, fn: (record: MailRecord | null) => { value: T; delivery?: Delivery }): Promise<T>;
  due(now: number, limit: number): Promise<string[]>;
}
export type MailEvent = { event: 'mail_delivery'; state: Delivery['state']; code: DeliveryCode | null; attempts: number };
export type WorkerOptions = { enabled: boolean; cutoverMs: number };

function parseMail(data: Record<string, unknown>): ProviderMail | null {
  const message = data.message as Record<string, unknown> | undefined;
  if (data.source !== MAIL_QUEUE_SOURCE || !Array.isArray(data.to) || data.to.length !== 1 ||
      !message || typeof message !== 'object' || Array.isArray(message) ||
      validateMailInput({ ...message, to: data.to[0] })) return null;
  // Allowlist transport fields: no client sender, headers, tenant metadata or credentials.
  return {
    to: [data.to[0] as string],
    message: {
      subject: message.subject as string, text: message.text as string,
      ...(typeof message.html === 'string' ? { html: message.html } : {}),
    },
  };
}

export function createMailWorker(deps: {
  store: MailStore; provider: MailProvider; options: WorkerOptions;
  now?: () => number; observe?: (event: MailEvent) => void;
}) {
  const now = deps.now || Date.now;
  function observe(delivery: Delivery) {
    // Explicit allowlist; neither payload, document ID nor arbitrary error enters logs.
    try {
      deps.observe?.({ event: 'mail_delivery', state: delivery.state, code: delivery.code, attempts: delivery.attempts });
    } catch { /* Observability cannot alter a durable delivery outcome. */ }
  }
  async function process(id: string): Promise<'skipped' | Delivery['state']> {
    if (!deps.options.enabled) return 'skipped';
    if (!Number.isFinite(deps.options.cutoverMs)) throw new Error('MAIL_CUTOVER_INVALID');
    const attemptId = randomUUID();
    const claimed = await deps.store.transact<{ delivery?: Delivery; mail?: ProviderMail }>(id, record => {
      if (!record || record.createdAtMs < deps.options.cutoverMs) return { value: {} };
      const existing = record.data.delivery as Delivery | undefined;
      if (existing !== undefined && (!existing || existing.owner !== WORKER_OWNER)) return { value: {} };
      const at = now();
      if (existing && (existing.state === 'SUCCESS' || existing.state === 'ERROR' ||
          existing.dueAt === null || existing.dueAt > at)) return { value: {} };
      if (existing && !['PROCESSING', 'RETRY'].includes(existing.state)) return { value: {} };
      const mail = parseMail(record.data);
      const code: DeliveryCode | null = existing?.state === 'PROCESSING' ? 'OUTCOME_UNKNOWN' :
        !mail ? 'INVALID_QUEUE' : (existing?.attempts || 0) >= MAX_ATTEMPTS ? 'RETRY_EXHAUSTED' : null;
      const delivery: Delivery = {
        owner: WORKER_OWNER, attemptId, state: code ? 'ERROR' : 'PROCESSING',
        attempts: (existing?.attempts || 0) + (code ? 0 : 1),
        startedAt: at, updatedAt: at, dueAt: code ? null : at + LEASE_MS, code,
      };
      return { delivery, value: { delivery, ...(code ? {} : { mail: mail! }) } };
    });
    if (!claimed.delivery) return 'skipped';
    observe(claimed.delivery);
    if (!claimed.mail) return claimed.delivery.state;
    let result: ProviderResult;
    try { result = await deps.provider.send(claimed.mail); }
    catch { result = { outcome: 'unknown' }; }
    const updated = await deps.store.transact<Delivery | null>(id, record => {
      const delivery = record?.data.delivery as Delivery | undefined;
      if (delivery?.owner !== WORKER_OWNER || delivery.attemptId !== attemptId || delivery.state !== 'PROCESSING') {
        return { value: null };
      }
      const at = now();
      const retry = result?.outcome === 'temporary' && delivery.attempts < MAX_ATTEMPTS;
      const code: DeliveryCode = result?.outcome === 'accepted' ? 'ACCEPTED' :
        result?.outcome === 'temporary' ? (retry ? 'RATE_LIMITED' : 'RETRY_EXHAUSTED') :
        result?.outcome === 'permanent' ? 'PROVIDER_REJECTED' : 'OUTCOME_UNKNOWN';
      const delay = result?.outcome === 'temporary' && Number.isFinite(result.retryAfterMs)
        ? Math.max(0, result.retryAfterMs!) : 0;
      const next: Delivery = {
        ...delivery, state: code === 'ACCEPTED' ? 'SUCCESS' : retry ? 'RETRY' : 'ERROR', code,
        updatedAt: at, dueAt: retry ? at + Math.max(60_000 * 2 ** (delivery.attempts - 1), delay) : null,
      };
      return { delivery: next, value: next };
    });
    if (updated) observe(updated);
    return updated?.state || 'skipped';
  }
  return {
    process,
    async sweep() {
      if (!deps.options.enabled) return;
      for (const id of await deps.store.due(now(), 20)) await process(id);
    },
  };
}
