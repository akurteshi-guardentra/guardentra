import { Router } from 'express';
import { ensureAdmin } from '../middleware/requireFirebaseAuth';
import { getAdminDb } from '../lib/adminDb';
import { createRateLimiter } from '../middleware/rateLimit';
import { buildMailQueueDocument, MAIL_COLLECTION, validateMailInput } from '../lib/mailQueue';

const router = Router();

// Queuing emails is abuse-prone (spam any address, run up email-provider cost) —
// keep it tighter than the AI rate limit.
router.use(createRateLimiter({ windowMs: 60_000, max: 10 }));

/**
 * Queues an email via the Firebase "Trigger Email from Firestore" extension —
 * writes a doc to the `mail` collection in the shape that extension expects
 * (https://extensions.dev/extensions/firebase/firestore-send-email). Written
 * with the Admin SDK (bypasses Firestore rules entirely — the client-side
 * `mail` collection rule denies all direct access, see firestore.rules), so
 * this route is the only path that can queue an email.
 *
 * This route only proves queue write success — not delivery.
 * Delivery is performed by the exclusively selected consumer: #72 extension +
 * SMTP, or the separately activated #80 worker. See docs/SELF_MANAGED_EMAIL.md.
 */
router.post('/mail', async (req, res) => {
  const invalid = validateMailInput(req.body);
  if (invalid) return res.status(invalid.status).json({ error: invalid.error });
  const { to, subject, text, html } = req.body;

  try {
    ensureAdmin();
    const db = getAdminDb();
    const doc = buildMailQueueDocument({
      to,
      subject,
      text,
      ...(typeof html === 'string' ? { html } : {}),
    });
    const ref = await db.collection(MAIL_COLLECTION).add(doc);
    return res.json({ queued: true, id: ref.id });
  } catch {
    console.error('[notify] QUEUE_WRITE_FAILED');
    return res.status(502).json({ error: 'Could not queue email' });
  }
});

export default router;
