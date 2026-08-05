import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  isFirestoreUnavailableError,
  markLocalVendorAssessmentSent,
  patchLocalVendor,
} from './localVendorStore';

/**
 * Sync vendor chip fields after creating a security assessment.
 * New assessments are Sent (awaiting vendor) — not In Progress until answers arrive.
 */
export async function syncVendorAfterAssessmentCreate(
  orgId: string,
  vendorId: string,
  preferLocal: boolean
): Promise<void> {
  const patch = {
    assessmentStatus: 'Sent' as const,
    lastAssessmentAt: new Date().toISOString(),
  };

  if (preferLocal || vendorId.startsWith('local_')) {
    markLocalVendorAssessmentSent(orgId, vendorId);
    return;
  }

  try {
    const writeTimeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        const err = new Error('Cloud vendor status update timed out');
        (err as { code?: string }).code = 'unavailable';
        reject(err);
      }, 4000);
    });
    await Promise.race([updateDoc(doc(db, 'vendors', vendorId), patch), writeTimeout]);
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      markLocalVendorAssessmentSent(orgId, vendorId);
    }
  }
}

/** After vendor starts answering — move chip from Sent → In Progress. */
export async function syncVendorAfterAssessmentProgress(
  orgId: string,
  vendorId: string,
  preferLocal: boolean
): Promise<void> {
  const patch = {
    assessmentStatus: 'In Progress' as const,
  };

  if (preferLocal || vendorId.startsWith('local_')) {
    patchLocalVendor(orgId, vendorId, patch);
    return;
  }

  try {
    await updateDoc(doc(db, 'vendors', vendorId), patch);
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      patchLocalVendor(orgId, vendorId, patch);
    }
  }
}

/** After vendor submits for org review. */
export async function syncVendorAfterAssessmentSubmit(
  orgId: string,
  vendorId: string,
  preferLocal: boolean
): Promise<void> {
  const patch = {
    assessmentStatus: 'Under Review' as const,
  };

  if (preferLocal || vendorId.startsWith('local_')) {
    patchLocalVendor(orgId, vendorId, patch);
    return;
  }

  try {
    await updateDoc(doc(db, 'vendors', vendorId), patch);
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      patchLocalVendor(orgId, vendorId, patch);
    }
  }
}

/** After org approves an assessment — close the vendor loop and schedule next review. */
export async function syncVendorAfterAssessmentApprove(
  orgId: string,
  vendorId: string,
  preferLocal: boolean,
  nextReviewAt: string
): Promise<void> {
  const patch = {
    assessmentStatus: 'Completed' as const,
    lastAssessmentAt: new Date().toISOString(),
    nextReviewAt,
  };

  if (preferLocal || vendorId.startsWith('local_')) {
    patchLocalVendor(orgId, vendorId, patch);
    return;
  }

  try {
    await updateDoc(doc(db, 'vendors', vendorId), patch);
  } catch (err) {
    if (isFirestoreUnavailableError(err)) {
      patchLocalVendor(orgId, vendorId, patch);
    } else {
      throw err;
    }
  }
}
