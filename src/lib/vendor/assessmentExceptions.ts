/**
 * Exceptions-first review helpers for org sign-off (FastTrack steps 6–7).
 * Pure: no Firestore / React.
 */
import { isAnswered } from './questionBank';
import { hasTrustedEvidence, type EvidenceTrustMap } from './evidenceTrust';

export type ExceptionReason = 'unanswered' | 'negative' | 'missing_evidence';

export interface ExceptionQuestion {
  id: string;
  category?: string;
  question?: string;
  required?: boolean;
}

export interface AssessmentException {
  id: string;
  category: string;
  question: string;
  reason: ExceptionReason;
  answer?: string | string[];
}

const NEGATIVE = new Set(['No', 'Partially']);

function formatAnswer(value: string | string[] | undefined): string | string[] | undefined {
  return value;
}

function hasEvidence(
  questionId: string,
  evidenceByQuestion?: Record<string, unknown[]>,
  trustMap?: EvidenceTrustMap | null
): boolean {
  return hasTrustedEvidence(questionId, evidenceByQuestion, trustMap);
}

/**
 * Flag gaps that need reviewer attention: unanswered required, No/Partially,
 * or required questions with an empty evidence list when evidence is tracked.
 */
export function listAssessmentExceptions(input: {
  questions: ExceptionQuestion[];
  answers?: Record<string, string | string[]>;
  evidenceByQuestion?: Record<string, unknown[]>;
  evidenceTrustByStoragePath?: EvidenceTrustMap | null;
}): AssessmentException[] {
  const answers = input.answers || {};
  const out: AssessmentException[] = [];

  for (const q of input.questions) {
    if (!q.id) continue;
    const required = q.required !== false;
    const answer = answers[q.id];
    const answered = isAnswered(answer);
    const category = q.category || 'General';
    const question = q.question || q.id;

    if (required && !answered) {
      out.push({
        id: q.id,
        category,
        question,
        reason: 'unanswered',
        answer: formatAnswer(answer),
      });
      continue;
    }

    if (answered) {
      const scalar = Array.isArray(answer) ? null : answer;
      if (scalar && NEGATIVE.has(scalar)) {
        out.push({
          id: q.id,
          category,
          question,
          reason: 'negative',
          answer: formatAnswer(answer),
        });
      }
    }

    if (
      required &&
      answered &&
      !hasEvidence(q.id, input.evidenceByQuestion, input.evidenceTrustByStoragePath)
    ) {
      out.push({
        id: q.id,
        category,
        question,
        reason: 'missing_evidence',
        answer: formatAnswer(answer),
      });
    }
  }

  const categoryRank = (c: string) => c.toLowerCase();
  return out.sort((a, b) => {
    const byCat = categoryRank(a.category).localeCompare(categoryRank(b.category));
    if (byCat !== 0) return byCat;
    return a.id.localeCompare(b.id);
  });
}

/** One reviewer-facing row per question, carrying every reason it was flagged. */
export interface GroupedAssessmentException {
  id: string;
  category: string;
  question: string;
  reasons: ExceptionReason[];
  answer?: string | string[];
}

/**
 * Collapse per-reason exceptions into one row per question (#124 journey finding 6):
 * a "Partially" answer with no trusted evidence was listed twice. Display-only; the
 * approval guard still evaluates the ungrouped list from listAssessmentExceptions.
 */
export function groupExceptionsByQuestion(
  exceptions: AssessmentException[]
): GroupedAssessmentException[] {
  const byId = new Map<string, GroupedAssessmentException>();
  const out: GroupedAssessmentException[] = [];
  for (const ex of exceptions) {
    const existing = byId.get(ex.id);
    if (existing) {
      if (!existing.reasons.includes(ex.reason)) existing.reasons.push(ex.reason);
      continue;
    }
    const row: GroupedAssessmentException = {
      id: ex.id,
      category: ex.category,
      question: ex.question,
      reasons: [ex.reason],
      answer: ex.answer,
    };
    byId.set(ex.id, row);
    out.push(row);
  }
  return out;
}

export function exceptionReasonsLabel(reasons: ExceptionReason[]): string {
  return reasons.map(exceptionReasonLabel).join(' · ');
}

export function exceptionReasonLabel(reason: ExceptionReason): string {
  switch (reason) {
    case 'unanswered':
      return 'Unanswered';
    case 'negative':
      return 'No / Partially';
    case 'missing_evidence':
      return 'Missing evidence';
    default:
      return reason;
  }
}

export type DecisionOutcome = 'approved' | 'conditional' | 'remediate' | 'rejected';
