import type { AnswerValue, FrameworkId, QuestionCategory, QuestionType } from './types';

export interface PortalQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  type: QuestionType;
  /** Yes/No/Partially/N/A for 'yesno'; the question's own answer choices for single/multiple choice. */
  options: string[];
  required: boolean;
}

const OPTIONS: AnswerValue[] = ['Yes', 'No', 'Partially', 'Not Applicable'];

interface BankItem {
  category: QuestionCategory;
  text: string;
  /** Every framework whose control this question actually satisfies. Shared across
   * multiple frameworks on purpose — that overlap is what makes cross-framework
   * dedup real: a vendor answers this once even if 3 selected frameworks require it. */
  frameworks: FrameworkId[];
  /** Defaults to 'yesno'. single_choice/multiple_choice must set their own `choices`. */
  type?: QuestionType;
  choices?: string[];
}

/**
 * Real, framework-tagged control bank (not a generic placeholder list). Selecting
 * multiple frameworks in the wizard naturally yields fewer unique questions than
 * the sum of each framework's count, because shared controls (MFA, encryption,
 * incident response, etc.) appear once here but are tagged against every
 * framework that actually requires them.
 */
const BANK: BankItem[] = [
  // ---- Company Profile ----
  {
    category: 'Company Profile',
    text: 'Do you maintain a documented information security policy reviewed at least annually?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Company Profile',
    text: 'Is there a designated security owner accountable for vendor security commitments?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Company Profile',
    text: 'Do you maintain current SOC 2, ISO 27001, or equivalent third-party attestations?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001'],
  },
  {
    category: 'Company Profile',
    text: 'Do you maintain a formal inventory of hardware and software assets?',
    frameworks: ['nist_csf_2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Company Profile',
    text: 'Do you maintain a data classification policy distinguishing sensitive or regulated data?',
    frameworks: ['iso27001', 'hipaa', 'pci_dss_4'],
  },
  {
    category: 'Company Profile',
    text: 'Is security awareness training required annually for all employees?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Company Profile',
    text: 'Are background checks performed for employees with access to sensitive systems?',
    frameworks: ['soc2', 'iso27001', 'hipaa'],
  },
  {
    category: 'Company Profile',
    text: 'Does a formal onboarding/offboarding process revoke system access promptly upon termination?',
    frameworks: ['soc2', 'iso27001', 'cis_controls'],
  },
  {
    category: 'Company Profile',
    text: 'Do you perform an annual enterprise risk assessment covering third-party and vendor risk?',
    frameworks: ['nist_csf_2', 'iso27001', 'hipaa'],
  },
  {
    category: 'Company Profile',
    text: 'Is security posture reported to executives or the board at least annually?',
    frameworks: ['nist_csf_2', 'soc2'],
  },
  {
    category: 'Company Profile',
    text: 'Is a Business Associate Agreement (BAA) executed before handling any protected health information?',
    frameworks: ['hipaa'],
  },
  {
    category: 'Company Profile',
    text: 'Is the cardholder data environment (CDE) formally scoped and documented?',
    frameworks: ['pci_dss_4'],
  },
  {
    category: 'Company Profile',
    text: 'Is there a documented change management process for production systems?',
    frameworks: ['soc2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Company Profile',
    text: 'Are subprocessors and vendors risk-assessed before being onboarded?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001'],
  },

  // ---- Access Control ----
  {
    category: 'Access Control',
    text: 'Does your organization enforce multi-factor authentication for privileged accounts?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Access Control',
    text: 'Are user access reviews performed at least quarterly for production systems?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Access Control',
    text: 'Is least-privilege access enforced for customer data environments?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'cis_controls'],
  },
  {
    category: 'Access Control',
    text: 'Are shared or generic administrative accounts prohibited or tightly controlled?',
    frameworks: ['soc2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Access Control',
    text: 'Is a unique user ID assigned to every individual with system access (no shared logins)?',
    frameworks: ['pci_dss_4', 'hipaa', 'cis_controls'],
  },
  {
    category: 'Access Control',
    text: 'Is a password policy enforcing minimum length, complexity, and rotation in place?',
    frameworks: ['pci_dss_4', 'cis_controls', 'iso27001'],
  },
  {
    category: 'Access Control',
    text: 'Is role-based access control (RBAC) implemented for sensitive applications?',
    frameworks: ['soc2', 'iso27001', 'hipaa'],
  },
  {
    category: 'Access Control',
    text: 'Does remote access require a VPN or equivalent secure tunnel?',
    frameworks: ['pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Access Control',
    text: 'Is a session timeout enforced for inactive privileged sessions?',
    frameworks: ['pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Access Control',
    text: 'Is access to protected health information limited strictly to the minimum necessary?',
    frameworks: ['hipaa'],
  },
  {
    category: 'Access Control',
    text: 'Is physical access to data centers or server rooms restricted and logged?',
    frameworks: ['soc2', 'iso27001', 'pci_dss_4'],
  },

  // ---- Data Protection ----
  {
    category: 'Data Protection',
    text: 'Is customer data encrypted at rest using industry-standard algorithms (e.g., AES-256)?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Data Protection',
    text: 'Is data encrypted in transit (TLS 1.2+) for all customer-facing services?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Data Protection',
    text: 'Do you maintain documented data retention and secure deletion procedures?',
    frameworks: ['iso27001', 'hipaa', 'pci_dss_4'],
  },
  {
    category: 'Data Protection',
    text: 'Are backups tested for restore capability at least annually?',
    frameworks: ['soc2', 'iso27001', 'cis_controls'],
  },
  {
    category: 'Data Protection',
    text: 'Are backups encrypted and stored in a separate or offsite location?',
    frameworks: ['iso27001', 'cis_controls'],
  },
  {
    category: 'Data Protection',
    text: 'Is cardholder data prohibited from storage after authorization unless required and protected?',
    frameworks: ['pci_dss_4'],
  },
  {
    category: 'Data Protection',
    text: 'Is data masking or tokenization used for sensitive fields in non-production environments?',
    frameworks: ['pci_dss_4', 'iso27001'],
  },
  {
    category: 'Data Protection',
    text: 'Are data loss prevention (DLP) controls in place to monitor for sensitive data exfiltration?',
    frameworks: ['iso27001', 'cis_controls'],
  },
  {
    category: 'Data Protection',
    text: 'Are secure disposal procedures followed for decommissioned hardware and media?',
    frameworks: ['iso27001', 'hipaa', 'cis_controls'],
  },

  // ---- Incident Response ----
  {
    category: 'Incident Response',
    text: 'Do you maintain a documented incident response plan that is tested periodically?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    category: 'Incident Response',
    text: 'Can you notify customers of a security incident within contractually agreed timelines?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa'],
  },
  {
    category: 'Incident Response',
    text: 'Do you retain security logs for at least 90 days (or longer if required)?',
    frameworks: ['pci_dss_4', 'cis_controls', 'iso27001'],
  },
  {
    category: 'Incident Response',
    text: "Do breach notification procedures meet HIPAA's 60-day reporting requirement?",
    frameworks: ['hipaa'],
  },
  {
    category: 'Incident Response',
    text: 'Is a SIEM or equivalent log correlation system in place for security monitoring?',
    frameworks: ['nist_csf_2', 'cis_controls', 'pci_dss_4'],
  },
  {
    category: 'Incident Response',
    text: 'Is there a defined incident severity classification and escalation matrix?',
    frameworks: ['nist_csf_2', 'iso27001'],
  },
  {
    category: 'Incident Response',
    text: 'Is a post-incident root cause analysis and lessons-learned process followed?',
    frameworks: ['nist_csf_2', 'iso27001', 'soc2'],
  },
  {
    category: 'Incident Response',
    text: 'Is there 24/7 monitoring or an on-call rotation for critical security alerts?',
    frameworks: ['cis_controls', 'nist_csf_2'],
  },

  // ---- Business Continuity ----
  {
    category: 'Business Continuity',
    text: 'Do you maintain a business continuity / disaster recovery plan with defined RTO/RPO?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa'],
  },
  {
    category: 'Business Continuity',
    text: 'Have you tested failover or recovery procedures in the last 12 months?',
    frameworks: ['soc2', 'iso27001', 'hipaa'],
  },
  {
    category: 'Business Continuity',
    text: 'Are critical third-party dependencies identified and monitored?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001'],
  },
  {
    category: 'Business Continuity',
    text: 'Is infrastructure redundant across multiple availability zones or regions?',
    frameworks: ['iso27001', 'cis_controls'],
  },
  {
    category: 'Business Continuity',
    text: 'Is there a documented crisis communication plan for extended outages?',
    frameworks: ['iso27001', 'soc2'],
  },
  {
    category: 'Business Continuity',
    text: 'Do you run an annual disaster recovery tabletop exercise with key stakeholders?',
    frameworks: ['nist_csf_2', 'iso27001'],
  },

  // ---- Single choice ----
  {
    category: 'Company Profile',
    text: "What is the maturity of your organization's SOC 2 report?",
    frameworks: ['soc2'],
    type: 'single_choice',
    choices: ['Type I', 'Type II', 'No SOC 2 report'],
  },
  {
    category: 'Incident Response',
    text: 'How frequently does your organization perform third-party penetration testing?',
    frameworks: ['nist_csf_2', 'pci_dss_4', 'cis_controls'],
    type: 'single_choice',
    choices: ['Quarterly or more', 'Semi-annually', 'Annually', 'Not performed'],
  },
  {
    category: 'Access Control',
    text: 'What is the maximum credential rotation interval enforced for privileged accounts?',
    frameworks: ['pci_dss_4', 'cis_controls'],
    type: 'single_choice',
    choices: ['30 days', '90 days', '180 days', 'No enforced rotation'],
  },

  // ---- Multiple choice ----
  {
    category: 'Company Profile',
    text: 'Which of the following third-party certifications does your organization currently hold?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4'],
    type: 'multiple_choice',
    choices: ['ISO 27001', 'SOC 2', 'PCI DSS', 'HIPAA/HITRUST', 'FedRAMP', 'None'],
  },
  {
    category: 'Access Control',
    text: 'Which authentication factors are supported for user login?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'cis_controls'],
    type: 'multiple_choice',
    choices: [
      'Password',
      'SMS one-time code',
      'Authenticator app (TOTP)',
      'Hardware security key (FIDO2)',
      'Biometric',
    ],
  },
  {
    category: 'Data Protection',
    text: 'Which of the following data protection controls are implemented?',
    frameworks: ['iso27001', 'pci_dss_4'],
    type: 'multiple_choice',
    choices: ['Encryption at rest', 'Encryption in transit', 'Tokenization', 'Data loss prevention (DLP)', 'None of the above'],
  },
];

