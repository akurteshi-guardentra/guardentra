import { authHeaders } from './authHeaders';

export interface EmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Queues an email via the server's /api/notify/mail proxy (server/routes/notify.ts),
 * which writes to the Firestore `mail` collection for the Trigger Email extension. */
export async function sendEmail(input: EmailInput): Promise<void> {
  const response = await fetch('/api/notify/mail', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    let detail = 'Failed to queue email';
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      /* non-JSON body */
    }
    throw new Error(detail);
  }
}

/** Best-effort — a notification failure should never block the action that triggered it.
 * Prefer `sendEmail` when the UI must report queue success/failure (e.g. Invite Vendor). */
export async function sendEmailBestEffort(input: EmailInput): Promise<void> {
  try {
    await sendEmail(input);
  } catch (err) {
    console.warn('sendEmailBestEffort: could not queue email', err);
  }
}
