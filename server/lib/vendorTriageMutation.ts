import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Request, Response } from 'express';
import { ensureAdmin } from '../middleware/requireFirebaseAuth.ts';
import { getAdminDb } from './adminDb.ts';
import {
  commitPreparedMaterialAuditIntent,
  materialAuditEventId,
  prepareMaterialAuditIntent,
} from './audit/materialIntent.ts';
import {
  isTriageComplete,
  nextReviewAtFromCadence,
  recommendFromTriage,
  type AccessLevel,
  type BusinessCriticality,
  type DataExposure,
  type RequirementSignal,
  type ReviewCadence,
  type TriageAnswers,
} from '../../src/lib/vendor/fastTrackTriage.ts';

const DATA_EXPOSURE = new Set<DataExposure>([
  'public',
  'internal',
  'personal',
  'payment',
  'health',
  'credentials',
]);
const ACCESS_LEVEL = new Set<AccessLevel>(['none', 'user', 'privileged', 'production']);
const BUSINESS_CRITICALITY = new Set<BusinessCriticality>([
  'low',
  'medium',
  'high',
  'critical',
]);
const REQUIREMENTS = new Set<RequirementSignal>([
  'none',
  'soc2_customers',
  'iso_buyers',
  'hipaa',
  'pci',
  'gov',
]);
const REVIEW_CADENCE = new Set<ReviewCadence>([
  'annual',
  'semi_annual',
  'quarterly',
  'continuous',
]);

export class VendorTriageMutationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VendorTriageMutationError';
  }
}

function bearer(req: Request): string {
  const value = req.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function normalizeList<T extends string>(
  value: unknown,
  allowed: Set<T>,
  label: string,
): T[] {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string')) {
    throw new VendorTriageMutationError(400, 'invalid_triage', `${label} is required.`);
  }
  const normalized = [...new Set(value.map((item) => String(item).trim() as T))].sort();
  if (normalized.some((item) => !allowed.has(item))) {
    throw new VendorTriageMutationError(400, 'invalid_triage', `${label} contains an invalid value.`);
  }
  return normalized;
}

function normalizeScalar<T extends string>(
  value: unknown,
  allowed: Set<T>,
  label: string,
): T {
  const normalized = String(value || '').trim() as T;
  if (!allowed.has(normalized)) {
    throw new VendorTriageMutationError(400, 'invalid_triage', `${label} is invalid.`);
  }
  return normalized;
}

export function parseTriageAnswers(raw: unknown): TriageAnswers {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const answers: TriageAnswers = {
    dataExposure: normalizeList(body.dataExposure, DATA_EXPOSURE, 'dataExposure'),
    accessLevel: normalizeScalar(body.accessLevel, ACCESS_LEVEL, 'accessLevel'),
    businessCriticality: normalizeScalar(
      body.businessCriticality,
      BUSINESS_CRITICALITY,
      'businessCriticality',
    ),
    requirements: normalizeList(body.requirements, REQUIREMENTS, 'requirements'),
    reviewCadence: normalizeScalar(body.reviewCadence, REVIEW_CADENCE, 'reviewCadence'),
  };
  if (!isTriageComplete(answers)) {
    throw new VendorTriageMutationError(400, 'incomplete_triage', 'Complete all FastTrack signals.');
  }
  return answers;
}

export function triageFingerprint(answers: TriageAnswers): string {
  return JSON.stringify({
    dataExposure: [...answers.dataExposure].sort(),
    accessLevel: answers.accessLevel,
    businessCriticality: answers.businessCriticality,
    requirements: [...answers.requirements].sort(),
    reviewCadence: answers.reviewCadence,
  });
}

