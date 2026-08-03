import { useCallback, useEffect, useRef, useState } from 'react';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { isFirestoreUnavailableError } from './localVendorStore';
import {
  listLocalAssessments,
  removeLocalAssessment,
  type StoredAssessment,
} from './localAssessmentStore';
import type { FrameworkId } from './types';

export type AssessmentDataMode = 'firestore' | 'local';

export const ASSESSMENT_RETRY_INTERVAL_MS = 30000;

/** Write any local-only assessments (created while Firestore was unreachable) for real,
 * then drop them from the local store — otherwise they'd stay invisible to teammates
 * forever even after Firestore reconnects. */
export async function promoteLocalAssessments(orgId: string): Promise<void> {
  const localOnly = listLocalAssessments(orgId).filter((a) => a.id.startsWith('local_asm_'));
  for (const assessment of localOnly) {
    try {
      const { id, ...rest } = assessment;
      await addDoc(collection(db, 'assessments'), rest);
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
  };
}

/**
 * Org assessments with Firestore → local fallback (same pattern as vendors).
 */
export function useOrgAssessments(orgId?: string | null) {
  const [assessments, setAssessments] = useState<StoredAssessment[]>([]);
  const [mode, setMode] = useState<AssessmentDataMode>('firestore');
  const [loading, setLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const modeRef = useRef<AssessmentDataMode>('firestore');

  const refreshLocal = useCallback(() => {
    if (!orgId) return;
    setAssessments(listLocalAssessments(orgId));
    modeRef.current = 'local';
    setMode('local');
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
    let settled = false;
    let unsub: (() => void) | null = null;

    const fallBackLocal = () => {
      if (settled && modeRef.current === 'local') return;
      settled = true;
      if (unsub) {
        unsub();
        unsub = null;
      }
      refreshLocal();
    };

    const failSafe = window.setTimeout(fallBackLocal, 3500);

    try {
      const q = query(collection(db, 'assessments'), where('organizationId', '==', orgId));
      unsub = onSnapshot(
        q,
        async (snap) => {
          if (settled && modeRef.current === 'local') return;
          settled = true;
          window.clearTimeout(failSafe);
          const wasLocal = modeRef.current === 'local';
          if (wasLocal) {
            await promoteLocalAssessments(orgId);
          }
          const rows = snap.docs.map((d) => normalizeCloudDoc(d.id, d.data() as Record<string, unknown>));
          rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          // Merge any remaining local-only rows (e.g. promotion above partially failed)
          // so local creates still show when cloud is empty-but-listening.
          const local = listLocalAssessments(orgId);
          const cloudIds = new Set(rows.map((r) => r.id));
          const merged = [...rows, ...local.filter((l) => !cloudIds.has(l.id))];
          setAssessments(merged);
          modeRef.current = 'firestore';
          setMode('firestore');
          setLoading(false);
        },
        (err) => {
          console.error('useOrgAssessments listen failed', err);
          window.clearTimeout(failSafe);
          if (isFirestoreUnavailableError(err) || true) {
            fallBackLocal();
          }
        }
      );
    } catch (err) {
      console.error('useOrgAssessments setup failed', err);
      window.clearTimeout(failSafe);
      fallBackLocal();
    }

    return () => {
      window.clearTimeout(failSafe);
      if (unsub) unsub();
    };
  }, [orgId, refreshLocal, retryTick]);

  // Auto-retry while stuck in local mode, so a transient outage can self-heal
  // without requiring a page reload.
  useEffect(() => {
    if (mode !== 'local') return;
    const interval = window.setInterval(retryFirestore, ASSESSMENT_RETRY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [mode, retryFirestore]);

  return { assessments, mode, loading, refreshLocal, retryFirestore, modeRef };
}
