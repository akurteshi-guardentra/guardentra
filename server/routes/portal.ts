import { Router } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { ensureAdmin } from '../middleware/requireFirebaseAuth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { getAdminDb } from '../lib/adminDb.ts';

const router = Router();

/**
 * Mints the scoped session a vendor portal link runs under.
 *
 * Why this exists (docs/KNOWN_ISSUES.md #17): the portal used to call
 * signInAnonymously(), producing a session with no notion of *which* assessment it
 * was for. The rules could therefore only ask "is this assessment open?", never
 * "is this assessment yours?" — so any vendor holding one valid portal link could
 * read and write the evidence of every other in-flight assessment, across all orgs.
 * That was confirmed live, not theoretical.
 *
 * The custom token carries a `portalAssessmentId` claim, and firestore.rules /
 * storage.rules compare it against the assessment id in the path. Possessing link A
 * now grants access to A and nothing else.
 *
 * Deliberately unauthenticated: this *is* the portal's front door, and the trust
 * model is unchanged — access still equals link possession, exactly as before and as
 * ARCHITECTURE_FOUNDATION.md documents. What changes is the blast radius of one link.
 * The endpoint only ever mints a token for an assessment that already exists and is
 * still open, so it grants nothing the caller couldn't already reach.
 */

// Tighter than the AI limiter: a real vendor needs a handful of these per visit
// (one per page load), never dozens. Keyed by IP since there's no uid yet.
const portalSessionLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

router.post('/session', portalSessionLimiter, async (req, res) => {
  const assessmentId = String(req.body?.assessmentId || '').trim();

  // Firestore ids are opaque, but reject anything that couldn't be one before
  // spending an admin read on it — also keeps path traversal out of the claim.
  if (!assessmentId || assessmentId.length > 128 || /[/.\s]/.test(assessmentId)) {
    res.status(400).json({ error: 'A valid assessmentId is required.' });
    return;
  }

  try {
    ensureAdmin();
    const snap = await getAdminDb().collection('assessments').doc(assessmentId).get();

    if (!snap.exists) {
      // Same response as a closed portal — don't confirm which assessment ids exist.
      res.status(404).json({ error: 'This assessment link is not available.' });
      return;
    }

    if (snap.data()?.portalOpen !== true) {
      res.status(403).json({ error: 'This assessment is no longer accepting responses.' });
      return;
    }

    // Deterministic uid so a vendor returning to the same link keeps one identity
    // (autosave, evidence ownership) instead of accumulating orphaned anonymous users.
    const token = await getAuth().createCustomToken(`portal_${assessmentId}`, {
      portalAssessmentId: assessmentId,
    });

    res.json({ token });
  } catch (err) {
    // createCustomToken needs credentials that can sign JWTs — a service account key,
    // or ADC plus the "Service Account Token Creator" role. On Cloud Run / App Hosting
    // the default service account has this; a bare local dev shell without ADC does not.
    console.error('[portal] Failed to mint portal session token', err);
    res.status(500).json({ error: 'Could not start the portal session.' });
  }
});

export default router;
