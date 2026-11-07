import type { Firestore } from 'firebase-admin/firestore';
import {
  commitPreparedMaterialAuditIntent,
  materialAuditEventId,
  prepareMaterialAuditIntent,
} from './audit/materialIntent.ts';
import { MAIL_COLLECTION } from './mailQueue.ts';
import {
  NotificationIntentError,
  type ResolvedNotificationIntent,
} from './notificationIntent.ts';

export const VENDOR_INVITES_COLLECTION = 'vendor_invites';

export function vendorWelcomeInviteId(vendorId: string): string {
  return `vendor_welcome_${vendorId}`;
}

/**
 * #167: the vendor welcome queue entry, its deterministic vendor_invites record
 * and the vendor.invite_queued material audit intent commit in ONE server
 * transaction. A retry of the same intent never queues a second email; it only
 * repairs a missing invite record or audit intent.
 *
 * Queue success is not provider acceptance or inbox delivery.
 */
export async function queueVendorWelcomeWithDurableAudit(input: {
  db: Firestore;
  actorId: string;
  resolved: ResolvedNotificationIntent;
  queueDoc: Record<string, unknown>;
  now?: Date;
}): Promise<{ deduplicated: boolean }> {
  const { db, actorId, resolved, queueDoc } = input;
  if (resolved.intentType !== 'vendor_welcome') {
    throw new Error('queueVendorWelcomeWithDurableAudit requires a vendor_welcome intent');
  }

  const vendorId = resolved.objectId;
  const organizationId = resolved.organizationId;
  const queueRef = db.collection(MAIL_COLLECTION).doc(resolved.queueId);
  const vendorRef = db.collection('vendors').doc(vendorId);
  const userRef = db.collection('users').doc(actorId);
  const inviteRef = db.collection(VENDOR_INVITES_COLLECTION).doc(vendorWelcomeInviteId(vendorId));
  const eventId = materialAuditEventId([
    organizationId,
    'vendor.invite_queued',
    vendorId,
    resolved.queueId,
  ]);

  return db.runTransaction(async (tx) => {
    const queueSnap = await tx.get(queueRef);
    const vendorSnap = await tx.get(vendorRef);
    const userSnap = await tx.get(userRef);
    const inviteSnap = await tx.get(inviteRef);

    if (
      !userSnap.exists ||
      String(userSnap.data()?.organizationId || '') !== organizationId
    ) {
      throw new NotificationIntentError(
        403,
        'membership_changed',
        'Organization membership changed; retry notification resolution',
      );
    }
    if (!vendorSnap.exists) {
      throw new NotificationIntentError(404, 'vendor_missing', 'Authoritative vendor no longer exists');
    }
    const vendor = vendorSnap.data() || {};
    if (vendor.organizationId !== organizationId) {
      throw new NotificationIntentError(404, 'object_unavailable', 'Notification object is unavailable');
    }
    const currentRecipient = String(vendor.primaryContactEmail || '').trim().toLowerCase();
    if (!currentRecipient || currentRecipient !== resolved.recipient.toLowerCase()) {
      throw new NotificationIntentError(
        409,
        'vendor_recipient_changed',
        'Vendor recipient changed; retry notification resolution',
      );
    }

    const existingInvite = inviteSnap.exists ? inviteSnap.data() || {} : {};
    const queuedAt =
      typeof existingInvite.createdAt === 'string' && existingInvite.createdAt.trim()
        ? existingInvite.createdAt
        : (input.now || new Date()).toISOString();
    const vendorName = String(vendor.name || '').trim() || null;

    const preparedAudit = await prepareMaterialAuditIntent(tx, db, {
      eventId,
      tenantId: organizationId,
      eventType: 'vendor.invite_queued',
      actorId,
      actorType: 'user',
      objectType: 'vendor',
      objectId: vendorId,
      payload: {
        vendorName,
        queueId: resolved.queueId,
        queueAccepted: true,
        toDomain: resolved.recipient.split('@')[1] || null,
      },
      createdAt: queuedAt,
    });

    const deduplicated = queueSnap.exists;
    if (!deduplicated) {
      tx.create(queueRef, queueDoc);
    }
    if (!inviteSnap.exists) {
      const userEmail = userSnap.data()?.email;
      tx.create(inviteRef, {
        organizationId,
        vendorId,
        vendorName,
        vendorEmail: resolved.recipient,
        invitedBy: actorId,
        invitedByEmail: typeof userEmail === 'string' && userEmail.trim() ? userEmail.trim() : null,
        status: 'email_queued',
        queueId: resolved.queueId,
        auditEventId: eventId,
        createdAt: queuedAt,
      });
    }
    commitPreparedMaterialAuditIntent(tx, preparedAudit);

    return { deduplicated };
  });
}
