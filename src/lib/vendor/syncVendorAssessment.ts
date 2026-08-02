import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { isFirestoreUnavailableError, markLocalVendorAssessmentStarted } from './localVendorStore';

/**
 * Sync vendor chip fields after creating a security assessment.
 * Tries Firestore first; falls back to local vendor store.
 */
export async function syncVendorAfterAssessmentCreate(
  orgId: string,
  vendorId: string,
  preferLocal: boolean
): Promise<void> {
  const patch = {
    assessmentStatus: 'In Progress' as const,
    lastAssessmentAt: new Date().toISOString(),
  };

  if (preferLocal || vendorId.startsWith('local_')) {
    markLocalVendorAssessmentStarted(orgId, vendorId);
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
    if (isFirestoreUnavailableError(err) || true) {
      markLocalVendorAssessmentStarted(orgId, vendorId);
    }
  }
}
