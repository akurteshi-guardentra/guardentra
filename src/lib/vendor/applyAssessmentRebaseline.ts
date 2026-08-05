/**
 * Explicit rebaseline of an open assessment onto new pack versions.
 * Completed / under-review assessments must not be mutated — create a new assessment instead.
 */
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { rebaselineAssessment } from './frameworkPacks';

export async function applyAssessmentRebaseline(opts: {
  assessmentId: string;
  targetPackIds: string[];
}): Promise<{ unmatchedCount: number }> {
  const snap = await getDoc(doc(db, 'assessments', opts.assessmentId));
  if (!snap.exists()) throw new Error('Assessment not found');
  const data = snap.data() as {
    questions?: Array<{ id: string; controlKey?: string; question?: string }>;
    answers?: Record<string, string | string[]>;
    status?: string;
  };
  if (data.status === 'Completed' || data.status === 'Under Review') {
    throw new Error('Completed assessments cannot be rebaselined — create a new assessment instead.');
  }
  const result = rebaselineAssessment({
    questions: data.questions || [],
    answers: data.answers,
    targetPackIds: opts.targetPackIds,
  });
  await updateDoc(doc(db, 'assessments', opts.assessmentId), {
    questions: result.questions,
    answers: result.carriedAnswers,
    frameworkPackIds: result.frameworkPackIds,
    questionBankVersion: result.questionBankVersion,
    questionCount: result.questions.length,
    progressPct: 0,
    progress: 0,
    rebaselinedAt: new Date().toISOString(),
    unmatchedAnswersOnRebaseline: result.unmatchedAnswers,
  });
  return { unmatchedCount: result.unmatchedAnswers.length };
}
