import type { AnswerValue, FrameworkId, QuestionCategory } from './types';

export interface PortalQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  options: AnswerValue[];
  required: boolean;
}

const OPTIONS: AnswerValue[] = ['Yes', 'No', 'Partially', 'Not Applicable'];

/** Lightweight default bank used when AI/framework dedupe is not yet materialized. */
const BANK: Array<{ category: QuestionCategory; text: string; frameworks?: FrameworkId[] }> = [
  { category: 'Company Profile', text: 'Do you maintain a documented information security policy reviewed at least annually?' },
  { category: 'Company Profile', text: 'Is there a designated security owner accountable for vendor security commitments?' },
  { category: 'Company Profile', text: 'Do you maintain current SOC 2, ISO 27001, or equivalent attestations?' },
  { category: 'Access Control', text: 'Does your organization enforce multi-factor authentication for privileged accounts?' },
  { category: 'Access Control', text: 'Are user access reviews performed at least quarterly for production systems?' },
  { category: 'Access Control', text: 'Is least-privilege access enforced for customer data environments?' },
  { category: 'Access Control', text: 'Are shared administrative accounts prohibited or tightly controlled?' },
  { category: 'Data Protection', text: 'Is customer data encrypted at rest using industry-standard algorithms?' },
  { category: 'Data Protection', text: 'Is data encrypted in transit (TLS 1.2+) for all customer-facing services?' },
  { category: 'Data Protection', text: 'Do you maintain data retention and secure deletion procedures?' },
  { category: 'Data Protection', text: 'Are backups tested for restore capability at least annually?' },
  { category: 'Incident Response', text: 'Do you maintain a documented incident response plan that is tested periodically?' },
  { category: 'Incident Response', text: 'Can you notify customers of a security incident within contractually agreed timelines?' },
  { category: 'Incident Response', text: 'Do you retain security logs for at least 90 days (or longer if required)?' },
  { category: 'Business Continuity', text: 'Do you maintain a business continuity / disaster recovery plan with defined RTO/RPO?' },
  { category: 'Business Continuity', text: 'Have you tested failover or recovery procedures in the last 12 months?' },
  { category: 'Business Continuity', text: 'Are critical third-party dependencies identified and monitored?' },
];

export function buildQuestionsForFrameworks(frameworks: FrameworkId[] = []): PortalQuestion[] {
  // Until full dedupe lands, return the full bank (already unique). Frameworks reserved for future filtering.
  void frameworks;
  return BANK.map((item, index) => ({
    id: `q_${index + 1}`,
    category: item.category,
    question: item.text,
    options: [...OPTIONS],
    required: true,
  }));
}

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  'Company Profile',
  'Access Control',
  'Data Protection',
  'Incident Response',
  'Business Continuity',
];

export function categoryProgress(
  questions: PortalQuestion[],
  answers: Record<string, AnswerValue | undefined>
): Record<QuestionCategory, { total: number; answered: number }> {
  const result = Object.fromEntries(
    QUESTION_CATEGORIES.map((c) => [c, { total: 0, answered: 0 }])
  ) as Record<QuestionCategory, { total: number; answered: number }>;

  for (const q of questions) {
    result[q.category].total += 1;
    if (answers[q.id]) result[q.category].answered += 1;
  }
  return result;
}

export function overallProgressPct(
  questions: PortalQuestion[],
  answers: Record<string, AnswerValue | undefined>
): number {
  if (!questions.length) return 0;
  const answered = questions.filter((q) => answers[q.id]).length;
  return Math.round((answered / questions.length) * 100);
}
