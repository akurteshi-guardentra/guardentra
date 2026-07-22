import type { FrameworkDefinition, RiskLevel } from './types';

export const FRAMEWORK_CATALOG: FrameworkDefinition[] = [
  {
    id: 'nist_csf_2',
    name: 'NIST CSF 2.0',
    description: 'Cybersecurity risk and controls',
    questionCount: 42,
  },
  {
    id: 'soc2',
    name: 'SOC 2',
    description: 'Security, availability, and confidentiality',
    questionCount: 36,
  },
  {
    id: 'iso27001',
    name: 'ISO 27001',
    description: 'Information security management',
    questionCount: 48,
  },
  {
    id: 'hipaa',
    name: 'HIPAA',
    description: 'Protected health information',
    questionCount: 34,
  },
  {
    id: 'pci_dss_4',
    name: 'PCI DSS 4.0',
    description: 'Payment card security',
    questionCount: 40,
  },
  {
    id: 'cis_controls',
    name: 'CIS Controls',
    description: 'Technical security safeguards',
    questionCount: 30,
  },
  {
    id: 'custom',
    name: 'Custom Questionnaire',
    description: 'Create or upload your own questions',
    questionCount: 0,
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
