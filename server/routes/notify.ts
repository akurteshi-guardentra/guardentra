import { Router } from 'express';
import { ensureAdmin } from '../middleware/requireFirebaseAuth';
import { getAdminDb } from '../lib/adminDb';
import { createRateLimiter } from '../middleware/rateLimit';
import { buildMailQueueDocument, MAIL_COLLECTION } from '../lib/mailQueue';

const router = Router();

// Queuing emails is abuse-prone (spam any address, run up email-provider cost) —
// keep it tighter than the AI rate limit.
router.use(createRateLimiter({ windowMs: 60_000, max: 10 }));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_LENGTH = 5000;

/**
 * Queues an email via the Firebase "Trigger Email from Firestore" extension —
 * writes a doc to the `mail` collection in the shape that extension expects
 * (https://extensions.dev/extensions/firebase/firestore-send-email). Written
 * with the Admin SDK (bypasses Firestore rules entirely — the client-side
 * `mail` collection rule denies all direct access, see firestore.rules), so
 * this route is the only path that can queue an email.
 *
 * This route only proves queue write success — not delivery.
 * Delivery is performed by the extension + SMTP (SendGrid for staging).
 * See docs/STAGING_EMAIL_DELIVERY.md.
 */
router.post('/mail', async (req, res) => {
  const { to, subject, text, html } = req.body || {};

  if (typeof to !== 'string' || !EMAIL_RE.test(to)) {
    return res.status(400).json({ error: 'A valid "to" email address is required' });
  }
  if (typeof subject !== 'string' || !subject.trim()) {
    return res.status(400).json({ error: 'subject is required' });
  }
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (subject.length > 300 || text.length > MAX_TEXT_LENGTH || (html && html.length > MAX_TEXT_LENGTH * 2)) {
    return res.status(413).json({ error: 'subject/text exceeds allowed length' });
  }

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
  } catch (err) {
    console.error('[notify] failed to queue email', err);
    return res.status(502).json({ error: 'Could not queue email' });
  }
});

export default router;
