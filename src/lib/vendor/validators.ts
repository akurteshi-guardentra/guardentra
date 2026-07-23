import { EVIDENCE_ALLOWED_TYPES, EVIDENCE_MAX_BYTES } from './constants';
import type { FrameworkId, RiskLevel, VendorStatus } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface VendorFormInput {
  name: string;
  category: string;
  criticality: RiskLevel;
  status?: VendorStatus;
  primaryContactName?: string;
  primaryContactEmail?: string;
}

export function validateVendorForm(input: VendorFormInput): string | null {
  if (!input.name?.trim()) return 'Vendor name is required.';
  if (input.name.trim().length < 2) return 'Vendor name must be at least 2 characters.';
  if (!input.category?.trim()) return 'Category is required.';
  if (!input.criticality) return 'Criticality is required.';
  if (input.primaryContactEmail?.trim() && !EMAIL_RE.test(input.primaryContactEmail.trim())) {
    return 'Primary contact email is invalid.';
  }
  return null;
}

export function validateAssessmentWizard(input: {
  vendorId?: string;
  frameworks?: FrameworkId[];
}): string | null {
  if (!input.vendorId) return 'Select a vendor to continue.';
  if (!input.frameworks?.length) return 'Select at least one framework.';
  return null;
}

export function validateEvidenceFile(file: File): string | null {
  if (file.size > EVIDENCE_MAX_BYTES) {
    return 'File must be 25MB or smaller.';
  }
  const allowed = EVIDENCE_ALLOWED_TYPES as readonly string[];
  const byExt = /\.(pdf|docx?|xlsx?|png|jpe?g)$/i.test(file.name);
  if (!allowed.includes(file.type) && !byExt) {
    return 'Allowed types: PDF, DOCX, XLSX, PNG, JPG.';
  }
  return null;
}

export interface BulkVendorRow {
  name?: string;
  category?: string;
  criticality?: string;
  primaryContactEmail?: string;
}

export function validateBulkVendorRow(row: BulkVendorRow, index: number): string | null {
  const label = `Row ${index + 1}`;
  if (!row.name?.trim()) return `${label}: name is required.`;
  if (!row.category?.trim()) return `${label}: category is required.`;
  const crit = row.criticality?.trim();
  if (
    crit &&
    !['Critical', 'High', 'Medium', 'Low'].some((level) => level.toLowerCase() === crit.toLowerCase())
  ) {
    return `${label}: criticality must be Critical, High, Medium, or Low.`;
  }
  if (row.primaryContactEmail?.trim() && !EMAIL_RE.test(row.primaryContactEmail.trim())) {
    return `${label}: invalid email.`;
  }
  return null;
}
