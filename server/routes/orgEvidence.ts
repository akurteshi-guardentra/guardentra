import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import {
  handleArchiveEmptyAssessment,
  handleEvidenceDownload,
  handleOrgAttachmentDownload,
  handleOrgDecision,
  liveEvidenceDeps,
} from '../lib/evidenceAccess.ts';

const router = Router();
const deps = liveEvidenceDeps();
const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });

router.get('/evidence-download', limiter, (req, res) =>
  handleEvidenceDownload(req, res, deps, 'org')
);

router.get('/attachment-download', limiter, (req, res) =>
  handleOrgAttachmentDownload(req, res, deps)
);

router.post('/assessment-decision', limiter, (req, res) => handleOrgDecision(req, res, deps));

router.post('/archive-empty-assessment', limiter, (req, res) =>
  handleArchiveEmptyAssessment(req, res, deps)
);

export default router;
