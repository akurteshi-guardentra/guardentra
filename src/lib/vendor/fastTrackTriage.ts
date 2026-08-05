/**
 * FastTrack risk triage — five relationship questions → Lite | Standard | Enhanced
 * and a recommended framework set for the assessment wizard.
 * Pure logic only; UI lives in FastTrackTriage.tsx.
 */
import type { FrameworkId } from './types';

export type TriageTier = 'Lite' | 'Standard' | 'Enhanced';

export type DataExposure =
  | 'public'
  | 'internal'
  | 'personal'
  | 'payment'
  | 'health'
  | 'credentials';

export type AccessLevel = 'none' | 'user' | 'privileged' | 'production';

export type BusinessCriticality = 'low' | 'medium' | 'high' | 'critical';

export type RequirementSignal =
  | 'none'
  | 'soc2_customers'
  | 'iso_buyers'
  | 'hipaa'
  | 'pci'
  | 'gov';

export type ReviewCadence = 'annual' | 'semi_annual' | 'quarterly' | 'continuous';

export interface TriageAnswers {
  dataExposure: DataExposure[];
  accessLevel: AccessLevel | null;
  businessCriticality: BusinessCriticality | null;
  requirements: RequirementSignal[];
  reviewCadence: ReviewCadence | null;
}

export interface TriageRecommendation {
  tier: TriageTier;
  frameworks: FrameworkId[];
  /** Target unique question band from FastTrack training (not a hard cap). */
  questionTarget: string;
  vendorTimeTarget: string;
  rationale: string[];
}

export const EMPTY_TRIAGE_ANSWERS: TriageAnswers = {
  dataExposure: [],
  accessLevel: null,
  businessCriticality: null,
  requirements: [],
  reviewCadence: null,
};

export const TRIAGE_QUESTIONS = [
  {
    id: 'dataExposure' as const,
    title: 'What type of information can this vendor access or process?',
    hint: 'Select all that apply. This drives control and evidence depth.',
    multi: true as const,
    options: [
      { value: 'public' as const, label: 'Public or non-sensitive information' },
      { value: 'internal' as const, label: 'Internal business information' },
      { value: 'personal' as const, label: 'Personal information' },
      { value: 'payment' as const, label: 'Payment-card information' },
      { value: 'health' as const, label: 'Protected health information' },
      { value: 'credentials' as const, label: 'Credentials, secrets, or production data' },
    ],
  },
  {
    id: 'accessLevel' as const,
    title: 'What level of system access does this vendor have?',
    hint: 'Privileged or production access increases assessment depth.',
    multi: false as const,
    options: [
      { value: 'none' as const, label: 'No system access (data/docs only)' },
      { value: 'user' as const, label: 'User-level access to our tools' },
      { value: 'privileged' as const, label: 'Admin or privileged access' },
      { value: 'production' as const, label: 'Production systems or infrastructure' },
    ],
  },
  {
    id: 'businessCriticality' as const,
    title: 'How critical is this vendor to operations?',
    hint: 'Business stop if down → Enhanced depth.',
    multi: false as const,
    options: [
      { value: 'low' as const, label: 'Nice-to-have / easy to pause' },
      { value: 'medium' as const, label: 'Important but workaround exists' },
      { value: 'high' as const, label: 'Core workflow dependency' },
      { value: 'critical' as const, label: 'Business stops if unavailable' },
    ],
  },
  {
    id: 'requirements' as const,
    title: 'Which obligations apply to this relationship?',
    hint: 'Select all that apply. Maps industry frameworks when needed.',
    multi: true as const,
    options: [
      { value: 'none' as const, label: 'No special regulatory or customer mandates' },
      { value: 'soc2_customers' as const, label: 'Customers expect SOC 2' },
      { value: 'iso_buyers' as const, label: 'Buyers expect ISO 27001' },
      { value: 'hipaa' as const, label: 'HIPAA / health data obligations' },
      { value: 'pci' as const, label: 'PCI DSS / cardholder data' },
      { value: 'gov' as const, label: 'Government or high-assurance buyers' },
    ],
  },
  {
    id: 'reviewCadence' as const,
    title: 'How often should this vendor be reassessed?',
    hint: 'Higher cadence usually means higher ongoing risk.',
    multi: false as const,
    options: [
      { value: 'annual' as const, label: 'Annually is enough' },
      { value: 'semi_annual' as const, label: 'About twice a year' },
      { value: 'quarterly' as const, label: 'Quarterly' },
      { value: 'continuous' as const, label: 'Continuous / event-driven review' },
    ],
  },
] as const;

const TIER_META: Record<
  TriageTier,
  { questionTarget: string; vendorTimeTarget: string; baseFrameworks: FrameworkId[] }
> = {
  Lite: {
    questionTarget: '12–20',
    vendorTimeTarget: 'Under 10 minutes',
    baseFrameworks: ['soc2'],
  },
  Standard: {
    questionTarget: '30–50',
    vendorTimeTarget: '15–25 minutes',
    baseFrameworks: ['nist_csf_2', 'soc2'],
  },
  Enhanced: {
    questionTarget: '60–100',
    vendorTimeTarget: '30–45 minutes',
    baseFrameworks: ['nist_csf_2', 'soc2', 'iso27001'],
  },
};

