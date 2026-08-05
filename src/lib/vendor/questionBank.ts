import type { AnswerValue, FrameworkId, QuestionCategory, QuestionType } from './types';

export interface PortalQuestion {
  id: string;
  /** Durable control identity - stable across pack versions and positional renumbering. */
  controlKey: string;
  category: QuestionCategory;
  question: string;
  type: QuestionType;
  /** Yes/No/Partially/N/A for 'yesno'; the question's own answer choices for single/multiple choice. */
  options: string[];
  required: boolean;
}

const OPTIONS: AnswerValue[] = ['Yes', 'No', 'Partially', 'Not Applicable'];

interface BankItem {
  /** Durable control identity used for answer reuse, pack diffs, and trust exchange. */
  controlKey: string;
  category: QuestionCategory;
  text: string;
  /** Every framework whose control this question actually satisfies. Shared across
   * multiple frameworks on purpose - that overlap is what makes cross-framework
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
    controlKey: 'do_you_maintain_a_documented_information_security_policy_rev',
    category: 'Company Profile',
    text: 'Do you maintain a documented information security policy reviewed at least annually?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'is_there_a_designated_security_owner_accountable_for_vendor_',
    category: 'Company Profile',
    text: 'Is there a designated security owner accountable for vendor security commitments?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'do_you_maintain_current_soc_2_iso_27001_or_equivalent_third_',
    category: 'Company Profile',
    text: 'Do you maintain current SOC 2, ISO 27001, or equivalent third-party attestations?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001'],
  },
  {
    controlKey: 'do_you_maintain_a_formal_inventory_of_hardware_and_software_',
    category: 'Company Profile',
    text: 'Do you maintain a formal inventory of hardware and software assets?',
    frameworks: ['nist_csf_2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'do_you_maintain_a_data_classification_policy_distinguishing_',
    category: 'Company Profile',
    text: 'Do you maintain a data classification policy distinguishing sensitive or regulated data?',
    frameworks: ['iso27001', 'hipaa', 'pci_dss_4'],
  },
  {
    controlKey: 'is_security_awareness_training_required_annually_for_all_emp',
    category: 'Company Profile',
    text: 'Is security awareness training required annually for all employees?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'are_background_checks_performed_for_employees_with_access_to',
    category: 'Company Profile',
    text: 'Are background checks performed for employees with access to sensitive systems?',
    frameworks: ['soc2', 'iso27001', 'hipaa'],
  },
  {
    controlKey: 'does_a_formal_onboarding_offboarding_process_revoke_system_a',
    category: 'Company Profile',
    text: 'Does a formal onboarding/offboarding process revoke system access promptly upon termination?',
    frameworks: ['soc2', 'iso27001', 'cis_controls'],
  },
  {
    controlKey: 'do_you_perform_an_annual_enterprise_risk_assessment_covering',
    category: 'Company Profile',
    text: 'Do you perform an annual enterprise risk assessment covering third-party and vendor risk?',
    frameworks: ['nist_csf_2', 'iso27001', 'hipaa'],
  },
  {
    controlKey: 'is_security_posture_reported_to_executives_or_the_board_at_l',
    category: 'Company Profile',
    text: 'Is security posture reported to executives or the board at least annually?',
    frameworks: ['nist_csf_2', 'soc2'],
  },
  {
    controlKey: 'is_a_business_associate_agreement_baa_executed_before_handli',
    category: 'Company Profile',
    text: 'Is a Business Associate Agreement (BAA) executed before handling any protected health information?',
    frameworks: ['hipaa'],
  },
  {
    controlKey: 'is_the_cardholder_data_environment_cde_formally_scoped_and_d',
    category: 'Company Profile',
    text: 'Is the cardholder data environment (CDE) formally scoped and documented?',
    frameworks: ['pci_dss_4'],
  },
  {
    controlKey: 'is_there_a_documented_change_management_process_for_producti',
    category: 'Company Profile',
    text: 'Is there a documented change management process for production systems?',
    frameworks: ['soc2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'are_subprocessors_and_vendors_risk_assessed_before_being_onb',
    category: 'Company Profile',
    text: 'Are subprocessors and vendors risk-assessed before being onboarded?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001'],
  },

  // ---- Access Control ----
  {
    controlKey: 'does_your_organization_enforce_multi_factor_authentication_f',
    category: 'Access Control',
    text: 'Does your organization enforce multi-factor authentication for privileged accounts?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'are_user_access_reviews_performed_at_least_quarterly_for_pro',
    category: 'Access Control',
    text: 'Are user access reviews performed at least quarterly for production systems?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'is_least_privilege_access_enforced_for_customer_data_environ',
    category: 'Access Control',
    text: 'Is least-privilege access enforced for customer data environments?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'cis_controls'],
  },
  {
    controlKey: 'are_shared_or_generic_administrative_accounts_prohibited_or_',
    category: 'Access Control',
    text: 'Are shared or generic administrative accounts prohibited or tightly controlled?',
    frameworks: ['soc2', 'iso27001', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'is_a_unique_user_id_assigned_to_every_individual_with_system',
    category: 'Access Control',
    text: 'Is a unique user ID assigned to every individual with system access (no shared logins)?',
    frameworks: ['pci_dss_4', 'hipaa', 'cis_controls'],
  },
  {
    controlKey: 'is_a_password_policy_enforcing_minimum_length_complexity_and',
    category: 'Access Control',
    text: 'Is a password policy enforcing minimum length, complexity, and rotation in place?',
    frameworks: ['pci_dss_4', 'cis_controls', 'iso27001'],
  },
  {
    controlKey: 'is_role_based_access_control_rbac_implemented_for_sensitive_',
    category: 'Access Control',
    text: 'Is role-based access control (RBAC) implemented for sensitive applications?',
    frameworks: ['soc2', 'iso27001', 'hipaa'],
  },
  {
    controlKey: 'does_remote_access_require_a_vpn_or_equivalent_secure_tunnel',
    category: 'Access Control',
    text: 'Does remote access require a VPN or equivalent secure tunnel?',
    frameworks: ['pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'is_a_session_timeout_enforced_for_inactive_privileged_sessio',
    category: 'Access Control',
    text: 'Is a session timeout enforced for inactive privileged sessions?',
    frameworks: ['pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'is_access_to_protected_health_information_limited_strictly_t',
    category: 'Access Control',
    text: 'Is access to protected health information limited strictly to the minimum necessary?',
    frameworks: ['hipaa'],
  },
  {
    controlKey: 'is_physical_access_to_data_centers_or_server_rooms_restricte',
    category: 'Access Control',
    text: 'Is physical access to data centers or server rooms restricted and logged?',
    frameworks: ['soc2', 'iso27001', 'pci_dss_4'],
  },

  // ---- Data Protection ----
  {
    controlKey: 'is_customer_data_encrypted_at_rest_using_industry_standard_a',
    category: 'Data Protection',
    text: 'Is customer data encrypted at rest using industry-standard algorithms (e.g., AES-256)?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'is_data_encrypted_in_transit_tls_1_2_for_all_customer_facing',
    category: 'Data Protection',
    text: 'Is data encrypted in transit (TLS 1.2+) for all customer-facing services?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'do_you_maintain_documented_data_retention_and_secure_deletio',
    category: 'Data Protection',
    text: 'Do you maintain documented data retention and secure deletion procedures?',
    frameworks: ['iso27001', 'hipaa', 'pci_dss_4'],
  },
  {
    controlKey: 'are_backups_tested_for_restore_capability_at_least_annually',
    category: 'Data Protection',
    text: 'Are backups tested for restore capability at least annually?',
    frameworks: ['soc2', 'iso27001', 'cis_controls'],
  },
  {
    controlKey: 'are_backups_encrypted_and_stored_in_a_separate_or_offsite_lo',
    category: 'Data Protection',
    text: 'Are backups encrypted and stored in a separate or offsite location?',
    frameworks: ['iso27001', 'cis_controls'],
  },
  {
    controlKey: 'is_cardholder_data_prohibited_from_storage_after_authorizati',
    category: 'Data Protection',
    text: 'Is cardholder data prohibited from storage after authorization unless required and protected?',
    frameworks: ['pci_dss_4'],
  },
  {
    controlKey: 'is_data_masking_or_tokenization_used_for_sensitive_fields_in',
    category: 'Data Protection',
    text: 'Is data masking or tokenization used for sensitive fields in non-production environments?',
    frameworks: ['pci_dss_4', 'iso27001'],
  },
  {
    controlKey: 'are_data_loss_prevention_dlp_controls_in_place_to_monitor_fo',
    category: 'Data Protection',
    text: 'Are data loss prevention (DLP) controls in place to monitor for sensitive data exfiltration?',
    frameworks: ['iso27001', 'cis_controls'],
  },
  {
    controlKey: 'are_secure_disposal_procedures_followed_for_decommissioned_h',
    category: 'Data Protection',
    text: 'Are secure disposal procedures followed for decommissioned hardware and media?',
    frameworks: ['iso27001', 'hipaa', 'cis_controls'],
  },

  // ---- Incident Response ----
  {
    controlKey: 'do_you_maintain_a_documented_incident_response_plan_that_is_',
    category: 'Incident Response',
    text: 'Do you maintain a documented incident response plan that is tested periodically?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'],
  },
  {
    controlKey: 'can_you_notify_customers_of_a_security_incident_within_contr',
    category: 'Incident Response',
    text: 'Can you notify customers of a security incident within contractually agreed timelines?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa'],
  },
  {
    controlKey: 'do_you_retain_security_logs_for_at_least_90_days_or_longer_i',
    category: 'Incident Response',
    text: 'Do you retain security logs for at least 90 days (or longer if required)?',
    frameworks: ['pci_dss_4', 'cis_controls', 'iso27001'],
  },
  {
    controlKey: 'breach_notification_meets_hipaa_60_day_requirement',
    category: 'Incident Response',
    text: "Do breach notification procedures meet HIPAA's 60-day reporting requirement?",
    frameworks: ['hipaa'],
  },
  {
    controlKey: 'is_a_siem_or_equivalent_log_correlation_system_in_place_for_',
    category: 'Incident Response',
    text: 'Is a SIEM or equivalent log correlation system in place for security monitoring?',
    frameworks: ['nist_csf_2', 'cis_controls', 'pci_dss_4'],
  },
  {
    controlKey: 'is_there_a_defined_incident_severity_classification_and_esca',
    category: 'Incident Response',
    text: 'Is there a defined incident severity classification and escalation matrix?',
    frameworks: ['nist_csf_2', 'iso27001'],
  },
  {
    controlKey: 'is_a_post_incident_root_cause_analysis_and_lessons_learned_p',
    category: 'Incident Response',
    text: 'Is a post-incident root cause analysis and lessons-learned process followed?',
    frameworks: ['nist_csf_2', 'iso27001', 'soc2'],
  },
  {
    controlKey: 'is_there_24_7_monitoring_or_an_on_call_rotation_for_critical',
    category: 'Incident Response',
    text: 'Is there 24/7 monitoring or an on-call rotation for critical security alerts?',
    frameworks: ['cis_controls', 'nist_csf_2'],
  },

  // ---- Business Continuity ----
  {
    controlKey: 'do_you_maintain_a_business_continuity_disaster_recovery_plan',
    category: 'Business Continuity',
    text: 'Do you maintain a business continuity / disaster recovery plan with defined RTO/RPO?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa'],
  },
  {
    controlKey: 'have_you_tested_failover_or_recovery_procedures_in_the_last_',
    category: 'Business Continuity',
    text: 'Have you tested failover or recovery procedures in the last 12 months?',
    frameworks: ['soc2', 'iso27001', 'hipaa'],
  },
  {
    controlKey: 'are_critical_third_party_dependencies_identified_and_monitor',
    category: 'Business Continuity',
    text: 'Are critical third-party dependencies identified and monitored?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001'],
  },
  {
    controlKey: 'is_infrastructure_redundant_across_multiple_availability_zon',
    category: 'Business Continuity',
    text: 'Is infrastructure redundant across multiple availability zones or regions?',
    frameworks: ['iso27001', 'cis_controls'],
  },
  {
    controlKey: 'is_there_a_documented_crisis_communication_plan_for_extended',
    category: 'Business Continuity',
    text: 'Is there a documented crisis communication plan for extended outages?',
    frameworks: ['iso27001', 'soc2'],
  },
  {
    controlKey: 'do_you_run_an_annual_disaster_recovery_tabletop_exercise_wit',
    category: 'Business Continuity',
    text: 'Do you run an annual disaster recovery tabletop exercise with key stakeholders?',
    frameworks: ['nist_csf_2', 'iso27001'],
  },

  // ---- Single choice ----
  {
    controlKey: 'soc2_report_maturity',
    category: 'Company Profile',
    text: "What is the maturity of your organization's SOC 2 report?",
    frameworks: ['soc2'],
    type: 'single_choice',
    choices: ['Type I', 'Type II', 'No SOC 2 report'],
  },
  {
    controlKey: 'how_frequently_does_your_organization_perform_third_party_pe',
    category: 'Incident Response',
    text: 'How frequently does your organization perform third-party penetration testing?',
    frameworks: ['nist_csf_2', 'pci_dss_4', 'cis_controls'],
    type: 'single_choice',
    choices: ['Quarterly or more', 'Semi-annually', 'Annually', 'Not performed'],
  },
  {
    controlKey: 'what_is_the_maximum_credential_rotation_interval_enforced_fo',
    category: 'Access Control',
    text: 'What is the maximum credential rotation interval enforced for privileged accounts?',
    frameworks: ['pci_dss_4', 'cis_controls'],
    type: 'single_choice',
    choices: ['30 days', '90 days', '180 days', 'No enforced rotation'],
  },

  // ---- Multiple choice ----
  {
    controlKey: 'which_of_the_following_third_party_certifications_does_your_',
    category: 'Company Profile',
    text: 'Which of the following third-party certifications does your organization currently hold?',
    frameworks: ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4'],
    type: 'multiple_choice',
    choices: ['ISO 27001', 'SOC 2', 'PCI DSS', 'HIPAA/HITRUST', 'FedRAMP', 'None'],
  },
  {
    controlKey: 'which_authentication_factors_are_supported_for_user_login',
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
    controlKey: 'which_of_the_following_data_protection_controls_are_implemen',
    category: 'Data Protection',
    text: 'Which of the following data protection controls are implemented?',
    frameworks: ['iso27001', 'pci_dss_4'],
    type: 'multiple_choice',
    choices: ['Encryption at rest', 'Encryption in transit', 'Tokenization', 'Data loss prevention (DLP)', 'None of the above'],
  },
];

/** Global bank stamp written onto assessments at create time. Bump when shipping pack content. */
export const QUESTION_BANK_VERSION = '2026.1';

export type BankItemPublic = {
  controlKey: string;
  category: QuestionCategory;
  text: string;
  frameworks: FrameworkId[];
  type?: QuestionType;
  choices?: string[];
};

/** Read-only bank access for pack builders and diffs. */
export function listBankItems(): BankItemPublic[] {
  return BANK.map((item) => ({ ...item }));
}

export function getBankItemByControlKey(controlKey: string): BankItemPublic | undefined {
  return BANK.find((item) => item.controlKey === controlKey);
}

/** Real per-framework count, derived from the bank rather than a hand-maintained number. */
export function countQuestionsForFramework(frameworkId: FrameworkId): number {
  return BANK.filter((item) => item.frameworks.includes(frameworkId)).length;
}

function toPortalQuestions(items: BankItem[]): PortalQuestion[] {
  // Group by category before numbering. BANK is *mostly* category-grouped, but the
  // rich-answer-type questions added later sit at the end in mixed categories — and
  // since the portal walks category by category, raw bank order made the displayed
  // "Question N of M" jump (…14, then 49, then 52). Sorting here keeps the ids, the
  // wizard's review list, and the portal's counter all in the order a vendor actually
  // answers them. Stable sort, so ordering within a category is unchanged.
  const ordered = [...items].sort((a, b) => categoryRank(a.category) - categoryRank(b.category));

  return ordered.map((item, index) => ({
    id: `q_${index + 1}`,
    controlKey: item.controlKey,
    category: item.category,
    question: item.text,
    type: item.type ?? 'yesno',
    options: item.choices ?? [...OPTIONS],
    required: true,
  }));
}

export function buildQuestionsForFrameworks(frameworks: FrameworkId[] = []): PortalQuestion[] {
  // No selection (e.g. Custom Questionnaire before frameworks are chosen) falls back to the full bank.
  const items =
    frameworks.length === 0
      ? BANK
      : BANK.filter((item) => item.frameworks.some((f) => frameworks.includes(f)));
  return toPortalQuestions(items);
}

/** Build portal questions from an explicit controlKey set (pack version filter). */
export function buildQuestionsFromControlKeys(controlKeys: string[]): PortalQuestion[] {
  const keySet = new Set(controlKeys);
  const items = BANK.filter((item) => keySet.has(item.controlKey));
  return toPortalQuestions(items);
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
