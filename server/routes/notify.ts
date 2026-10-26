import { Router, type Request } from 'express';
import { ensureAdmin } from '../middleware/requireFirebaseAuth';
import { getAdminDb } from '../lib/adminDb';
import { createRateLimiter } from '../middleware/rateLimit';
import { buildMailQueueDocument, MAIL_COLLECTION } from '../lib/mailQueue';
import {
  commitPreparedMaterialAuditIntent,
  materialAuditEventId,
  prepareMaterialAuditIntent,
} from '../lib/audit/materialIntent';
import {
  NotificationIntentError,
  parseNotificationIntentRequest,
  resolveNotificationIntent,
  type NotificationAuthorityStore,
} from '../lib/notificationIntent';

const router = Router();

// Queuing emails is abuse-prone (spam any address, run up email-provider cost) —
// keep it tighter than the AI rate limit.
router.use(createRateLimiter({ windowMs: 60_000, max: 10 }));

function isAlreadyExistsError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 6 || code === 'already-exists';
}

function productionLike(): boolean {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  return env === 'production' || env === 'prod' || env === 'staging';
}

/**
 * POST /api/notify/mail accepts ONLY a tenant-bound notification intent.
 * The authenticated caller cannot provide recipient, subject, text, or html.
 * Those fields are derived from authoritative GuardEntra state on the server.
 *
 * Queue success is not delivery success. The Trigger Email extension owns
 * delivery.* and provider/SMTP acceptance; inbox receipt remains separate proof.
 */
router.post('/mail', async (req, res) => {
  try {
    ensureAdmin();

    const decoded = (req as Request & { user?: { uid?: string } }).user;
    const uid = decoded?.uid || '';
    if (!uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const intent = parseNotificationIntentRequest(req.body);
    const db = getAdminDb();

    const read = async (collection: string, id: string): Promise<Record<string, unknown> | null> => {
      const snap = await db.collection(collection).doc(id).get();
      return snap.exists ? ({ id: snap.id, ...(snap.data() || {}) } as Record<string, unknown>) : null;
    };

    const store: NotificationAuthorityStore = {
      getUser: (id) => read('users', id),
      getVendor: (id) => read('vendors', id),
      getAssessment: (id) => read('assessments', id),
      getOrganization: (id) => read('organizations', id),
    };

    const publicAppUrl =
      intent.intentType === 'vendor_welcome'
        ? undefined
        : productionLike()
          ? process.env.PUBLIC_APP_URL
          : process.env.PUBLIC_APP_URL || 'http://localhost:8080';

    const resolved = await resolveNotificationIntent({
      uid,
      intent,
      store,
      publicAppUrl,
      productionLike: productionLike(),
    });

    const queueDoc = {
      ...buildMailQueueDocument({
        to: resolved.recipient,
        subject: resolved.subject,
        text: resolved.text,
      }),
      notification: {
        intentType: resolved.intentType,
        objectId: resolved.objectId,
        organizationId: resolved.organizationId,
      },
    };

    const ref = db.collection(MAIL_COLLECTION).doc(resolved.queueId);

    if (resolved.intentType === 'assessment_invite') {
      const assessmentRef = db.collection('assessments').doc(resolved.objectId);
      const result = await db.runTransaction(async (tx) => {
        const queueSnap = await tx.get(ref);
        const assessmentSnap = await tx.get(assessmentRef);
        if (!assessmentSnap.exists) {
          throw new NotificationIntentError(
            404,
            'assessment_missing',
            'Authoritative assessment no longer exists',
          );
        }

        const assessmentData = assessmentSnap.data() || {};
        if (assessmentData.organizationId !== resolved.organizationId) {
          throw new NotificationIntentError(
            404,
            'object_unavailable',
            'Notification object is unavailable',
          );
        }

        const currentStatus =
          typeof assessmentData.status === 'string' ? assessmentData.status : '';
        if (currentStatus !== 'Not Started' && currentStatus !== 'Sent') {
          throw new NotificationIntentError(
            409,
            'assessment_not_invitable',
            'Assessment is no longer eligible for an initial invite',
          );
        }

        const vendorId = String(assessmentData.vendorId || '').trim();
        if (!vendorId) {
          throw new NotificationIntentError(
            409,
            'assessment_vendor_missing',
            'Assessment vendor mapping is unavailable',
          );
        }
        const vendorRef = db.collection('vendors').doc(vendorId);
        const vendorSnap = await tx.get(vendorRef);
        if (!vendorSnap.exists || vendorSnap.data()?.organizationId !== resolved.organizationId) {
          throw new NotificationIntentError(
            409,
            'assessment_vendor_unavailable',
            'Assessment vendor mapping is unavailable',
          );
        }
        const currentRecipient = String(
          vendorSnap.data()?.primaryContactEmail || '',
        ).trim().toLowerCase();
        if (!currentRecipient || currentRecipient !== resolved.recipient.toLowerCase()) {
          throw new NotificationIntentError(
            409,
            'assessment_recipient_changed',
            'Assessment recipient changed; retry notification resolution',
          );
        }

        const existingSentAt =
          typeof assessmentData.sentAt === 'string' && assessmentData.sentAt.trim()
            ? assessmentData.sentAt
            : null;
        const sentAt = existingSentAt || new Date().toISOString();
        const eventId = materialAuditEventId([
          resolved.organizationId,
          'assessment.sent',
          resolved.objectId,
          String(assessmentData.createdAt || 'initial'),
        ]);
        const preparedAudit = await prepareMaterialAuditIntent(tx, db, {
          eventId,
          tenantId: resolved.organizationId,
          eventType: 'assessment.sent',
          actorId: uid,
          actorType: 'user',
          objectType: 'assessment',
          objectId: resolved.objectId,
          payload: {
            vendorId,
            queueId: resolved.queueId,
            queueAccepted: true,
          },
          createdAt: sentAt,
        });

        const deduplicated = queueSnap.exists;
        if (!deduplicated) {
          tx.create(ref, queueDoc);
        }

        if (currentStatus !== 'Sent' || !existingSentAt) {
          tx.set(
            assessmentRef,
            {
              status: 'Sent',
              sentAt,
              updatedAt: sentAt,
            },
            { merge: true },
          );
        }
        tx.set(
          vendorRef,
          {
            assessmentStatus: 'Sent',
            lastAssessmentAt: sentAt,
          },
          { merge: true },
        );
        commitPreparedMaterialAuditIntent(tx, preparedAudit);

        return { deduplicated };
      });

      return res.json({
        queued: true,
        id: ref.id,
        deduplicated: result.deduplicated,
      });
    }

    try {
      await ref.create(queueDoc);
      return res.json({ queued: true, id: ref.id, deduplicated: false });
    } catch (err) {
      if (isAlreadyExistsError(err)) {
        return res.json({ queued: true, id: ref.id, deduplicated: true });
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof NotificationIntentError) {
      console.warn('[notify] intent refused', err.code);
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('[notify] intent queue failed', 'internal_error');
    return res.status(502).json({ error: 'Could not queue notification' });
  }
});

export default router;