export function isTriageComplete(answers: TriageAnswers): boolean {
  return (
    answers.dataExposure.length > 0 &&
    answers.accessLevel !== null &&
    answers.businessCriticality !== null &&
    answers.requirements.length > 0 &&
    answers.reviewCadence !== null
  );
}

/** Score signals from answers; higher → deeper assessment. */
export function scoreTriage(answers: TriageAnswers): number {
  let score = 0;
  const data = new Set(answers.dataExposure);
  if (data.has('internal')) score += 1;
  if (data.has('personal')) score += 2;
  if (data.has('payment') || data.has('health')) score += 3;
  if (data.has('credentials')) score += 3;
  if (data.size === 1 && data.has('public')) score += 0;

  switch (answers.accessLevel) {
    case 'user':
      score += 1;
      break;
    case 'privileged':
      score += 3;
      break;
    case 'production':
      score += 4;
      break;
    default:
      break;
  }

  switch (answers.businessCriticality) {
    case 'medium':
      score += 1;
      break;
    case 'high':
      score += 2;
      break;
    case 'critical':
      score += 4;
      break;
    default:
      break;
  }

  const reqs = answers.requirements.filter((r) => r !== 'none');
  score += Math.min(reqs.length, 3);
  if (reqs.includes('hipaa') || reqs.includes('pci') || reqs.includes('gov')) score += 2;

  switch (answers.reviewCadence) {
    case 'semi_annual':
      score += 1;
      break;
    case 'quarterly':
      score += 2;
      break;
    case 'continuous':
      score += 3;
      break;
    default:
      break;
  }

  return score;
}

export function tierFromScore(score: number): TriageTier {
  if (score <= 3) return 'Lite';
  if (score <= 8) return 'Standard';
  return 'Enhanced';
}

export function frameworksForTriage(answers: TriageAnswers, tier: TriageTier): FrameworkId[] {
  const frameworks = [...TIER_META[tier].baseFrameworks];
  const reqs = new Set(answers.requirements);
  const data = new Set(answers.dataExposure);

  const push = (id: FrameworkId) => {
    if (!frameworks.includes(id)) frameworks.push(id);
  };

  if (reqs.has('hipaa') || data.has('health')) push('hipaa');
  if (reqs.has('pci') || data.has('payment')) push('pci_dss_4');
  if (reqs.has('iso_buyers') && tier !== 'Lite') push('iso27001');
  if (reqs.has('gov') || tier === 'Enhanced') push('cis_controls');
  if (tier === 'Enhanced' && !frameworks.includes('iso27001')) push('iso27001');

  return frameworks;
}

export function buildTriageRationale(answers: TriageAnswers, tier: TriageTier): string[] {
  const lines: string[] = [];
  const data = answers.dataExposure;
  if (data.includes('health') || data.includes('payment') || data.includes('credentials')) {
    lines.push('Sensitive or regulated data exposure raises control depth.');
  } else if (data.includes('personal') || data.includes('internal')) {
    lines.push('Internal or personal data needs a standard control set.');
  } else {
    lines.push('Limited to non-sensitive information — lighter questionnaire.');
  }

  if (answers.accessLevel === 'privileged' || answers.accessLevel === 'production') {
    lines.push('Privileged or production access requires stronger access and resilience controls.');
  }
  if (answers.businessCriticality === 'high' || answers.businessCriticality === 'critical') {
    lines.push('High operational dependency increases resilience and continuity coverage.');
  }
  const special = answers.requirements.filter((r) => r !== 'none');
  if (special.length) {
    lines.push(`Obligation signals: ${special.join(', ').replace(/_/g, ' ')}.`);
  }
  lines.push(`Recommended tier: ${tier}.`);
  return lines;
}

export function recommendFromTriage(answers: TriageAnswers): TriageRecommendation | null {
  if (!isTriageComplete(answers)) return null;
  const score = scoreTriage(answers);
  const tier = tierFromScore(score);
  const meta = TIER_META[tier];
  return {
    tier,
    frameworks: frameworksForTriage(answers, tier),
    questionTarget: meta.questionTarget,
    vendorTimeTarget: meta.vendorTimeTarget,
    rationale: buildTriageRationale(answers, tier),
  };
}

/** Parse wizard `?frameworks=` query (comma-separated FrameworkIds). */
export function parseFrameworksParam(raw: string | null): FrameworkId[] {
  if (!raw?.trim()) return [];
  const allowed = new Set<FrameworkId>([
    'nist_csf_2',
    'soc2',
    'iso27001',
    'hipaa',
    'pci_dss_4',
    'cis_controls',
  ]);
  const out: FrameworkId[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim() as FrameworkId;
    if (allowed.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function frameworksToParam(frameworks: FrameworkId[]): string {
  return frameworks.filter((f) => f !== 'custom').join(',');
}
