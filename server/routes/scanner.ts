import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { verifyEvidenceScanTaskOidc } from '../lib/malwareScanner/taskAuth.ts';
import {
  cloudTasksAckStatus,
  liveScannerDeps,
  scanPortalEvidenceObject,
} from '../lib/malwareScanner/scanObject.ts';
import {
  MIN_EVIDENCE_SCANNER_SECRET_LENGTH,
  parsePortalEvidencePath,
} from '../lib/malwareScanner/types.ts';

const router = Router();

const scannerLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 120,
  errorMessage: 'Too many scanner requests.',
});

function timingSafeEqualString(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function requireScannerAuth(req: { headers: Record<string, unknown> }): boolean {
  const expected = String(process.env.EVIDENCE_SCANNER_SECRET || '').trim();
  if (!expected || expected.length < MIN_EVIDENCE_SCANNER_SECRET_LENGTH) return false;
  const header = String(req.headers['x-evidence-scanner-secret'] || '').trim();
  const bearer = String(req.headers.authorization || '');
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : header;
  return timingSafeEqualString(token, expected);
}

/**
 * Internal authoritative scan endpoint (manual / diagnostic / Eventarc proxy).
 *
 * Auth: shared secret (EVIDENCE_SCANNER_SECRET).
 * Body (preferred): { assessmentId, storagePath, generation? }
 * Also accepts GCS Pub/Sub push envelopes.
 */
router.post('/evidence-scan', scannerLimiter, async (req, res) => {
  try {
    if (!requireScannerAuth(req)) {
      res.status(401).json({ error: 'Scanner authentication required' });
      return;
    }

    let assessmentId = String(req.body?.assessmentId || '').trim();
    let storagePath = String(req.body?.storagePath || '').trim();
    let generation =
      req.body?.generation != null ? String(req.body.generation) : undefined;
    const organizationId =
      req.body?.organizationId != null
        ? String(req.body.organizationId).trim()
        : undefined;

    // GCS Pub/Sub / Eventarc push (object finalize). Finalize can race ahead of
    // metadata validate; scanPortalEvidenceObject refuses every terminal verdict
    // unless matching scan_pending already exists for this generation, and does
    // not invoke the malware engine on that premature path.
    if ((!assessmentId || !storagePath) && req.body?.message?.data) {
      try {
        const raw = Buffer.from(String(req.body.message.data), 'base64').toString('utf8');
        const payload = JSON.parse(raw) as { name?: string; generation?: string };
        const objectName = String(payload.name || '').replace(/^\/+/, '');
        const parsed = parsePortalEvidencePath(objectName);
        if (parsed) {
          storagePath = objectName;
          assessmentId = parsed.assessmentId;
          if (payload.generation != null) generation = String(payload.generation);
        }
      } catch {
        /* fall through to validation error */
      }
    }

    if (!assessmentId || !storagePath) {
      res.status(400).json({ error: 'assessmentId and storagePath are required' });
      return;
    }

    const result = await scanPortalEvidenceObject(
      { assessmentId, storagePath, generation, organizationId },
      liveScannerDeps(),
    );
    if (!result.ok) {
      const status =
        result.reason === 'assessment_not_found'
          ? 404
            : result.reason === 'malformed_storage_path' ||
              result.reason === 'cross_assessment_path' ||
              result.reason === 'cross_tenant' ||
              result.reason === 'invalid_portal_path'
            ? 400
            : 409;
      res.status(status).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    console.error('[evidence-scanner] route error', err);
    res.status(500).json({ error: 'Evidence scan failed' });
  }
});

/**
 * Durable Cloud Tasks worker.
 *
 * Auth: Google-signed OIDC only (audience + task service account).
 * Does NOT accept EVIDENCE_SCANNER_SECRET.
 * Invokes the same scanPortalEvidenceObject() trust path.
 */
router.post('/evidence-scan-task', scannerLimiter, async (req, res) => {
  try {
    const oidc = await verifyEvidenceScanTaskOidc(req);
    if (!oidc.ok) {
      const status =
        oidc.reason === 'missing_token' || oidc.reason === 'invalid_token'
          ? 401
          : 403;
      res.status(status).json({ error: 'Task authentication required', reason: oidc.reason });
      return;
    }

    const assessmentId = String(req.body?.assessmentId || '').trim();
    const storagePath = String(req.body?.storagePath || '').trim();
    const generation =
      req.body?.generation != null ? String(req.body.generation).trim() : '';
    const organizationId =
      req.body?.organizationId != null
        ? String(req.body.organizationId).trim()
        : undefined;

    if (!assessmentId || !storagePath || !generation) {
      // Malformed durable payload — ACK so Cloud Tasks does not infinite-retry.
      res.status(200).json({
        ok: false,
        reason: 'malformed_task_payload',
        assessmentId,
        storagePath,
      });
      return;
    }

    const result = await scanPortalEvidenceObject(
      { assessmentId, storagePath, generation, organizationId },
      liveScannerDeps(),
    );
    const status = cloudTasksAckStatus(result);
    res.status(status).json(result);
  } catch (err) {
    console.error('[evidence-scanner] task worker error', err);
    // Transient unexpected failure before durable terminal — NACK for retry.
    res.status(500).json({ error: 'Evidence scan task failed' });
  }
});

export default router;
