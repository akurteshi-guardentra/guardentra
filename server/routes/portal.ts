import { Router } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { ensureAdmin } from '../middleware/requireFirebaseAuth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { getAdminDb } from '../lib/adminDb.ts';
import { classifyEvidenceScan } from '../../src/lib/vendor/evidenceTrust.ts';

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

    const data = snap.data() || {};
    const status = String(data.status || '');
    const open = data.portalOpen === true;
    const submitted =
      status === 'Under Review' ||
      status === 'Completed' ||
      Boolean(data.completedAt);
    // Allow session for in-progress portals and for post-submit receipt views.
    if (!open && !submitted) {
      res.status(403).json({ error: 'This assessment is no longer available.' });
      return;
    }

    // Deterministic uid so a vendor returning to the same link keeps one identity
    // (autosave, evidence ownership) instead of accumulating orphaned anonymous users.
    const token = await getAuth().createCustomToken(`portal_${assessmentId}`, {
      portalAssessmentId: assessmentId,
    });

    // Branding for SaaS multi-tenant portal chrome (stamped on assessment; org fallback).
    let requesterOrgName = typeof data.requesterOrgName === 'string' ? data.requesterOrgName : '';
    let requesterLogoUrl = typeof data.requesterLogoUrl === 'string' ? data.requesterLogoUrl : '';
    if ((!requesterOrgName || !requesterLogoUrl) && data.organizationId) {
      try {
        const orgSnap = await getAdminDb().collection('organizations').doc(String(data.organizationId)).get();
        if (orgSnap.exists) {
          const org = orgSnap.data() || {};
          if (!requesterOrgName && typeof org.name === 'string') requesterOrgName = org.name;
          if (!requesterLogoUrl && typeof org.logoUrl === 'string') requesterLogoUrl = org.logoUrl;
        }
      } catch {
        /* branding is best-effort */
      }
    }

    res.json({
      token,
      branding: {
        requesterOrgName: requesterOrgName || 'Requesting organization',
        requesterLogoUrl: requesterLogoUrl || null,
        vendorName: typeof data.vendorName === 'string' ? data.vendorName : null,
        status,
        portalOpen: open,
        submitted,
        completedAt: data.completedAt || null,
        decisionOutcome: data.decisionOutcome || null,
      },
    });
  } catch (err) {
    // createCustomToken needs credentials that can sign JWTs — a service account key,
    // or ADC plus the "Service Account Token Creator" role. On Cloud Run / App Hosting
    // the default service account has this; a bare local dev shell without ADC does not.
    console.error('[portal] Failed to mint portal session token', err);
    res.status(500).json({ error: 'Could not start the portal session.' });
  }
});

const evidenceScanLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

router.post('/evidence-scan', evidenceScanLimiter, async (req, res) => {
  const assessmentId = String(req.body?.assessmentId || '').trim();
  const storagePath = String(req.body?.storagePath || '').trim();
  const contentType = String(req.body?.contentType || '');
  const sizeBytes = Number(req.body?.sizeBytes);
  const fileName = String(req.body?.fileName || '');
  const prefix = `portal/${assessmentId}/`;

  if (!assessmentId || assessmentId.length > 128 || /[/.\s]/.test(assessmentId)) {
    res.status(400).json({ error: 'A valid assessmentId is required.' });
    return;
  }
  if (!storagePath.startsWith(prefix) || storagePath.includes('..')) {
    res.status(400).json({ error: 'storagePath must belong to this assessment.' });
    return;
  }

  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const appEnv = (process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
  const productionLike = appEnv === 'production' || appEnv === 'prod' || appEnv === 'staging';

  try {
    ensureAdmin();
    if (token) {
      const decoded = await getAuth().verifyIdToken(token);
      if (decoded.portalAssessmentId && decoded.portalAssessmentId !== assessmentId) {
        res.status(403).json({ error: 'Portal session does not match this assessment.' });
        return;
      }
    } else if (productionLike) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const scanStatus = classifyEvidenceScan({ contentType, sizeBytes, fileName });
    const snap = await getAdminDb().collection('assessments').doc(assessmentId).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Assessment not found.' });
      return;
    }
    const data = snap.data() || {};
    const existing =
      data.evidenceScanByStoragePath && typeof data.evidenceScanByStoragePath === 'object'
        ? data.evidenceScanByStoragePath
        : {};
    await getAdminDb()
      .collection('assessments')
      .doc(assessmentId)
      .update({
        evidenceScanByStoragePath: { ...existing, [storagePath]: scanStatus },
      });
    res.json({ scanStatus, storagePath });
  } catch (err) {
    console.error('[portal] evidence-scan failed', err);
    res.status(500).json({ error: 'Could not scan evidence.' });
  }
});

export default router;
