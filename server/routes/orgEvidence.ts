import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import {
  handleEvidenceDownload,
  handleOrgDecision,
  liveEvidenceDeps,
} from '../lib/evidenceAccess.ts';

const router = Router();
const deps = liveEvidenceDeps();
const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

router.get('/evidence-download', limiter, (req, res) =>
  handleEvidenceDownload(req, res, deps, 'org')
);

router.post('/assessment-decision', limiter, (req, res) => handleOrgDecision(req, res, deps));

export default router;