/** Real per-framework count, derived from the bank rather than a hand-maintained number. */
export function countQuestionsForFramework(frameworkId: FrameworkId): number {
  return BANK.filter((item) => item.frameworks.includes(frameworkId)).length;
}

export function buildQuestionsForFrameworks(frameworks: FrameworkId[] = []): PortalQuestion[] {
  // No selection (e.g. Custom Questionnaire before frameworks are chosen) falls back to the full bank.
  const items =
    frameworks.length === 0
      ? BANK
      : BANK.filter((item) => item.frameworks.some((f) => frameworks.includes(f)));

  // Group by category before numbering. BANK is *mostly* category-grouped, but the
  // rich-answer-type questions added later sit at the end in mixed categories — and
  // since the portal walks category by category, raw bank order made the displayed
  // "Question N of M" jump (…14, then 49, then 52). Sorting here keeps the ids, the
  // wizard's review list, and the portal's counter all in the order a vendor actually
  // answers them. Stable sort, so ordering within a category is unchanged.
  const ordered = [...items].sort((a, b) => categoryRank(a.category) - categoryRank(b.category));

  return ordered.map((item, index) => ({
    id: `q_${index + 1}`,
    category: item.category,
    question: item.text,
    type: item.type ?? 'yesno',
    options: item.choices ?? [...OPTIONS],
    required: true,
  }));
}

