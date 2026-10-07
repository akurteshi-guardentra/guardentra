/**
 * Persist FastTrack triage results so the wizard can enforce tier scope
 * after refresh / deep-link (not only URL query params).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { FrameworkId } from './types';
import type { TriageAnswers, TriageTier } from './fastTrackTriage';

export type VendorTriageRecord = {
  organizationId: string;
  vendorId: string;
  answers: TriageAnswers;
  tier: TriageTier;
  frameworks: FrameworkId[];
  rationale: string[];
  questionTarget: string;
  vendorTimeTarget: string;
  reviewCadence: TriageAnswers['reviewCadence'];
  completedAt: string;
  completedBy?: string | null;
};

function localTriageKey(organizationId: string, vendorId: string): string {
  return `guardentra:vendor-triage:${organizationId}:${vendorId}`;
}

export async function saveVendorTriage(record: VendorTriageRecord): Promise<void> {
  if (record.vendorId.startsWith('local_')) {
    localStorage.setItem(
      localTriageKey(record.organizationId, record.vendorId),
      JSON.stringify(record),
    );
    return;
  }
  await setDoc(
    doc(db, 'vendor_triage', record.vendorId),
    {
      ...record,
      updatedAt: record.completedAt,
    },
    { merge: true }
  );
}

export async function loadVendorTriage(
  vendorId: string,
  organizationId: string
): Promise<VendorTriageRecord | null> {
  if (!vendorId || !organizationId) return null;
  if (vendorId.startsWith('local_')) {
    const raw = localStorage.getItem(localTriageKey(organizationId, vendorId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as VendorTriageRecord;
      return parsed.organizationId === organizationId && parsed.vendorId === vendorId
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
  const snap = await getDoc(doc(db, 'vendor_triage', vendorId));
  if (!snap.exists()) return null;
  const data = snap.data() as VendorTriageRecord;
  if (data.organizationId !== organizationId) return null;
  return data;
}