export async function saveVendorTriageWithDurableAudit(input: {
  db: Firestore;
  organizationId: string;
  actorId: string;
  vendorId: string;
  answers: TriageAnswers;
  now?: Date;
}) {
  const { db, organizationId, actorId, vendorId, answers } = input;
  const recommendation = recommendFromTriage(answers);
  if (!recommendation) {
    throw new VendorTriageMutationError(400, 'incomplete_triage', 'Complete all FastTrack signals.');
  }

  const now = input.now || new Date();
  const completedAt = now.toISOString();
  const nextReviewAt = nextReviewAtFromCadence(answers.reviewCadence, now);
  const fingerprint = triageFingerprint(answers);
  const eventId = materialAuditEventId([
    organizationId,
    'triage.completed',
    vendorId,
    fingerprint,
  ]);

  const userRef = db.collection('users').doc(actorId);
  const vendorRef = db.collection('vendors').doc(vendorId);
  const triageRef = db.collection('vendor_triage').doc(vendorId);

  return db.runTransaction(async (tx) => {
    const [userSnap, vendorSnap, triageSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(vendorRef),
      tx.get(triageRef),
    ]);

    if (
      !userSnap.exists ||
      String(userSnap.data()?.organizationId || '') !== organizationId
    ) {
      throw new VendorTriageMutationError(
        403,
        'membership_changed',
        'Organization membership changed; retry.',
      );
    }
    if (!vendorSnap.exists) {
      throw new VendorTriageMutationError(404, 'vendor_missing', 'Vendor not found.');
    }
    if (String(vendorSnap.data()?.organizationId || '') !== organizationId) {
      throw new VendorTriageMutationError(
        403,
        'cross_tenant_vendor',
        'Cross-tenant vendor access denied.',
      );
    }

    const existing = triageSnap.exists ? triageSnap.data() || {} : {};
    if (String(existing.auditEventId || '') === eventId) {
      return {
        deduplicated: true,
        completedAt: String(existing.completedAt || completedAt),
        nextReviewAt:
          typeof existing.nextReviewAt === 'string' ? existing.nextReviewAt : nextReviewAt,
        recommendation,
      };
    }

    const preparedAudit = await prepareMaterialAuditIntent(tx, db, {
      eventId,
      tenantId: organizationId,
      eventType: 'triage.completed',
      actorId,
      actorType: 'user',
      objectType: 'vendor',
      objectId: vendorId,
      createdAt: completedAt,
      payload: {
        tier: recommendation.tier,
        frameworks: recommendation.frameworks,
        rationale: recommendation.rationale,
        reviewCadence: answers.reviewCadence,
        dataExposure: answers.dataExposure,
        accessLevel: answers.accessLevel,
        businessCriticality: answers.businessCriticality,
        requirements: answers.requirements,
      },
    });

    tx.set(
      triageRef,
      {
        organizationId,
        vendorId,
        answers,
        tier: recommendation.tier,
        frameworks: recommendation.frameworks,
        rationale: recommendation.rationale,
        questionTarget: recommendation.questionTarget,
        vendorTimeTarget: recommendation.vendorTimeTarget,
        reviewCadence: answers.reviewCadence,
        completedAt,
        completedBy: actorId,
        updatedAt: completedAt,
        nextReviewAt,
        auditEventId: eventId,
      },
      { merge: true },
    );

    if (nextReviewAt) {
      tx.set(vendorRef, { nextReviewAt }, { merge: true });
    }
    commitPreparedMaterialAuditIntent(tx, preparedAudit);

    return {
      deduplicated: preparedAudit.exists,
      completedAt,
      nextReviewAt,
      recommendation,
    };
  });
}

export type VendorTriageMutationDeps = {
  db?: Firestore;
  verifyIdToken?: (token: string) => Promise<DecodedIdToken>;
  now?: () => Date;
};

export async function handleOrgVendorTriage(
  req: Request,
  res: Response,
  deps: VendorTriageMutationDeps = {},
): Promise<void> {
  try {
    const token = bearer(req);
    if (!token) {
      throw new VendorTriageMutationError(401, 'authentication_required', 'Authentication required.');
    }

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
      throw new VendorTriageMutationError(401, 'invalid_token', 'Invalid or expired token.');
    }
    if (!decoded.uid || decoded.portalAssessmentId) {
      throw new VendorTriageMutationError(403, 'org_session_required', 'Organization session required.');
    }

    const vendorId = String(req.body?.vendorId || '').trim();
    if (!vendorId || vendorId.length > 128 || /[/\.\s]/.test(vendorId)) {
      throw new VendorTriageMutationError(400, 'invalid_vendor', 'A valid vendorId is required.');
    }
    const answers = parseTriageAnswers(req.body?.answers);

    const db =
      deps.db ||
      (() => {
        ensureAdmin();
        return getAdminDb();
      })();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) {
      throw new VendorTriageMutationError(403, 'membership_required', 'Organization membership required.');
    }
    const user = userSnap.data() || {};
    const organizationId = String(user.organizationId || '').trim();
    const role = String(user.role || 'member');
    if (!organizationId || !['admin', 'owner', 'member'].includes(role)) {
      throw new VendorTriageMutationError(403, 'membership_required', 'Organization membership required.');
    }

    const result = await saveVendorTriageWithDurableAudit({
      db,
      organizationId,
      actorId: decoded.uid,
      vendorId,
      answers,
      now: deps.now?.(),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof VendorTriageMutationError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    console.error('[vendor-triage] failed', err);
    res.status(500).json({ error: 'Could not save FastTrack triage.' });
  }
}
