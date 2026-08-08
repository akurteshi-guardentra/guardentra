import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { emitAuditIntent } from '../lib/audit/emitIntent.ts';
import { isAuditSpineEnabled } from '../lib/audit/pool.ts';
import { verifyTenantChain } from '../lib/audit/verify.ts';
import { exportTenantAudit } from '../lib/audit/export.ts';
import type { AuditEmitEnvelope } from '../lib/audit/types.ts';

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
    const body = (req.body || {}) as AuditEmitEnvelope;
    const user = (req as { user?: { uid?: string } }).user;
    const result = await emitAuditIntent({
      ...body,
      actorId: body.actorId || user?.uid || null,
      actorType: body.actorType || 'user',
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[audit] emit failed', err);
    return res.status(400).json({ error: err?.message || 'Emit failed' });
  }
});

router.get('/verify', async (req, res) => {
  if (!isAuditSpineEnabled()) return spineDisabled(res);
  const tenantId = String(req.query.tenantId || '').trim();
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  try {
    const result = await verifyTenantChain(tenantId);
    return res.json(result);
  } catch (err: any) {
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
    const { body, contentType } = await exportTenantAudit(tenantId, format);
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-${tenantId}.${format === 'csv' ? 'csv' : 'json'}"`
    );
    return res.send(body);
  } catch (err: any) {
    console.error('[audit] export failed', err);
    return res.status(502).json({ error: err?.message || 'Export failed' });
  }
});

export default router;
