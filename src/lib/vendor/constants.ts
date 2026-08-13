import type { FrameworkDefinition, FrameworkId, RiskLevel } from './types';
import { countQuestionsForFramework } from './questionBank';
import { getCurrentPack } from './frameworkPacks';

export const FRAMEWORK_CATALOG: FrameworkDefinition[] = [
  {
    id: 'nist_csf_2',
    name: 'NIST CSF 2.0',
    description: 'Cybersecurity risk and controls',
    questionCount: countQuestionsForFramework('nist_csf_2'),
  },
  {
    id: 'soc2',
    name: 'SOC 2',
    description: 'Security, availability, and confidentiality',
    questionCount: countQuestionsForFramework('soc2'),
  },
  {
    id: 'iso27001',
    name: 'ISO 27001',
    description: 'Information security management',
    questionCount: countQuestionsForFramework('iso27001'),
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    description: 'Protected health information',
    questionCount: countQuestionsForFramework('hipaa'),
  },
  {
    id: 'pci_dss_4',
    name: 'PCI DSS 4.0',
    description: 'Payment card security',
    questionCount: countQuestionsForFramework('pci_dss_4'),
  },
  {
    id: 'cis_controls',
    name: 'CIS Controls',
    description: 'Technical security safeguards',
    questionCount: countQuestionsForFramework('cis_controls'),
  },
  {
    id: 'custom',
    name: 'Custom Questionnaire',
    description: 'Not available yet — use a standard framework pack',
    questionCount: 0,
  },
];

/** Onboarding picks — same FrameworkIds as the vendor catalog (no parallel id system). */
export const ONBOARDING_FRAMEWORKS: {
  id: FrameworkId;
  name: string;
  desc: string;
}[] = [
  {
    id: 'iso27001',
    name: getCurrentPack('iso27001')?.displayName || 'ISO 27001:2022',
    desc: 'The certification enterprise buyers ask for most often in security reviews.',
  },
  {
    id: 'soc2',
    name: 'SOC 2 Type II',
    desc: 'Audited proof of how you handle security, availability and confidentiality over time.',
  },
  {
    id: 'nist_csf_2',
    name: getCurrentPack('nist_csf_2')?.displayName || 'NIST CSF 2.0',
    desc: 'A practical control baseline. Common in US public sector and critical infrastructure.',
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    desc: 'Required if you or your vendors touch protected health information.',
  },
];

export const VENDOR_CATEGORIES = [
  'Cloud Services',
  'Data Processing',
  'IT Services',
  'SaaS',
  'Professional Services',
  'Infrastructure',
  'Other',
] as const;

export const RISK_LEVELS: RiskLevel[] = ['Critical', 'High', 'Medium', 'Low'];

export const EVIDENCE_ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
] as const;

export const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024; // 25MB
