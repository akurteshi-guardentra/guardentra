import { authHeaders } from './authHeaders';

export type NotificationIntentType =
  | 'vendor_welcome'
  | 'assessment_invite'
  | 'assessment_reminder';

export interface NotificationIntentInput {
  intentType: NotificationIntentType;
  objectId: string;
}

/**
 * Requests a server-authorized GuardEntra notification.
 * The client never supplies recipient or message content; /api/notify/mail derives
 * those from tenant-bound Firestore objects after verifying the authenticated user.
 * A successful response proves only that the mail queue accepted/deduplicated the
 * intent — not provider acceptance or inbox receipt.
 */
export async function sendNotificationIntent(input: NotificationIntentInput): Promise<void> {
  const response = await fetch('/api/notify/mail', {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      intentType: input.intentType,
      objectId: input.objectId,
    }),
  });
  if (!response.ok) {
    let detail = 'Failed to queue notification';
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      /* non-JSON body */
    }
    throw new Error(detail);
  }
}
