/**
 * Vendor / TPRM domain contract (mockups 1–3).
 * All tenant documents must include organizationId.
 */

export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type VendorStatus = 'Active' | 'Pending' | 'Terminated';
export type AssessmentStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Due Soon'
  | 'Overdue'
  | 'Completed'
  | 'Sent';

export type AnswerValue = 'Yes' | 'No' | 'Partially' | 'Not Applicable';

export type FrameworkId =
  | 'nist_csf_2'
  | 'soc2'
  | 'iso27001'
  | 'hipaa'
  | 'pci_dss_4'
  | 'cis_controls'
  | 'custom';

/** Firestore: vendors/{vendorId} */
export interface Vendor {
  id: string;
  name: string;
  category: string;
  criticality: RiskLevel;
  status: VendorStatus;
  riskScore: number;
  organizationId: string;
  createdAt: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  ownerId?: string;
  ownerName?: string;
  nextReviewAt?: string;
  lastAssessmentAt?: string;
  assessmentStatus?: AssessmentStatus;
  reputation?: string;
  riskTier?: string;
  trustScore?: number;
  complianceStatus?: string;
  briefing?: string;
  /** Business-impact track (Cynomi-style dual assessment). */
  impactLevel?: RiskLevel;
  impactCompletedAt?: string;
  impactCompletedBy?: string;
  impactNotes?: string;
  /** Final rating once impact + security residual are both present. */
  finalRating?: RiskLevel;
  /** Vendor-level general attachments (contracts, SOC reports, etc.). */
  attachments?: {
    fileName: string;
    contentType: string;
    sizeBytes: number;
    storagePath: string;
    downloadUrl?: string;
    uploadedAt: string;
    uploadedBy?: string;
  }[];
}

/** Firestore: assessments/{assessmentId} (also legacy vendor_assessments) */
export interface VendorAssessment {
  id: string;
  vendorId: string;
  vendorName?: string;
  organizationId: string;
  frameworks: FrameworkId[];
  status: AssessmentStatus;
  dueAt?: string;
  progressPct: number;
  questionCount?: number;
  sourceQuestionCount?: number;
  createdAt: string;
  sentAt?: string;
  completedAt?: string;
  inviteEmail?: string;
  /** Legacy fields from older VendorRisk UI */
  type?: string;
  summary?: string;
  findings?: string[];
  score?: number;
}

export interface FrameworkDefinition {
  id: FrameworkId;
  name: string;
  description: string;
  questionCount: number;
}

export type QuestionCategory =
  | 'Company Profile'
  | 'Access Control'
  | 'Data Protection'
  | 'Incident Response'
  | 'Business Continuity';

export interface AssessmentQuestion {
  id: string;
  assessmentId: string;
  organizationId: string;
  category: QuestionCategory;
  text: string;
  order: number;
  frameworkIds: FrameworkId[];
  required: boolean;
}

export interface AssessmentResponse {
  id: string;
  assessmentId: string;
  questionId: string;
  organizationId: string;
  answer?: AnswerValue;
  comment?: string;
  evidenceFileIds?: string[];
  updatedAt: string;
  answeredBy?: string;
}

export interface EvidenceFile {
  id: string;
  organizationId: string;
  vendorId: string;
  assessmentId?: string;
  questionId?: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  downloadUrl?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

/** Storage path helper: orgs/{orgId}/vendors/{vendorId}/evidence/{fileId}-{fileName} */
export function evidenceStoragePath(
  orgId: string,
  vendorId: string,
  fileId: string,
  fileName: string
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `orgs/${orgId}/vendors/${vendorId}/evidence/${fileId}-${safe}`;
}

export const COLLECTIONS = {
  vendors: 'vendors',
  assessments: 'assessments',
  /** Legacy collection still used in places */
  vendorAssessments: 'vendor_assessments',
  assessmentQuestions: 'assessment_questions',
  assessmentResponses: 'assessment_responses',
  evidence: 'evidence',
  vendorInvites: 'vendor_invites',
} as const;
