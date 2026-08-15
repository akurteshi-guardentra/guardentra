/**
 * Pure portal ↔ tracker lifecycle patches.
 *
 * VendorPortal and Assessments compose these so Vitest can cover create →
 * autosave → submit → org decision without Firebase.
 */
import type { AssessmentStatus, FrameworkId } from './types';
import type { DecisionOutcome } from './assessmentExceptions';
import { overallProgressPct, type PortalQuestion } from './questionBank';
import { QUESTION_BANK_VERSION } from './frameworkPacks';

export type PortalAnswersMap = Record<string, string | string[]>;
export type PortalCommentsMap = Record<string, string>;
export type PortalEvidenceMap = Record<string, unknown[]>;

/** Immutable vendor submission captured at Submit — org may compare after reopen. */
export type SubmittedAssessmentSnapshot = {
  answers: PortalAnswersMap;
  comments: PortalCommentsMap;
  evidenceByQuestion: PortalEvidenceMap;
  submittedAt: string;
  attestations?: Record<string, unknown>;
  answerProposals?: Record<string, unknown>;
};

function compactAnswers(
  answers: Record<string, string | string[] | undefined>
): PortalAnswersMap {
  const out: PortalAnswersMap = {};
  for (const [k, v] of Object.entries(answers)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Shared create payload for local store + cloud `assessments` docs. */
export function buildCreateAssessmentFields(input: {
  vendorId: string;
  vendorName: string;
  organizationId: string;
  frameworks: FrameworkId[];
  frameworkPackIds?: string[];
  frameworkName?: string;
  questions: PortalQuestion[];
  sourceQuestionCount?: number;
  dueAt: string;
  nowIso?: string;
  triageTier?: string | null;
  reviewCadence?: string | null;
  reminderScheduleId?: string | null;
  reminderSchedule?: Record<string, unknown> | null;
  inviteEmail?: string | null;
  requesterOrgName?: string | null;
  requesterLogoUrl?: string | null;
}): {
  vendorId: string;
  vendorName: string;
  organizationId: string;
  frameworks: FrameworkId[];
  frameworkPackIds?: string[];
  questionBankVersion: string;
  frameworkName?: string;
  status: 'Sent';
  dueAt: string;
  dueDate: string;
  progressPct: 0;
  progress: 0;
  questionCount: number;
  sourceQuestionCount?: number;
  questions: PortalQuestion[];
  portalOpen: true;
  createdAt: string;
  sentAt: string;
  triageTier?: string;
  reviewCadence?: string;
  reminderScheduleId?: string;
  reminderSchedule?: Record<string, unknown>;
  inviteEmail?: string;
  versionLocked: true;
  requesterOrgName?: string;
  requesterLogoUrl?: string;
} {
  const now = input.nowIso || new Date().toISOString();
  return {
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    organizationId: input.organizationId,
    frameworks: input.frameworks,
    frameworkPackIds: input.frameworkPackIds,
    questionBankVersion: QUESTION_BANK_VERSION,
    frameworkName: input.frameworkName,
    status: 'Sent',
    dueAt: input.dueAt,
    dueDate: input.dueAt.slice(0, 10),
    progressPct: 0,
    progress: 0,
    questionCount: input.questions.length,
    sourceQuestionCount: input.sourceQuestionCount,
    questions: input.questions,
    portalOpen: true,
    createdAt: now,
    sentAt: now,
    versionLocked: true,
    ...(input.triageTier ? { triageTier: input.triageTier } : {}),
    ...(input.reviewCadence ? { reviewCadence: input.reviewCadence } : {}),
    ...(input.reminderScheduleId ? { reminderScheduleId: input.reminderScheduleId } : {}),
    ...(input.reminderSchedule ? { reminderSchedule: input.reminderSchedule } : {}),
    ...(input.inviteEmail ? { inviteEmail: input.inviteEmail } : {}),
    ...(input.requesterOrgName ? { requesterOrgName: input.requesterOrgName } : {}),
    ...(input.requesterLogoUrl ? { requesterLogoUrl: input.requesterLogoUrl } : {}),
  };
}

/**
 * Autosave draft: Never Completed. Progress > 0 → In Progress; else Sent.
 * Submit is the only portal path that sets Under Review.
 */
export function buildPortalAutosavePatch(input: {
  questions: PortalQuestion[];
  answers: Record<string, string | string[] | undefined>;
  comments: PortalCommentsMap;
  evidenceByQuestion: PortalEvidenceMap;
  nowIso?: string;
}): {
  answers: PortalAnswersMap;
  comments: PortalCommentsMap;
  evidenceByQuestion: PortalEvidenceMap;
  progressPct: number;
  progress: number;
  status: 'Sent' | 'In Progress';
  questions: PortalQuestion[];
  updatedAt: string;
} {
  const answers = compactAnswers(input.answers);
  const pct = overallProgressPct(input.questions, answers);
  return {
    answers,
    comments: input.comments,
    evidenceByQuestion: input.evidenceByQuestion,
    progressPct: pct,
    progress: pct,
    status: pct > 0 ? 'In Progress' : 'Sent',
    questions: input.questions,
    updatedAt: input.nowIso || new Date().toISOString(),
  };
}

/** Vendor submit for org review — Under Review at 100%, portal closed, snapshot frozen. */
export function buildPortalSubmitPatch(input: {
  answers: Record<string, string | string[] | undefined>;
  comments: PortalCommentsMap;
  evidenceByQuestion: PortalEvidenceMap;
  nowIso?: string;
  attestations?: Record<string, unknown>;
  answerProposals?: Record<string, unknown>;
}): {
  answers: PortalAnswersMap;
  comments: PortalCommentsMap;
  evidenceByQuestion: PortalEvidenceMap;
  progressPct: 100;
  progress: 100;
  status: 'Under Review';
  completedAt: string;
  portalOpen: false;
  submittedSnapshot: SubmittedAssessmentSnapshot;
  attestations?: Record<string, unknown>;
  answerProposals?: Record<string, unknown>;
  versionLocked: true;
} {
  const now = input.nowIso || new Date().toISOString();
  const answers = compactAnswers(input.answers);
  return {
    answers,
    comments: input.comments,
    evidenceByQuestion: input.evidenceByQuestion,
    progressPct: 100,
    progress: 100,
    status: 'Under Review',
    completedAt: now,
    portalOpen: false,
    submittedSnapshot: {
      answers,
      comments: input.comments,
      evidenceByQuestion: input.evidenceByQuestion,
      submittedAt: now,
      ...(input.attestations ? { attestations: input.attestations } : {}),
      ...(input.answerProposals ? { answerProposals: input.answerProposals } : {}),
    },
    versionLocked: true,
    ...(input.attestations ? { attestations: input.attestations } : {}),
    ...(input.answerProposals ? { answerProposals: input.answerProposals } : {}),
  };
}

/**
 * Org-controlled correction reopen (P0-1). Vendor cannot self-reopen; org records reason
 * and re-enables portal writes. Remediate via buildOrgDecisionPatch is the other path.
 */
export function buildOrgCorrectionReopenPatch(input: {
  reopenedBy: string;
  reason: string;
  nowIso?: string;
}): {
  portalOpen: true;
  status: 'In Progress';
  correctionReopenedAt: string;
  correctionReopenedBy: string;
  correctionReason: string;
} {
  const at = input.nowIso || new Date().toISOString();
  return {
    portalOpen: true,
    // In Progress (not Under Review) so isReceiptMode does not treat leftover
    // completedAt from the original submit as a receipt lock. Does not touch
    // submittedSnapshot or completedAt — original submission stays retrievable.
    status: 'In Progress',
    correctionReopenedAt: at,
    correctionReopenedBy: input.reopenedBy,
    correctionReason: input.reason.trim(),
  };
}

/** Vendor portal receipt vs editable questionnaire (pure; no Firebase). */
export function isReceiptMode(data: {
  status?: string;
  decisionOutcome?: string;
  completedAt?: string;
  portalOpen?: boolean;
  correctionReopenedAt?: string;
}): boolean {
  if (data.decisionOutcome === 'remediate' && data.portalOpen === true) return false;
  if (data.correctionReopenedAt && data.portalOpen === true && data.status === 'In Progress') {
    return false;
  }
  if (data.status === 'Completed' || data.status === 'Under Review') return true;
  if (data.completedAt) return true;
  return false;
}

export function canSignOffAssessment(assessment: {
  status?: AssessmentStatus | string;
  progressPct?: number;
  progress?: number;
}): boolean {
  const progress = assessment.progressPct ?? assessment.progress ?? 0;
  return (
    assessment.status === 'Under Review' ||
    assessment.status === 'Completed' ||
    progress > 0
  );
}

export function decisionClosesPortal(outcome: DecisionOutcome): boolean {
  return outcome === 'approved' || outcome === 'conditional' || outcome === 'rejected';
}

/** Terminal FastTrack outcomes. `remediate` is not terminal. */
export function isTerminalDecisionOutcome(outcome: unknown): boolean {
  return outcome === 'approved' || outcome === 'conditional' || outcome === 'rejected';
}

export function hasTerminalOrgDecision(assessment: {
  decisionOutcome?: unknown;
}): boolean {
  return isTerminalDecisionOutcome(assessment.decisionOutcome);
}

export function nextReviewAtForDecision(
  outcome: DecisionOutcome,
  from: Date = new Date()
): string {
  const next = new Date(from.getTime());
  if (outcome === 'conditional') {
    next.setMonth(next.getMonth() + 6);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next.toISOString();
}

export type OrgDecisionPatch = {
  decisionOutcome: DecisionOutcome;
  decisionNotes?: string;
  decidedAt: string;
  decidedBy: string;
  status: 'Completed' | 'Under Review';
  progressPct?: number;
  progress?: number;
  portalOpen: boolean;
  completedAt?: string;
};

/**
 * Org FastTrack decision terminal.
 * approved / conditional / rejected → Completed + portal closed.
 * remediate → stays Under Review + portal open for follow-up.
 */
export function buildOrgDecisionPatch(input: {
  outcome: DecisionOutcome;
  decidedBy: string;
  decisionNotes?: string;
  nowIso?: string;
}): OrgDecisionPatch {
  const decidedAt = input.nowIso || new Date().toISOString();
  const notes = input.decisionNotes?.trim() || undefined;
  const closes = decisionClosesPortal(input.outcome);

  if (closes) {
    return {
      decisionOutcome: input.outcome,
      decisionNotes: notes,
      decidedAt,
      decidedBy: input.decidedBy,
      status: 'Completed',
      progressPct: 100,
      progress: 100,
      portalOpen: false,
      completedAt: decidedAt,
    };
  }

  return {
    decisionOutcome: input.outcome,
    decisionNotes: notes,
    decidedAt,
    decidedBy: input.decidedBy,
    status: 'Under Review',
    portalOpen: true,
  };
}

/** Notes required for conditional approve and remediate. */
export function decisionRequiresNotes(outcome: DecisionOutcome): boolean {
  return outcome === 'conditional' || outcome === 'remediate';
}
