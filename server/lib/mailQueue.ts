/**
 * Trigger Email (`firebase/firestore-send-email`) queue document builder.
 *
 * Schema must match:
 * https://firebase.google.com/docs/extensions/official/firestore-send-email
 *
 * Delivery status is owned by the extension (delivery.state / error / attempts).
 * This module never writes `delivery` — doing so can race the extension.
 *
 * SMTP / SendGrid credentials must live only in the extension config (or
 * Secret Manager referenced at install time). Never import secrets here.
 */

export const MAIL_COLLECTION = 'mail' as const;
export const MAIL_QUEUE_SOURCE = 'guardentra.notify' as const;

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
