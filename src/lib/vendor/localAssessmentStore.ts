import type { AssessmentStatus, FrameworkId, VendorAssessment } from './types';

const STORAGE_KEY = 'guardentra.localAssessments.v1';

/** Assessment row used by local store + Assessments tracker (cloud-compatible fields). */
export interface StoredAssessment extends VendorAssessment {
  frameworkName?: string;
  progress?: number;
  dueDate?: string;
  questions?: unknown[];
  portalOpen?: boolean;
  /** Vendor's answers, keyed by question id — VendorPortal.tsx writes these onto the
   * assessment doc separately from `questions`, which never carries the answer itself. */
  answers?: Record<string, string | string[]>;
  comments?: Record<string, string>;
  evidenceByQuestion?: Record<string, unknown[]>;
  submittedSnapshot?: {
    answers: Record<string, string | string[]>;
    comments?: Record<string, string>;
    evidenceByQuestion?: Record<string, unknown[]>;
    submittedAt: string;
  };
  correctionReopenedAt?: string;
  correctionReopenedBy?: string;
  correctionReason?: string;
}

type StoreShape = Record<string, StoredAssessment[]>;

function readStore(): StoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoreShape;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: StoreShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listLocalAssessments(orgId: string): StoredAssessment[] {
  const rows = readStore()[orgId] || [];
  return [...rows].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function listLocalAssessmentsForVendor(orgId: string, vendorId: string): StoredAssessment[] {
  return listLocalAssessments(orgId).filter((a) => a.vendorId === vendorId);
}

export function upsertLocalAssessment(orgId: string, assessment: StoredAssessment): StoredAssessment {
  const store = readStore();
  const rows = store[orgId] || [];
  const idx = rows.findIndex((a) => a.id === assessment.id);
  if (idx >= 0) rows[idx] = assessment;
  else rows.unshift(assessment);
  store[orgId] = rows;
  writeStore(store);
  return assessment;
}

export function createLocalAssessment(
  orgId: string,
  input: {
    vendorId: string;
    vendorName: string;
    frameworks: FrameworkId[];
    frameworkPackIds?: string[];
    questionBankVersion?: string;
    frameworkName?: string;
    status?: AssessmentStatus;
    dueAt?: string;
    questionCount?: number;
    sourceQuestionCount?: number;
    questions?: unknown[];
    requesterOrgName?: string | null;
    requesterLogoUrl?: string | null;
  }
): StoredAssessment {
  const dueAt = input.dueAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const assessment: StoredAssessment = {
    id: `local_asm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    organizationId: orgId,
    frameworks: input.frameworks,
    frameworkPackIds: input.frameworkPackIds,
    questionBankVersion: input.questionBankVersion,
    frameworkName: input.frameworkName,
    status: input.status || 'Sent',
    dueAt,
    dueDate: dueAt.slice(0, 10),
    progressPct: 0,
    progress: 0,
    questionCount: input.questionCount,
    sourceQuestionCount: input.sourceQuestionCount,
    questions: input.questions,
    portalOpen: true,
    createdAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    ...(input.requesterOrgName ? { requesterOrgName: input.requesterOrgName } : {}),
    ...(input.requesterLogoUrl ? { requesterLogoUrl: input.requesterLogoUrl } : {}),
  };
  return upsertLocalAssessment(orgId, assessment);
}

export function replaceLocalAssessments(orgId: string, assessments: StoredAssessment[]) {
  const store = readStore();
  store[orgId] = assessments;
  writeStore(store);
}

/** Drop a local-only row once it's been promoted to a real Firestore doc. */
export function removeLocalAssessment(orgId: string, id: string): void {
  const store = readStore();
  const rows = store[orgId] || [];
  store[orgId] = rows.filter((a) => a.id !== id);
  writeStore(store);
}

/** Map assessment rows for a vendor into a directory chip status. progressPct is
 * optional here (unlike VendorAssessment, where it's required) because this
 * function already falls back to `progress` when it's absent — see below. */
export function deriveStatusFromAssessments(
  assessments: (Pick<StoredAssessment, 'status' | 'dueAt' | 'dueDate' | 'progress'> & {
    progressPct?: number;
  })[]
): AssessmentStatus | undefined {
  if (!assessments.length) return undefined;

  const normalized = assessments.map((a) => {
    const progress = a.progressPct ?? a.progress ?? 0;
    const dueRaw = a.dueAt || a.dueDate;
    const dueMs = dueRaw ? new Date(dueRaw).getTime() : NaN;
    const dueValid = !Number.isNaN(dueMs);
    const open =
      a.status !== 'Completed' &&
      a.status !== 'Under Review' &&
      progress < 100;

    // Under Review wins over progressPct 100 — portal submit sets both intentionally.
    if (a.status === 'Under Review') return 'Under Review' as const;
    if (a.status === 'Completed' || progress >= 100) return 'Completed' as const;
    if (a.status === 'Overdue' || (open && dueValid && dueMs < Date.now())) return 'Overdue' as const;
    // FastTrack reminder window: flag Due Soon within 7 days of due (Sent or in-progress).
    const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;
    if (a.status === 'Due Soon' || (open && dueValid && dueMs < soon)) return 'Due Soon' as const;
    if (a.status === 'In Progress' || (progress > 0 && a.status !== 'Not Started')) {
      return 'In Progress' as const;
    }
    if (a.status === 'Sent') return 'Sent' as const;
    if (a.status === 'Not Started') return 'Not Started' as const;
    return 'In Progress' as const;
  });

  if (normalized.some((s) => s === 'Overdue')) return 'Overdue';
  if (normalized.some((s) => s === 'Due Soon')) return 'Due Soon';
  if (normalized.some((s) => s === 'Under Review')) return 'Under Review';
  if (normalized.some((s) => s === 'In Progress')) return 'In Progress';
  if (normalized.some((s) => s === 'Sent')) return 'Sent';
  if (normalized.every((s) => s === 'Completed')) return 'Completed';
  return normalized[0];
}
