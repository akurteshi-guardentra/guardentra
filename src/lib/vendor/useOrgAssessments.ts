import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { isFirestoreUnavailableError } from './localVendorStore';
import {
  listLocalAssessments,
  type StoredAssessment,
} from './localAssessmentStore';
import type { FrameworkId } from './types';

export type AssessmentDataMode = 'firestore' | 'local';

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
  };
}

/**
 * Org assessments with Firestore → local fallback (same pattern as vendors).
 */
export function useOrgAssessments(orgId?: string | null) {
  const [assessments, setAssessments] = useState<StoredAssessment[]>([]);
  const [mode, setMode] = useState<AssessmentDataMode>('firestore');
  const [loading, setLoading] = useState(true);
  const modeRef = useRef<AssessmentDataMode>('firestore');

  const refreshLocal = useCallback(() => {
    if (!orgId) return;
    setAssessments(listLocalAssessments(orgId));
    modeRef.current = 'local';
    setMode('local');
    setLoading(false);
  }, [orgId]);

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
        (snap) => {
          if (settled && modeRef.current === 'local') return;
          settled = true;
          window.clearTimeout(failSafe);
          const rows = snap.docs.map((d) => normalizeCloudDoc(d.id, d.data() as Record<string, unknown>));
          rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          // Merge any local-only rows so local creates still show when cloud is empty-but-listening.
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
  }, [orgId, refreshLocal]);

  return { assessments, mode, loading, refreshLocal, modeRef };
}
