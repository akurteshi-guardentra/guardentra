import type { AssessmentStatus, Vendor } from '../../lib/vendor/types';
import { deriveStatusFromAssessments } from '../../lib/vendor/localAssessmentStore';

export function deriveAssessmentStatus(
  vendor: Vendor,
  linkedAssessments?: { status?: string; dueAt?: string; dueDate?: string; progressPct?: number; progress?: number }[]
): AssessmentStatus {
  if (linkedAssessments?.length) {
    const fromAsm = deriveStatusFromAssessments(
      linkedAssessments as Parameters<typeof deriveStatusFromAssessments>[0]
    );
    if (fromAsm) return fromAsm;
  }
  if (vendor.assessmentStatus) return vendor.assessmentStatus;
  if (vendor.nextReviewAt) {
    const due = new Date(vendor.nextReviewAt).getTime();
    const soon = Date.now() + 14 * 24 * 60 * 60 * 1000;
    if (due < Date.now()) return 'Overdue';
    if (due < soon) return 'Due Soon';
  }
  return 'Not Started';
}
