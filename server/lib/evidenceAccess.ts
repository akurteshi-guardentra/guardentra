import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { ensureAdmin } from '../middleware/requireFirebaseAuth.ts';
import { getAdminDb } from './adminDb.ts';
import {
  classifyStorageMetadata,
  encodeTrustMapKey,
  isPortalEvidencePath,
  lookupTrustRecord,
  mergeTrustMapEntry,
  optionBRecordedState,
  trustedEvidenceFileNames,
  type EvidenceTrustMap,
  type EvidenceTrustRecord,
} from '../../src/lib/vendor/evidenceTrust.ts';

export type StorageObjectMeta = {
  contentType?: string;
  size?: string | number;
  generation?: string | number;
};

export type EvidenceDeps = {
  verifyIdToken: (token: string) => Promise<DecodedIdToken>;
  getAssessment: (assessmentId: string) => Promise<Record<string, unknown> | null>;
  getUser: (uid: string) => Promise<Record<string, unknown> | null>;
  getStorageMetadata: (storagePath: string) => Promise<StorageObjectMeta | null>;
  writeTrustRecord: (
    assessmentId: string,
    storagePath: string,
    record: EvidenceTrustRecord
  ) => Promise<EvidenceTrustRecord>;
  signReadUrl: (storagePath: string) => Promise<string>;
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function bearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

export async function requireVerifiedToken(
  req: Request,
  deps: Pick<EvidenceDeps, 'verifyIdToken'>
): Promise<DecodedIdToken> {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, 'Authentication required');
  try {
    return await deps.verifyIdToken(token);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code.includes('id-token-expired') || /expired/i.test(String(err))) {
      throw new HttpError(401, 'Token expired');
    }
    throw new HttpError(401, 'Invalid or expired token');
  }
}

export async function requirePortalAssessment(
  decoded: DecodedIdToken,
  assessmentId: string
): Promise<void> {
  const claim = decoded.portalAssessmentId;
  if (!claim || typeof claim !== 'string') {
    throw new HttpError(403, 'Portal session required');
  }
  if (claim !== assessmentId) {
    throw new HttpError(403, 'Portal session does not match this assessment');
  }
}

export async function requireOrgAssessmentAccess(
  decoded: DecodedIdToken,
  assessment: Record<string, unknown>,
  getUser: EvidenceDeps['getUser']
): Promise<void> {
  if (decoded.portalAssessmentId) {
    throw new HttpError(403, 'Portal sessions cannot use organization evidence routes');
  }
  if (!decoded.uid) throw new HttpError(401, 'Authentication required');
  const user = await getUser(decoded.uid);
  if (!user) throw new HttpError(403, 'Organization membership required');
  const userOrg = String(user.organizationId || '');
  const assessOrg = String(assessment.organizationId || '');
  if (!userOrg || !assessOrg || userOrg !== assessOrg) {
    throw new HttpError(403, 'Cross-tenant access denied');
  }
  const role = String(user.role || 'member');
  if (role !== 'admin' && role !== 'member' && role !== 'owner') {
    throw new HttpError(403, 'Reviewer permission required');
  }
}

export function liveEvidenceDeps(): EvidenceDeps {
  return {
    async verifyIdToken(token) {
      ensureAdmin();
      return getAuth().verifyIdToken(token);
    },
    async getAssessment(assessmentId) {
      ensureAdmin();
      const snap = await getAdminDb().collection('assessments').doc(assessmentId).get();
      return snap.exists ? (snap.data() as Record<string, unknown>) : null;
    },
    async getUser(uid) {
      ensureAdmin();
      const snap = await getAdminDb().collection('users').doc(uid).get();
      return snap.exists ? (snap.data() as Record<string, unknown>) : null;
    },
    async getStorageMetadata(storagePath) {
      const { getStorage } = await import('firebase-admin/storage');
      ensureAdmin();
      const bucket = getStorage().bucket();
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [metadata] = await file.getMetadata();
      return metadata as StorageObjectMeta;
    },
    async writeTrustRecord(assessmentId, storagePath, record) {
      ensureAdmin();
      const ref = getAdminDb().collection('assessments').doc(assessmentId);
      const applied = await getAdminDb().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new HttpError(404, 'Assessment not found');
        const data = snap.data() || {};
        if (data.portalOpen !== true) {
          throw new HttpError(403, 'Portal is closed');
        }
        const map = (data.evidenceTrustByStoragePath || {}) as EvidenceTrustMap;
        const merged = mergeTrustMapEntry(map, storagePath, record);
        const key = encodeTrustMapKey(storagePath);
        const nextRecord = merged[key] as EvidenceTrustRecord;
        tx.update(ref, { [`evidenceTrustByStoragePath.${key}`]: nextRecord });
        return nextRecord;
      });
      return applied;
    },
    async signReadUrl(storagePath) {
      const { getStorage } = await import('firebase-admin/storage');
      ensureAdmin();
      const bucket = getStorage().bucket();
      const [url] = await bucket.file(storagePath).getSignedUrl({
        action: 'read',
        expires: Date.now() + 5 * 60 * 1000,
      });
      return url;
    },
  };
}

