/**
 * Admin recovery for legacy assessments with an empty question snapshot.
 *
 * The vendor portal intentionally refuses to rebuild empty snapshots (audit integrity).
 * Org admins may explicitly stamp questions from framework packs, or archive the row
 * with a reason — never silently mutate history from the portal path.
 */
import type { FrameworkId } from './types';
import {
  buildQuestionsForPackIds,
  QUESTION_BANK_VERSION,
  resolvePackIdsForFrameworks,
} from './frameworkPacks';
import type { PortalQuestion } from './questionBank';
import { SAFE_EMPTY_RECOVERY_NO_PACKS } from './safePackWording';

type OrgPackDefaults = Partial<Record<FrameworkId, string>>;

export type EmptySnapshotAssessment = {
  id: string;
  status?: string;
  frameworks?: FrameworkId[];
  frameworkPackIds?: string[];
  questions?: unknown[] | null;
  answers?: Record<string, string | string[]>;
  comments?: Record<string, string>;
  evidenceByQuestion?: Record<string, unknown[]>;
  progressPct?: number;
  progress?: number;
  portalOpen?: boolean;
};

/** True when the assessment has no snapshotted questions (legacy / broken create). */
export function hasEmptyQuestionSnapshot(
  assessment: Pick<EmptySnapshotAssessment, 'questions'>
): boolean {
  return !Array.isArray(assessment.questions) || assessment.questions.length === 0;
}

/** Packs already stamped on the doc, else resolve from frameworks + org defaults. */
export function resolveRecoveryPackIds(
  assessment: Pick<EmptySnapshotAssessment, 'frameworks' | 'frameworkPackIds'>,
  orgDefaults?: OrgPackDefaults
): string[] {
  const stamped = (assessment.frameworkPackIds || []).filter(Boolean);
  if (stamped.length) return stamped;
  const frameworks = (assessment.frameworks || []).filter((id) => id !== 'custom');
  return resolvePackIdsForFrameworks(frameworks, orgDefaults);
}

export function canRecoverEmptyAssessment(
  assessment: Pick<EmptySnapshotAssessment, 'frameworks' | 'frameworkPackIds' | 'questions'>,
  orgDefaults?: OrgPackDefaults
): boolean {
  if (!hasEmptyQuestionSnapshot(assessment)) return false;
  return resolveRecoveryPackIds(assessment, orgDefaults).length > 0;
}

export type RecoverEmptyAssessmentPatch = {
  questions: PortalQuestion[];
  frameworkPackIds: string[];
  questionBankVersion: string;
  questionCount: number;
  progressPct: number;
  progress: number;
  portalOpen: true;
  answers: Record<string, string | string[]>;
  comments: Record<string, string>;
  evidenceByQuestion: Record<string, unknown[]>;
  recoveredAt: string;
  recoveredFrom: 'empty_snapshot';
};

/**
 * Explicit rebuild of an empty snapshot from packs. Clears any stray answer maps
 * so the vendor starts clean on the newly stamped questionnaire.
 */
export function buildRecoverEmptyAssessmentPatch(
  assessment: Pick<EmptySnapshotAssessment, 'frameworks' | 'frameworkPackIds' | 'questions'>,
  orgDefaults?: OrgPackDefaults,
  nowIso: string = new Date().toISOString()
): RecoverEmptyAssessmentPatch {
  if (!hasEmptyQuestionSnapshot(assessment)) {
    throw new Error('Assessment already has snapshotted questions — recovery is only for empty snapshots.');
  }
  const packIds = resolveRecoveryPackIds(assessment, orgDefaults);
  if (!packIds.length) {
    throw new Error(
      SAFE_EMPTY_RECOVERY_NO_PACKS
    );
  }
  const questions = buildQuestionsForPackIds(packIds);
  if (!questions.length) {
    throw new Error('Selected packs produced no questions — archive this assessment or pick different frameworks.');
  }
  return {
    questions,
    frameworkPackIds: packIds,
    questionBankVersion: QUESTION_BANK_VERSION,
    questionCount: questions.length,
    progressPct: 0,
    progress: 0,
    portalOpen: true,
    answers: {},
    comments: {},
    evidenceByQuestion: {},
    recoveredAt: nowIso,
    recoveredFrom: 'empty_snapshot',
  };
}

export type ArchiveEmptyAssessmentPatch = {
  status: 'Completed';
  portalOpen: false;
  progressPct: number;
  progress: number;
  completedAt: string;
  archivedAt: string;
  archiveReason: string;
  decisionOutcome: 'rejected';
  decisionNotes: string;
  decidedAt: string;
  decidedBy: string;
};

/** Close an empty/broken assessment with an audit reason (no silent delete). */
export function buildArchiveEmptyAssessmentPatch(input: {
  reason: string;
  archivedBy: string;
  nowIso?: string;
}): ArchiveEmptyAssessmentPatch {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error('Archive reason is required.');
  }
  const now = input.nowIso || new Date().toISOString();
  const notes = `Archived empty assessment: ${reason}`;
  return {
    status: 'Completed',
    portalOpen: false,
    progressPct: 0,
    progress: 0,
    completedAt: now,
    archivedAt: now,
    archiveReason: reason,
    decisionOutcome: 'rejected',
    decisionNotes: notes,
    decidedAt: now,
    decidedBy: input.archivedBy,
  };
}
