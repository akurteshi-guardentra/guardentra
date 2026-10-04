import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { emitAuditIntent } from '../lib/audit/emitIntent.ts';
import { isAuditSpineEnabled } from '../lib/audit/pool.ts';
import { verifyTenantChain } from '../lib/audit/verify.ts';
import { exportTenantAudit } from '../lib/audit/export.ts';
import { parseAuditEmitBody } from '../lib/audit/emitValidation.ts';
import { AUDIT_RETENTION_YEARS } from '../lib/audit/retention.ts';
import { AuditAuthorizationError, authorizeAuditEmit, authorizeAuditTenantRead } from '../lib/audit/authorization.ts';
import { auditVerifyHttpStatus } from '../lib/audit/verify.ts';

const router = Router();
router.use(createRateLimiter({ windowMs: 60_000, max: 60 }));

function spineDisabled(res: import('express').Response) {
  return res.status(503).json({
    error: 'Audit spine disabled',
    hint: 'Set AUDIT_SPINE_ENABLED=true and AUDIT_DATABASE_URL (see docs/FASTTRACK_PHASE2.md)',
  });
}

router.post('/emit', async (req, res) => {
  if (!isAuditSpineEnabled()) return spineDisabled(res);
  try {
    const parsed = parseAuditEmitBody(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const user = (req as { user?: { uid?: string; portalAssessmentId?: unknown } }).user;
    const authorized = await authorizeAuditEmit(user, parsed.value);
    const result = await emitAuditIntent({
      ...parsed.value,
      tenantId: authorized.tenantId,
      actorId: authorized.actorId,
      actorType: authorized.actorType,
    });
    return res.json(result);
  } catch (err: any) {
    if (err instanceof AuditAuthorizationError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('[audit] emit failed', err);
    return res.status(400).json({ error: err?.message || 'Emit failed' });
  }
});

router.get('/verify', async (req, res) => {
  if (!isAuditSpineEnabled()) return spineDisabled(res);
  const tenantId = String(req.query.tenantId || '').trim();
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  try {
    const user = (req as { user?: { uid?: string; portalAssessmentId?: unknown } }).user;
    await authorizeAuditTenantRead(user, tenantId);
    const result = await verifyTenantChain(tenantId);
    return res
      .status(auditVerifyHttpStatus(result))
      .json({ ...result, retentionYears: AUDIT_RETENTION_YEARS });
  } catch (err: any) {
    if (err instanceof AuditAuthorizationError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('[audit] verify failed', err);
    return res.status(502).json({ error: err?.message || 'Verify failed' });
  }
});

router.get('/export', async (req, res) => {
  if (!isAuditSpineEnabled()) return spineDisabled(res);
  const tenantId = String(req.query.tenantId || '').trim();
  const format = String(req.query.format || 'json').toLowerCase() === 'csv' ? 'csv' : 'json';
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  try {
    const user = (req as { user?: { uid?: string; portalAssessmentId?: unknown } }).user;
    await authorizeAuditTenantRead(user, tenantId);
    const { body, contentType } = await exportTenantAudit(tenantId, format);
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-${tenantId}.${format === 'csv' ? 'csv' : 'json'}"`
    );
    return res.send(body);
  } catch (err: any) {
    if (err instanceof AuditAuthorizationError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('[audit] export failed', err);
    return res.status(502).json({ error: err?.message || 'Export failed' });
  }
});

export default router;
