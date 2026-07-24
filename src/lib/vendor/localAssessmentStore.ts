import type { AssessmentStatus, FrameworkId, VendorAssessment } from './types';

const STORAGE_KEY = 'guardentra.localAssessments.v1';

/** Assessment row used by local store + Assessments tracker (cloud-compatible fields). */
export interface StoredAssessment extends VendorAssessment {
  frameworkName?: string;
  progress?: number;
  dueDate?: string;
  questions?: unknown[];
  portalOpen?: boolean;
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
    frameworkName?: string;
    status?: AssessmentStatus;
    dueAt?: string;
    questionCount?: number;
    sourceQuestionCount?: number;
    questions?: unknown[];
  }
): StoredAssessment {
  const dueAt = input.dueAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const assessment: StoredAssessment = {
    id: `local_asm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    organizationId: orgId,
    frameworks: input.frameworks,
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
  };
  return upsertLocalAssessment(orgId, assessment);
}

export function replaceLocalAssessments(orgId: string, assessments: StoredAssessment[]) {
  const store = readStore();
  store[orgId] = assessments;
  writeStore(store);
}

/** Map assessment rows for a vendor into a directory chip status. */
export function deriveStatusFromAssessments(
  assessments: Pick<StoredAssessment, 'status' | 'dueAt' | 'dueDate' | 'progressPct' | 'progress'>[]
): AssessmentStatus | undefined {
  if (!assessments.length) return undefined;

  const normalized = assessments.map((a) => {
    const progress = a.progressPct ?? a.progress ?? 0;
    if (a.status === 'Completed' || progress >= 100) return 'Completed' as const;
    if (a.status === 'Overdue') return 'Overdue' as const;
    if (a.status === 'Due Soon') return 'Due Soon' as const;
    if (a.status === 'In Progress') return 'In Progress' as const;
    if (a.status === 'Sent' || a.status === 'Not Started') return a.status;
    return 'In Progress' as const;
  });

  if (normalized.some((s) => s === 'Overdue')) return 'Overdue';
  if (normalized.some((s) => s === 'Due Soon')) return 'Due Soon';
  if (normalized.some((s) => s === 'In Progress' || s === 'Sent')) return 'In Progress';
  if (normalized.every((s) => s === 'Completed')) return 'Completed';
  return normalized[0];
}
