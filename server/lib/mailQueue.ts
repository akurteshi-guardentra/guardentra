/**
 * Provider-neutral queue builder, compatible with Trigger Email (#72) and
 * the separately activated self-managed worker (#80).
 *
 * Schema must match:
 * https://firebase.google.com/docs/extensions/official/firestore-send-email
 *
 * Delivery status belongs to the exclusively selected consumer. This module
 * never writes `delivery` — doing so can race either consumer.
 *
 * Provider credentials live only in the selected consumer's secret binding.
 * Never import secrets here.
 */

export const MAIL_COLLECTION = 'mail' as const;
export const MAIL_QUEUE_SOURCE = 'guardentra.notify' as const;

/** Shared ingress/worker validation. Never include submitted values in errors. */
export function validateMailInput(input: unknown): { status: number; error: string } | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { status: 400, error: 'Mail must be an object' };
  }
  const { to, subject, text, html } = input as Record<string, unknown>;
  if (typeof to !== 'string' || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to.trim())) {
    return { status: 400, error: 'A valid "to" email address is required' };
  }
  if (typeof subject !== 'string' || !subject.trim() || /[\r\n]/.test(subject)) {
    return { status: 400, error: 'A valid subject is required' };
  }
  if (typeof text !== 'string' || !text.trim()) {
    return { status: 400, error: 'text is required' };
  }
  if (html !== undefined && typeof html !== 'string') {
    return { status: 400, error: 'html must be a string' };
  }
  if (to.length > 254 || subject.length > 300 || text.length > 5000 ||
      (typeof html === 'string' && html.length > 10000)) {
    return { status: 413, error: 'Mail exceeds allowed length' };
  }
  return null;
}

/**
 * Extension-owned delivery state strings commonly documented for
 * firestore-send-email. Exact state set/retry semantics depend on the installed
 * extension version — do not treat RETRY/PENDING as guaranteed without verifying
 * that version's docs.
 */
export type MailDeliveryState =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ERROR'
  | 'RETRY';

export type MailQueueMessage = {
  subject: string;
  text: string;
  html?: string;
};

/**
 * Document written by POST /api/notify/mail via Admin SDK.
 * Extra observability fields (`source`, `createdAt`) are ignored by the extension.
 */
export type MailQueueDocument = {
  to: string[];
  message: MailQueueMessage;
  createdAt: string;
  source: typeof MAIL_QUEUE_SOURCE;
};

export type BuildMailQueueInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Override for tests; production uses current UTC ISO time. */
  createdAt?: string;
};

/**
 * Build the Firestore mail document for firestore-send-email.
 * Does not include `from` / `replyTo` — staging uses extension Default FROM / REPLY-TO.
 * Does not include `delivery` — extension writes that field.
 */
export function buildMailQueueDocument(input: BuildMailQueueInput): MailQueueDocument {
  const to = input.to.trim();
  const subject = input.subject.trim();
  const text = input.text.trim();
  const html =
    typeof input.html === 'string' && input.html.trim() ? input.html : undefined;

  const message: MailQueueMessage = { subject, text };
  if (html !== undefined) {
    message.html = html;
  }

  return {
    to: [to],
    message,
    createdAt: input.createdAt || new Date().toISOString(),
    source: MAIL_QUEUE_SOURCE,
  };
}

/**
 * True when extension-reported delivery.state is SUCCESS.
 * SUCCESS = provider/SMTP accepted the message.
 * Inbox receipt must be confirmed separately.
 */
export function isMailDeliverySuccess(state: string | undefined | null): boolean {
  return state === 'SUCCESS';
}

/** True when extension-reported delivery.state is ERROR (terminal failure). */
export function isMailDeliveryError(state: string | undefined | null): boolean {
  return state === 'ERROR';
}
