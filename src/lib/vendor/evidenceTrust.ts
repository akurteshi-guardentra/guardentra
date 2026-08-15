/**
 * P0-2 Option B: evidence trust states and fail-closed helpers.
 *
 * MIME/size/Storage metadata may reach `validated`, then `scan_pending`.
 * `clean` is reserved for a future malware-scanner result and is never
 * produced by validation. Missing/unknown/malformed are untrusted.
 *
 * Authoritative state lives in `evidenceTrustByStoragePath` written by the
 * backend only. Never fall back to client `scanStatus`.
 */

import { EVIDENCE_ALLOWED_TYPES, EVIDENCE_MAX_BYTES } from './constants';

export const EVIDENCE_STATES = [
  'uploaded',
  'validation_pending',
  'validated',
  'scan_pending',
  'clean',
  'quarantined',
  'scan_failed',
] as const;

export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export type EvidenceTrustRecord = {
  state: EvidenceState;
  storagePath: string;
  contentType?: string;
  sizeBytes?: number;
  generation?: string;
  updatedAt: string;
  /** Metadata validation outcome; never a malware-scan claim. */
  validation?: 'validated' | 'rejected';
};

export type EvidenceTrustMap = Record<string, EvidenceTrustRecord | EvidenceState>;

export type EvidenceItem = {
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  storagePath?: string;
  scanStatus?: string;
  downloadUrl?: string;
};

const TERMINAL: ReadonlySet<EvidenceState> = new Set(['quarantined', 'scan_failed', 'clean']);

const STATE_RANK: Record<EvidenceState, number> = {
  uploaded: 0,
  validation_pending: 1,
  validated: 2,
  scan_pending: 3,
  quarantined: 4,
  scan_failed: 4,
  clean: 5,
};

export function isEvidenceState(value: unknown): value is EvidenceState {
  return typeof value === 'string' && (EVIDENCE_STATES as readonly string[]).includes(value);
}

/** Firestore map keys must not contain `.` or `/` (dotted update paths nest fields). */
export function encodeTrustMapKey(storagePath: string): string {
  return encodeURIComponent(storagePath).replace(/\./g, '%2E');
}

export function decodeTrustMapKey(key: string): string {
  return decodeURIComponent(key);
}

export function isOrgAttachmentPath(orgId: string, vendorId: string, storagePath: string): boolean {
  if (!orgId || !vendorId || !storagePath) return false;
  if (storagePath.includes('..') || storagePath.includes('\\') || storagePath.includes('\0')) {
    return false;
  }
  const prefix = `orgs/${orgId}/vendors/${vendorId}/attachments/`;
  if (!storagePath.startsWith(prefix)) return false;
  const rest = storagePath.slice(prefix.length);
  return Boolean(rest) && !rest.includes('/');
}

export function normalizeTrustRecord(
  value: EvidenceTrustRecord | EvidenceState | unknown
): EvidenceTrustRecord | undefined {
  if (isEvidenceState(value)) {
    return { state: value, storagePath: '', updatedAt: '' };
  }
  if (!value || typeof value !== 'object') return undefined;
  const rec = value as EvidenceTrustRecord;
  if (!isEvidenceState(rec.state)) return undefined;
  return rec;
}

export function lookupTrustRecord(
  storagePath: string | undefined,
  map?: EvidenceTrustMap | null
): EvidenceTrustRecord | undefined {
  if (!storagePath || !map) return undefined;
  return (
    normalizeTrustRecord(map[storagePath]) ||
    normalizeTrustRecord(map[encodeTrustMapKey(storagePath)])
  );
}

/** Fail closed: only authoritative `clean` is trusted. */
export function isTrustedState(state: string | undefined): boolean {
  return state === 'clean';
}

/**
 * Reviewer download: clean record must name this Storage object generation.
 * Missing, mismatched path, or stale generation are untrusted.
 */
export function reviewerTrustMatchesObject(input: {
  trust?: EvidenceTrustRecord;
  storagePath: string;
  generation?: string | number;
}): boolean {
  const { trust, storagePath } = input;
  if (!trust || !isTrustedState(trust.state)) return false;
  if (!trust.storagePath || trust.storagePath !== storagePath) return false;
  const objectGen = input.generation != null ? String(input.generation) : '';
  const recordedGen = trust.generation != null ? String(trust.generation) : '';
  return Boolean(objectGen) && Boolean(recordedGen) && objectGen === recordedGen;
}

