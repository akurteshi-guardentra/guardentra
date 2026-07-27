import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import { validateEvidenceFile } from './validators';

export interface UploadedEvidence {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  downloadUrl: string;
  uploadedAt: string;
  questionId?: string;
}

export async function uploadPortalEvidence(input: {
  orgId: string;
  vendorId: string;
  assessmentId: string;
  file: File;
  questionId?: string;
}): Promise<UploadedEvidence> {
  const validationError = validateEvidenceFile(input.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  // Always the portal-scoped path. This previously preferred the org path
  // (`orgs/{orgId}/vendors/{vendorId}/evidence/...`) whenever orgId was truthy —
  // and VendorPortal.tsx always passes the assessment's organizationId, so in
  // practice every vendor upload landed there. That path's storage rule is only
  // `isSignedIn()`, meaning an anonymous portal session could write into any
  // org's evidence folder; `portal/{assessmentId}/...` is the one storage.rules
  // actually scopes to this assessment's portalOpen/org.
  const path = `portal/${input.assessmentId}/${fileId}-${input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, input.file, { contentType: input.file.type || 'application/octet-stream' });
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    fileName: input.file.name,
    contentType: input.file.type,
    sizeBytes: input.file.size,
    storagePath: path,
    downloadUrl,
    uploadedAt: new Date().toISOString(),
    questionId: input.questionId,
  };
}

/** Vendor-level general attachment (not tied to a portal question). Max 20MB to match Cynomi-style vendor packs. */
export async function uploadVendorAttachment(input: {
  orgId: string;
  vendorId: string;
  file: File;
}): Promise<UploadedEvidence> {
  const maxBytes = 20 * 1024 * 1024;
  if (input.file.size > maxBytes) {
    throw new Error('Vendor attachments must be 20MB or smaller.');
  }
  const validationError = validateEvidenceFile(input.file);
  if (validationError && !/25MB/i.test(validationError)) {
    throw new Error(validationError);
  }

  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const safe = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `orgs/${input.orgId}/vendors/${input.vendorId}/attachments/${fileId}-${safe}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, input.file, { contentType: input.file.type || 'application/octet-stream' });
  const downloadUrl = await getDownloadURL(storageRef);

  return {
    fileName: input.file.name,
    contentType: input.file.type,
    sizeBytes: input.file.size,
    storagePath: path,
    downloadUrl,
    uploadedAt: new Date().toISOString(),
  };
}
