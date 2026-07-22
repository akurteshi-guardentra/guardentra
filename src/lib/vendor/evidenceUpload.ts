import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import { validateEvidenceFile } from './validators';
import { evidenceStoragePath } from './types';

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
  const storagePath = evidenceStoragePath(input.orgId || 'portal', input.vendorId || input.assessmentId, fileId, input.file.name);
  // Prefer portal-scoped path for unauthenticated-friendly rules when org is known
  const path = input.orgId
    ? storagePath
    : `portal/${input.assessmentId}/${fileId}-${input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

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
