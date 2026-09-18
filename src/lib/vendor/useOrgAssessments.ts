import { useCallback, useEffect, useRef, useState } from 'react';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  HOSTED_ASSESSMENT_LOAD_FAILED,
  isFirestoreUnavailableError,
  shouldUseLocalPersistenceFallback,
} from './localVendorStore';
import {
  listLocalAssessments,
  removeLocalAssessment,
  type StoredAssessment,
} from './localAssessmentStore';
import { promoteLocalVendors } from './useOrgVendors';
import type { FrameworkId } from './types';

export type AssessmentDataMode = 'firestore' | 'local' | 'unavailable';

export const ASSESSMENT_RETRY_INTERVAL_MS = 30000;

/** Write any local-only assessments (created while Firestore was unreachable) for real,
 * then drop them from the local store — otherwise they'd stay invisible to teammates
 * forever even after Firestore reconnects.
 * Remaps vendorId from local_* → cloud id when vendors were promoted in the same pass.
 * Hosted environments never promote leftover localStorage into Firestore. */
export async function promoteLocalAssessments(
  orgId: string,
  vendorIdMap?: Map<string, string>
): Promise<void> {
  if (!shouldUseLocalPersistenceFallback()) return;
  // Ensure local vendors exist in cloud first so assessment.vendorId can be remapped.
  const resolvedMap = vendorIdMap ?? (await promoteLocalVendors(orgId));
  const localOnly = listLocalAssessments(orgId).filter((a) => a.id.startsWith('local_asm_'));
  for (const assessment of localOnly) {
    try {
      const { id, ...rest } = assessment;
      const vendorId =
        rest.vendorId && resolvedMap.has(rest.vendorId)
          ? resolvedMap.get(rest.vendorId)!
          : rest.vendorId;
      await addDoc(collection(db, 'assessments'), { ...rest, vendorId });
      removeLocalAssessment(orgId, id);
    } catch (err) {
      console.warn('useOrgAssessments: could not promote local-only assessment, will retry next reconnect', err);
    }
  }
}

function normalizeCloudDoc(id: string, data: Record<string, unknown>): StoredAssessment {
  const frameworks = (data.frameworks as FrameworkId[] | undefined) || [];
  const frameworkName =
    (data.frameworkName as string | undefined) ||
    (frameworks.length ? frameworks.join(', ') : 'Assessment');
  const progressPct = Number(data.progressPct ?? data.progress ?? 0);
  const dueAt = (data.dueAt as string | undefined) || undefined;
  const dueDate =
    (data.dueDate as string | undefined) || (dueAt ? dueAt.slice(0, 10) : undefined);

  return {
    id,
    vendorId: String(data.vendorId || ''),
    vendorName: String(data.vendorName || 'Vendor'),
    organizationId: String(data.organizationId || ''),
    frameworks,
    frameworkName,
    status: (data.status as StoredAssessment['status']) || 'Sent',
    dueAt,
    dueDate,
    progressPct,
    progress: progressPct,
    questionCount: data.questionCount as number | undefined,
    sourceQuestionCount: data.sourceQuestionCount as number | undefined,
    questions: data.questions as unknown[] | undefined,
    portalOpen: Boolean(data.portalOpen),
    createdAt: String(data.createdAt || ''),
    sentAt: data.sentAt as string | undefined,
    completedAt: data.completedAt as string | undefined,
    // VendorPortal.tsx writes these onto the assessment doc separately from `questions`
    // (which never carries the answer itself) — previously dropped here entirely, which
    // is why the org-side review screen always showed "No response provided."
    answers: data.answers as Record<string, string | string[]> | undefined,
    comments: data.comments as Record<string, string> | undefined,
    evidenceByQuestion: data.evidenceByQuestion as Record<string, unknown[]> | undefined,
    evidenceTrustByStoragePath: data.evidenceTrustByStoragePath as StoredAssessment['evidenceTrustByStoragePath'],
    decisionOutcome: data.decisionOutcome as StoredAssessment['decisionOutcome'] | undefined,
    decisionNotes: data.decisionNotes as string | undefined,
    decidedAt: data.decidedAt as string | undefined,
    decidedBy: data.decidedBy as string | undefined,
  };
}

