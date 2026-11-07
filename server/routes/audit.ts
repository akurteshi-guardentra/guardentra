import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { emitAuditIntent } from '../lib/audit/emitIntent.ts';
import { isAuditSpineEnabled } from '../lib/audit/pool.ts';
import { verifyTenantChain } from '../lib/audit/verify.ts';
import { exportTenantAudit } from '../lib/audit/export.ts';
import { parseAuditEmitBatchBody, parseAuditEmitBody } from '../lib/audit/emitValidation.ts';
import { AUDIT_RETENTION_YEARS } from '../lib/audit/retention.ts';
import {
  AuditAuthorizationError,
  authorizeAuditEmit,
  authorizeAuditEmitBatch,
  authorizeAuditTenantRead,
} from '../lib/audit/authorization.ts';
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

/**
 * #124 F10 — batched emit. The request counts once against the router's
 * rate limit. All events are validated and authorized (same rules as /emit)
 * before any is written; then each is queued in order through the same
 * idempotent `emitAuditIntent` path. A per-event failure is reported in
 * `results` and turns the response into a 502 so the client logs it.
 */
router.post('/emit-batch', async (req, res) => {
  if (!isAuditSpineEnabled()) return spineDisabled(res);
  const parsed = parseAuditEmitBatchBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const user = (req as { user?: { uid?: string; portalAssessmentId?: unknown } }).user;
  let actors;
  try {
    actors = await authorizeAuditEmitBatch(user, parsed.value);
  } catch (err: any) {
    if (err instanceof AuditAuthorizationError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error('[audit] emit-batch authorization failed', err);
    return res.status(400).json({ error: err?.message || 'Emit failed' });
  }
  const results: Array<Record<string, unknown>> = [];
  let failed = 0;
  for (let i = 0; i < parsed.value.length; i += 1) {
    const event = parsed.value[i];
    try {
      const result = await emitAuditIntent({
        ...event,
        tenantId: actors[i].tenantId,
        actorId: actors[i].actorId,
        actorType: actors[i].actorType,
      });
      results.push({ index: i, ...result });
    } catch (err: any) {
      failed += 1;
      console.error('[audit] emit-batch event failed', event.eventType, err?.message || err);
      results.push({ index: i, error: err?.message || 'Emit failed' });
    }
  }
  return res.status(failed ? 502 : 200).json({ results, failed });
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
