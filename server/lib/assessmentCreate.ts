import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Request, Response } from 'express';
import { ensureAdmin } from '../middleware/requireFirebaseAuth.ts';
import { getAdminDb } from './adminDb.ts';
import {
  commitPreparedMaterialAuditIntent,
  materialAuditEventId,
  prepareMaterialAuditIntent,
} from './audit/materialIntent.ts';
import { buildCreateAssessmentFields } from '../../src/lib/vendor/assessmentLifecycle.ts';
import type { FrameworkId } from '../../src/lib/vendor/types.ts';
import type { PortalQuestion } from '../../src/lib/vendor/questionBank.ts';

export type AssessmentCreateDeps = {
  db?: Firestore;
  verifyIdToken?: (token: string) => Promise<DecodedIdToken>;
  now?: () => Date;
};

class AssessmentCreateError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AssessmentCreateError';
  }
}

function bearer(req: Request): string {
  const value = req.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new AssessmentCreateError(400, `${label} must be a string array`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function questions(value: unknown): PortalQuestion[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) {
    throw new AssessmentCreateError(400, 'questions must contain 1-500 items');
  }
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as { id?: unknown }).id !== 'string' ||
      typeof (item as { question?: unknown }).question !== 'string'
    ) {
      throw new AssessmentCreateError(400, 'questions contain an invalid item');
    }
  }
  return value as PortalQuestion[];
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function requestAssessmentId(
  organizationId: string,
  vendorId: string,
  requestId: string,
): string {
  const digest = materialAuditEventId([
    organizationId,
    'assessment.create.request',
    vendorId,
    requestId,
  ]).slice(4, 36);
  return `asm_${digest}`;
}