/** Position of a category in the portal's rail order; unknown categories sort last. */
function categoryRank(category: QuestionCategory): number {
  const i = QUESTION_CATEGORIES.indexOf(category);
  return i === -1 ? QUESTION_CATEGORIES.length : i;
}

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  'Company Profile',
  'Access Control',
  'Data Protection',
  'Incident Response',
  'Business Continuity',
];

/** An unanswered multiple_choice question defaults to []; an array is only "answered" if non-empty. */
export function isAnswered(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

export function categoryProgress(
  questions: PortalQuestion[],
  answers: Record<string, AnswerValue | string | string[] | undefined>
): Record<QuestionCategory, { total: number; answered: number }> {
  const result = Object.fromEntries(
    QUESTION_CATEGORIES.map((c) => [c, { total: 0, answered: 0 }])
  ) as Record<QuestionCategory, { total: number; answered: number }>;

  for (const q of questions) {
    result[q.category].total += 1;
    if (isAnswered(answers[q.id])) result[q.category].answered += 1;
  }
  return result;
}

export function overallProgressPct(
  questions: PortalQuestion[],
  answers: Record<string, AnswerValue | string | string[] | undefined>
): number {
  if (!questions.length) return 0;
  const answered = questions.filter((q) => isAnswered(answers[q.id])).length;
  return Math.round((answered / questions.length) * 100);
}
