import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  isFirestoreUnavailableError,
  markLocalVendorAssessmentSent,
  patchLocalVendor,
} from './localVendorStore';

/**
 * Sync vendor chip fields after creating a security assessment.
 * Creation alone is not delivery proof, so the vendor stays Not Started until the
 * authoritative invite queue accepts the assessment notification.
 */
export async function syncVendorAfterAssessmentCreate(
  orgId: string,
  vendorId: string,
  preferLocal: boolean
): Promise<void> {
  const patch = {
    assessmentStatus: 'Not Started' as const,
    lastAssessmentAt: new Date().toISOString(),
  };

  if (preferLocal || vendorId.startsWith('local_')) {
    patchLocalVendor(orgId, vendorId, patch);
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
      patchLocalVendor(orgId, vendorId, patch);
    }
  }
}

/** Queue acceptance is the boundary that makes the vendor chip truthfully Sent. */
export async function syncVendorAfterAssessmentSent(
  orgId: string,
  vendorId: string,
  preferLocal: boolean
): Promise<void> {
  if (preferLocal || vendorId.startsWith('local_')) {
    markLocalVendorAssessmentSent(orgId, vendorId);
    return;
  }

  const patch = {
    assessmentStatus: 'Sent' as const,
    lastAssessmentAt: new Date().toISOString(),
  };
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