export function effectiveEvidenceState(
  item: EvidenceItem | unknown,
  map?: EvidenceTrustMap | null
): EvidenceState | 'missing' | 'unknown' | 'malformed' {
  if (item == null) return 'missing';
  if (typeof item !== 'object') return 'malformed';
  const rec = item as EvidenceItem;
  const fromMap = lookupTrustRecord(rec.storagePath, map);
  if (fromMap?.state) return fromMap.state;
  if (rec.storagePath) return 'uploaded';
  if (rec.fileName) return 'unknown';
  return 'malformed';
}

export function isTrustedEvidence(
  item: EvidenceItem | unknown,
  map?: EvidenceTrustMap | null
): boolean {
  return isTrustedState(effectiveEvidenceState(item, map));
}

export function filterTrustedEvidence(
  items: unknown[] | undefined,
  map?: EvidenceTrustMap | null
): EvidenceItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => isTrustedEvidence(item, map)) as EvidenceItem[];
}

export function hasTrustedEvidence(
  questionId: string,
  evidenceByQuestion?: Record<string, unknown[]>,
  map?: EvidenceTrustMap | null
): boolean {
  if (!evidenceByQuestion) return true;
  return filterTrustedEvidence(evidenceByQuestion[questionId], map).length > 0;
}

export function trustedEvidenceFileNames(
  items: unknown[] | undefined,
  map?: EvidenceTrustMap | null
): string[] {
  return filterTrustedEvidence(items, map)
    .map((f) => f.fileName)
    .filter((n): n is string => Boolean(n));
}

export function evidenceStateLabel(state: EvidenceState | 'missing' | 'unknown' | 'malformed'): string {
  switch (state) {
    case 'uploaded':
      return 'Uploaded';
    case 'validation_pending':
      return 'Validation pending';
    case 'validated':
      return 'Metadata validated';
    case 'scan_pending':
      return 'Scan pending (no malware scanner)';
    case 'quarantined':
      return 'Quarantined';
    case 'scan_failed':
      return 'Validation failed';
    case 'clean':
      return 'Authoritative clean';
    case 'missing':
      return 'Missing';
    case 'unknown':
      return 'Unknown';
    case 'malformed':
      return 'Malformed';
    default:
      return 'Unknown';
  }
}

/**
 * Classify Storage metadata only. Never returns `clean`.
 * Success → `validated` (caller then records `scan_pending`).
 */
export function classifyStorageMetadata(input: {
  contentType?: string;
  sizeBytes?: number;
}): Extract<EvidenceState, 'validated' | 'quarantined' | 'scan_failed'> {
  const size = Number(input.sizeBytes) || 0;
  if (size <= 0 || size >= EVIDENCE_MAX_BYTES) return 'scan_failed';
  const type = String(input.contentType || '').toLowerCase();
  if (!type || type === 'application/octet-stream') return 'quarantined';
  const allowed = EVIDENCE_ALLOWED_TYPES as readonly string[];
  if (allowed.includes(type)) return 'validated';
  return 'quarantined';
}

export function optionBRecordedState(
  validation: ReturnType<typeof classifyStorageMetadata>
): EvidenceState {
  if (validation === 'validated') return 'scan_pending';
  return validation;
}

export function isPortalEvidencePath(assessmentId: string, storagePath: string): boolean {
  if (!assessmentId || !storagePath) return false;
  if (storagePath.includes('..') || storagePath.includes('\\') || storagePath.includes('\0')) {
    return false;
  }
  const prefix = `portal/${assessmentId}/`;
  if (!storagePath.startsWith(prefix)) return false;
  const rest = storagePath.slice(prefix.length);
  return Boolean(rest) && !rest.includes('/');
}

export function shouldReplaceTrustRecord(
  existing: EvidenceTrustRecord | undefined,
  next: EvidenceTrustRecord
): boolean {
  if (!existing) return true;
  if (TERMINAL.has(existing.state) && existing.state !== next.state) {
    if (STATE_RANK[next.state] < STATE_RANK[existing.state]) return false;
  }
  if (existing.updatedAt && next.updatedAt && existing.updatedAt > next.updatedAt) {
    return false;
  }
  return true;
}

export function mergeTrustMapEntry(
  map: EvidenceTrustMap,
  storagePath: string,
  next: EvidenceTrustRecord
): EvidenceTrustMap {
  const key = encodeTrustMapKey(storagePath);
  const existing = lookupTrustRecord(storagePath, map);
  if (!shouldReplaceTrustRecord(existing, next)) return map;
  return { ...map, [key]: { ...next, storagePath } };
}

export function approvalBlockedByUntrustedEvidence(
  exceptions: Array<{ reason: string }>
): boolean {
  return exceptions.some((e) => e.reason === 'missing_evidence');
}