/**
 * Org assessments. Demo/dev may fall back to localStorage; hosted fail-closes.
 */
export function useOrgAssessments(orgId?: string | null) {
  const [assessments, setAssessments] = useState<StoredAssessment[]>([]);
  const [mode, setMode] = useState<AssessmentDataMode>('firestore');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryTick, setRetryTick] = useState(0);
  const modeRef = useRef<AssessmentDataMode>('firestore');

  const refreshLocal = useCallback(() => {
    if (!orgId) return;
    if (!shouldUseLocalPersistenceFallback()) {
      setAssessments([]);
      modeRef.current = 'unavailable';
      setMode('unavailable');
      setError(HOSTED_ASSESSMENT_LOAD_FAILED);
      setLoading(false);
      return;
    }
    setAssessments(listLocalAssessments(orgId));
    modeRef.current = 'local';
    setMode('local');
    setError('');
    setLoading(false);
  }, [orgId]);

  const retryFirestore = useCallback(() => {
    setRetryTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!orgId) {
      setAssessments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    let settled = false;
    let unsub: (() => void) | null = null;
    const allowLocal = shouldUseLocalPersistenceFallback();

    const failClosed = () => {
      if (settled && modeRef.current === 'unavailable') return;
      settled = true;
      if (unsub) {
        unsub();
        unsub = null;
      }
      setAssessments([]);
      modeRef.current = 'unavailable';
      setMode('unavailable');
      setError(HOSTED_ASSESSMENT_LOAD_FAILED);
      setLoading(false);
    };

    const fallBackLocal = () => {
      if (!allowLocal) {
        failClosed();
        return;
      }
      if (settled && modeRef.current === 'local') return;
      settled = true;
      if (unsub) {
        unsub();
        unsub = null;
      }
      refreshLocal();
    };

    const failSafe = window.setTimeout(allowLocal ? fallBackLocal : failClosed, 3500);

    try {
      const q = query(collection(db, 'assessments'), where('organizationId', '==', orgId));
      unsub = onSnapshot(
        q,
        async (snap) => {
          if (settled && modeRef.current === 'local') return;
          settled = true;
          window.clearTimeout(failSafe);
          const wasLocal = modeRef.current === 'local';
          if (wasLocal && allowLocal) {
            await promoteLocalAssessments(orgId);
          }
          const rows = snap.docs.map((d) => normalizeCloudDoc(d.id, d.data() as Record<string, unknown>));
          rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          if (!allowLocal) {
            setAssessments(rows);
            modeRef.current = 'firestore';
            setMode('firestore');
            setError('');
            setLoading(false);
            return;
          }
          // Demo/dev only: merge remaining local-only rows so local creates still show
          // when cloud is empty-but-listening after a partial promote.
          const local = listLocalAssessments(orgId);
          const cloudIds = new Set(rows.map((r) => r.id));
          const merged = [...rows, ...local.filter((l) => !cloudIds.has(l.id))];
          setAssessments(merged);
          modeRef.current = 'firestore';
          setMode('firestore');
          setError('');
          setLoading(false);
        },
        (err) => {
          console.error('useOrgAssessments listen failed', err);
          window.clearTimeout(failSafe);
          if (allowLocal && (isFirestoreUnavailableError(err) || true)) {
            fallBackLocal();
          } else {
            failClosed();
          }
        }
      );
    } catch (err) {
      console.error('useOrgAssessments setup failed', err);
      window.clearTimeout(failSafe);
      if (allowLocal) fallBackLocal();
      else failClosed();
    }

    return () => {
      window.clearTimeout(failSafe);
      if (unsub) unsub();
    };
  }, [orgId, refreshLocal, retryTick]);

  useEffect(() => {
    if (mode !== 'local' && mode !== 'unavailable') return;
    const interval = window.setInterval(retryFirestore, ASSESSMENT_RETRY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [mode, retryFirestore]);

  return { assessments, mode, loading, error, refreshLocal, retryFirestore, modeRef };
}