export async function handlePortalValidate(req: Request, res: Response, deps: EvidenceDeps) {
  try {
    const decoded = await requireVerifiedToken(req, deps);
    const assessmentId = String(req.body?.assessmentId || '').trim();
    const storagePath = String(req.body?.storagePath || '').trim();
    if (!assessmentId || assessmentId.length > 128 || /[/.\s]/.test(assessmentId)) {
      res.status(400).json({ error: 'A valid assessmentId is required.' });
      return;
    }
    await requirePortalAssessment(decoded, assessmentId);
    if (!isPortalEvidencePath(assessmentId, storagePath)) {
      res.status(400).json({ error: 'storagePath must belong to this assessment.' });
      return;
    }

    const assessment = await deps.getAssessment(assessmentId);
    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found.' });
      return;
    }
    if (assessment.portalOpen !== true) {
      res.status(403).json({ error: 'Portal is closed' });
      return;
    }

    const meta = await deps.getStorageMetadata(storagePath);
    if (!meta) {
      res.status(404).json({ error: 'Storage object not found.' });
      return;
    }

    const contentType = String(meta.contentType || '');
    const sizeBytes = Number(meta.size) || 0;
    const validation = classifyStorageMetadata({ contentType, sizeBytes });
    const state = optionBRecordedState(validation);
    const record: EvidenceTrustRecord = {
      state,
      storagePath,
      contentType,
      sizeBytes,
      generation: meta.generation != null ? String(meta.generation) : undefined,
      updatedAt: new Date().toISOString(),
      validation: validation === 'validated' ? 'validated' : 'rejected',
    };
    const saved = await deps.writeTrustRecord(assessmentId, storagePath, record);
    res.json({
      state: saved.state,
      storagePath,
      validation: saved.validation,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[portal] evidence-validate failed', err);
    res.status(500).json({ error: 'Could not validate evidence.' });
  }
}

export async function handleEvidenceDownload(
  req: Request,
  res: Response,
  deps: EvidenceDeps,
  kind: 'portal' | 'org'
) {
  try {
    const decoded = await requireVerifiedToken(req, deps);
    const assessmentId = String(req.query.assessmentId || req.body?.assessmentId || '').trim();
    const storagePath = String(req.query.storagePath || req.body?.storagePath || '').trim();
    if (!assessmentId || !isPortalEvidencePath(assessmentId, storagePath)) {
      res.status(400).json({ error: 'A valid assessment evidence path is required.' });
      return;
    }
    const assessment = await deps.getAssessment(assessmentId);
    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found.' });
      return;
    }

    if (kind === 'portal') {
      await requirePortalAssessment(decoded, assessmentId);
      if (assessment.portalOpen !== true) {
        res.status(403).json({ error: 'Portal is closed' });
        return;
      }
    } else {
      await requireOrgAssessmentAccess(decoded, assessment, deps.getUser);
    }

    const meta = await deps.getStorageMetadata(storagePath);
    if (!meta) {
      res.status(404).json({ error: 'Storage object not found.' });
      return;
    }

    const url = await deps.signReadUrl(storagePath);
    res.json({ url, expiresInSec: 300, storagePath });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[evidence] download failed', err);
    res.status(500).json({ error: 'Could not authorize download.' });
  }
}

export async function handleOrgDecision(req: Request, res: Response, deps: EvidenceDeps) {
  try {
    const assessmentId = String(req.body?.assessmentId || '').trim();
    const outcome = String(req.body?.outcome || '');
    const decisionNotes = String(req.body?.decisionNotes || '');
    const decoded = await requireVerifiedToken(req, deps);
    if (!assessmentId) {
      res.status(400).json({ error: 'assessmentId is required.' });
      return;
    }
    const assessment = await deps.getAssessment(assessmentId);
    if (!assessment) {
      res.status(404).json({ error: 'Assessment not found.' });
      return;
    }
    await requireOrgAssessmentAccess(decoded, assessment, deps.getUser);

    const { listAssessmentExceptions } = await import(
      '../../src/lib/vendor/assessmentExceptions.ts'
    );
    const { approvalBlockedByUntrustedEvidence } = await import(
      '../../src/lib/vendor/evidenceTrust.ts'
    );
    const { buildOrgDecisionPatch } = await import('../../src/lib/vendor/assessmentLifecycle.ts');

    const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
    const exceptions = listAssessmentExceptions({
      questions: questions as { id: string; category?: string; question?: string; required?: boolean }[],
      answers: assessment.answers as Record<string, string | string[]>,
      evidenceByQuestion: assessment.evidenceByQuestion as Record<string, unknown[]>,
      evidenceTrustByStoragePath: assessment.evidenceTrustByStoragePath as EvidenceTrustMap,
    });

    if (outcome === 'approved' && approvalBlockedByUntrustedEvidence(exceptions)) {
      res.status(409).json({
        error: 'Required evidence is not trusted. Approval is blocked until an authoritative clean result exists.',
        exceptions,
      });
      return;
    }

    const patch = buildOrgDecisionPatch({
      outcome: outcome as 'approved' | 'conditional' | 'remediate' | 'rejected',
      decidedBy: decoded.uid,
      decisionNotes,
    });

    ensureAdmin();
    await getAdminDb().collection('assessments').doc(assessmentId).update(patch);
    res.json({ ok: true, patch });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error('[org] decision failed', err);
    res.status(500).json({ error: 'Could not record decision.' });
  }
}

export function trustedNamesForAi(
  requested: string[],
  evidenceByQuestion: Record<string, unknown[]> | undefined,
  map: EvidenceTrustMap | undefined
): string[] {
  const allItems = Object.values(evidenceByQuestion || {}).flat();
  const trusted = new Set(trustedEvidenceFileNames(allItems, map));
  return requested.filter((name) => trusted.has(name));
}

export { lookupTrustRecord, encodeTrustMapKey };