function sendError(res: Response, err: unknown): void {
  if (err instanceof AssessmentCreateError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[assessment-create] failed', err);
  res.status(500).json({ error: 'Could not create assessment.' });
}

export async function handleAssessmentCreate(
  req: Request,
  res: Response,
  deps: AssessmentCreateDeps = {},
): Promise<void> {
  try {
    const token = bearer(req);
    if (!token) throw new AssessmentCreateError(401, 'Authentication required.');

    const verify =
      deps.verifyIdToken ||
      (async (raw: string) => {
        ensureAdmin();
        return getAuth().verifyIdToken(raw);
      });

    let decoded: DecodedIdToken;
    try {
      decoded = await verify(token);
    } catch {
      throw new AssessmentCreateError(401, 'Invalid or expired session.');
    }
    if (!decoded.uid || decoded.portalAssessmentId) {
      throw new AssessmentCreateError(403, 'Organization session required.');
    }

    const vendorId = String(req.body?.vendorId || '').trim();
    const requestId = String(req.body?.requestId || '').trim();
    if (!vendorId || vendorId.length > 128 || /[/\.\s]/.test(vendorId)) {
      throw new AssessmentCreateError(400, 'A valid vendorId is required.');
    }
    if (
      !requestId ||
      requestId.length < 8 ||
      requestId.length > 128 ||
      !/^[A-Za-z0-9._:-]+$/.test(requestId)
    ) {
      throw new AssessmentCreateError(400, 'A valid idempotency requestId is required.');
    }

    const frameworks = stringArray(req.body?.frameworks, 'frameworks') as FrameworkId[];
    if (!frameworks.length || frameworks.length > 20) {
      throw new AssessmentCreateError(400, 'At least one framework is required.');
    }
    const frameworkPackIds =
      req.body?.frameworkPackIds == null
        ? undefined
        : stringArray(req.body.frameworkPackIds, 'frameworkPackIds');
    const snapshotQuestions = questions(req.body?.questions);
    const dueAt = String(req.body?.dueAt || '').trim();
    const dueMs = Date.parse(dueAt);
    if (!dueAt || Number.isNaN(dueMs)) {
      throw new AssessmentCreateError(400, 'A valid dueAt is required.');
    }

    const sourceQuestionCount = Number(req.body?.sourceQuestionCount);
    const reminderSchedule =
      req.body?.reminderSchedule &&
      typeof req.body.reminderSchedule === 'object' &&
      !Array.isArray(req.body.reminderSchedule)
        ? (req.body.reminderSchedule as Record<string, unknown>)
        : undefined;

    const db = deps.db || (() => {
      ensureAdmin();
      return getAdminDb();
    })();
    const now = deps.now || (() => new Date());

    const userRef = db.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new AssessmentCreateError(403, 'Organization membership required.');
    }
    const userData = userSnap.data() || {};
    const organizationId = String(userData.organizationId || '').trim();
    const role = String(userData.role || 'member');
    if (!organizationId || !['admin', 'owner', 'member'].includes(role)) {
      throw new AssessmentCreateError(403, 'Organization membership required.');
    }

    const assessmentId = requestAssessmentId(organizationId, vendorId, requestId);
    const assessmentRef = db.collection('assessments').doc(assessmentId);

    const result = await db.runTransaction(async (tx) => {
      const vendorRef = db.collection('vendors').doc(vendorId);
      const orgRef = db.collection('organizations').doc(organizationId);

      const [assessmentSnap, vendorSnap, orgSnap] = await Promise.all([
        tx.get(assessmentRef),
        tx.get(vendorRef),
        tx.get(orgRef),
      ]);

      if (assessmentSnap.exists) {
        const existing = assessmentSnap.data() || {};
        if (
          String(existing.organizationId || '') !== organizationId ||
          String(existing.vendorId || '') !== vendorId
        ) {
          throw new AssessmentCreateError(409, 'Assessment idempotency key conflict.');
        }
        return {
          assessmentId,
          deduplicated: true,
          status: String(existing.status || 'Not Started'),
        };
      }

      if (!vendorSnap.exists) {
        throw new AssessmentCreateError(404, 'Vendor not found.');
      }
      const vendor = vendorSnap.data() || {};
      if (String(vendor.organizationId || '') !== organizationId) {
        throw new AssessmentCreateError(403, 'Cross-tenant vendor access denied.');
      }
      if (!orgSnap.exists) {
        throw new AssessmentCreateError(409, 'Organization not found.');
      }
      const org = orgSnap.data() || {};
      const at = now().toISOString();

      const fields = buildCreateAssessmentFields({
        vendorId,
        vendorName: String(vendor.name || 'Vendor'),
        organizationId,
        frameworks,
        frameworkPackIds,
        frameworkName: optionalString(req.body?.frameworkName),
        questions: snapshotQuestions,
        sourceQuestionCount: Number.isFinite(sourceQuestionCount)
          ? sourceQuestionCount
          : undefined,
        dueAt,
        nowIso: at,
        triageTier: optionalString(req.body?.triageTier) || null,
        reviewCadence: optionalString(req.body?.reviewCadence) || null,
        reminderScheduleId: optionalString(req.body?.reminderScheduleId) || null,
        reminderSchedule: reminderSchedule || null,
        inviteEmail: optionalString(vendor.primaryContactEmail) || null,
        requesterOrgName: optionalString(org.name) || null,
        requesterLogoUrl: optionalString(org.logoUrl) || null,
      });

      const eventId = materialAuditEventId([
        organizationId,
        'assessment.created',
        assessmentId,
      ]);
      const preparedAudit = await prepareMaterialAuditIntent(tx, db, {
        eventId,
        tenantId: organizationId,
        eventType: 'assessment.created',
        actorId: decoded.uid,
        actorType: 'user',
        objectType: 'assessment',
        objectId: assessmentId,
        payload: {
          vendorId,
          frameworks,
          triageTier: fields.triageTier || null,
          questionCount: fields.questionCount,
        },
        createdAt: at,
      });

      tx.create(assessmentRef, fields);
      tx.update(vendorRef, {
        assessmentStatus: 'Not Started',
        lastAssessmentAt: at,
      });
      commitPreparedMaterialAuditIntent(tx, preparedAudit);

      return {
        assessmentId,
        deduplicated: preparedAudit.exists,
        status: fields.status,
      };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    sendError(res, err);
  }
}
