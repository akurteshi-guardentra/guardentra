/**
 * P0-2: evidence is not trusted until a scan result is clean.
 * Fail closed: missing, pending, failed, and quarantined statuses are untrusted.
 * Portal clients may stamp scanStatus on file objects; reviewers must prefer
 * evidenceScanByStoragePath written outside the portal field allowlist.
 */

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
] as const;

const MAX_BYTES = 25 * 1024 * 1024;

export type EvidenceScanStatus = 'pending' | 'clean' | 'failed' | 'quarantined';

export type EvidenceScanMap = Record<string, EvidenceScanStatus>;

export type EvidenceScanItem = {
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  storagePath?: string;
  scanStatus?: string;
};

export function isTrustedScanStatus(status: string | undefined): boolean {
  return status === 'clean';
}

/**
 * Classify a just-uploaded object. Not a malware engine — content-type/size
 * matching storage.rules. octet-stream / empty type → quarantined.
 */
export function classifyEvidenceScan(input: {
  contentType?: string;
  sizeBytes?: number;
  fileName?: string;
}): EvidenceScanStatus {
  const size = Number(input.sizeBytes) || 0;
  if (size <= 0 || size >= MAX_BYTES) return 'failed';
  const type = String(input.contentType || '').toLowerCase();
  if (!type || type === 'application/octet-stream') return 'quarantined';
  const allowed = ALLOWED_TYPES as readonly string[];
  if (allowed.includes(type)) return 'clean';
  const byExt = /\.(pdf|docx?|xlsx?|png|jpe?g)$/i.test(String(input.fileName || ''));
  if (byExt) return 'quarantined';
  return 'failed';
}

export function scanStatusForStoragePath(
  storagePath: string | undefined,
  scanMap?: EvidenceScanMap | null
): EvidenceScanStatus | undefined {
  if (!storagePath || !scanMap) return undefined;
  return scanMap[storagePath];
}

/** Authoritative scan map wins; otherwise file.scanStatus; otherwise unscanned. */
export function effectiveScanStatus(
  item: EvidenceScanItem,
  scanMap?: EvidenceScanMap | null
): EvidenceScanStatus {
  const fromMap = scanStatusForStoragePath(item.storagePath, scanMap);
  if (fromMap) return fromMap;
  if (
    item.scanStatus === 'pending' ||
    item.scanStatus === 'clean' ||
    item.scanStatus === 'failed' ||
    item.scanStatus === 'quarantined'
  ) {
    return item.scanStatus;
  }
  return 'pending';
}

export function isTrustedEvidence(
  item: EvidenceScanItem | unknown,
  scanMap?: EvidenceScanMap | null
): boolean {
  if (!item || typeof item !== 'object') return false;
  const rec = item as EvidenceScanItem;
  if (scanMap && rec.storagePath) {
    return isTrustedScanStatus(scanMap[rec.storagePath]);
  }
  return isTrustedScanStatus(effectiveScanStatus(rec, scanMap));
}

export function filterTrustedEvidence(
  items: unknown[] | undefined,
  scanMap?: EvidenceScanMap | null
): EvidenceScanItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => isTrustedEvidence(item, scanMap)) as EvidenceScanItem[];
}

export function hasTrustedEvidence(
  questionId: string,
  evidenceByQuestion?: Record<string, unknown[]>,
  scanMap?: EvidenceScanMap | null
): boolean {
  if (!evidenceByQuestion) return true;
  return filterTrustedEvidence(evidenceByQuestion[questionId], scanMap).length > 0;
}

export function trustedEvidenceFileNames(
  items: unknown[] | undefined,
  scanMap?: EvidenceScanMap | null
): string[] {
  return filterTrustedEvidence(items, scanMap)
    .map((f) => f.fileName)
    .filter((n): n is string => Boolean(n));
}
