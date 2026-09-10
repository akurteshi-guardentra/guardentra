/**
 * P0-2 Option B: evidence trust states and fail-closed helpers.
 *
 * MIME/size/Storage metadata may reach `validated`, then `scan_pending`.
 * `clean` / malware `quarantined` / scanner `scan_failed` are written only by
 * the trusted backend malware scanner (Admin SDK). Metadata validation never
 * produces `clean`. Missing/unknown/malformed are untrusted.
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
  /** Present when a trusted backend scanner wrote the record. */
  scanner?: {
    engine: string;
    verdict: 'clean' | 'infected' | 'error';
    signature?: string;
    scannedAt: string;
  };
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

/** PR #39 encoding: slashes only. Periods remain (unsafe for dotted paths). */
export function encodePr39TrustMapKey(storagePath: string): string {
  return storagePath.replace(/\//g, '__');
}

export function decodeTrustMapKey(key: string): string {
  if (key.includes('%')) return decodeURIComponent(key);
  return key.replace(/__/g, '/');
}

export function trustMapAliasKeys(storagePath: string): string[] {
  return Array.from(new Set([encodeTrustMapKey(storagePath), encodePr39TrustMapKey(storagePath), storagePath]));
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
  const found: EvidenceTrustRecord[] = [];
  for (const key of trustMapAliasKeys(storagePath)) {
    const rec = normalizeTrustRecord(map[key]);
    if (rec) {
      found.push({
        ...rec,
        storagePath: rec.storagePath || storagePath,
      });
    }
  }
  if (!found.length) return undefined;
  return found.reduce((best, rec) => {
    const bestRank = STATE_RANK[best.state] ?? -1;
    const recRank = STATE_RANK[rec.state] ?? -1;
    if (recRank > bestRank) return rec;
    if (recRank < bestRank) return best;
    if (rec.updatedAt && best.updatedAt && rec.updatedAt > best.updatedAt) return rec;
    return best;
  });
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
      return 'Scan pending';
    case 'quarantined':
      return 'Quarantined';
    case 'scan_failed':
      return 'Scan failed';
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

function trustGenerationToken(value: string | number | undefined): string {
  return value != null ? String(value) : '';
}

/**
 * Generation-aware, fail-closed trust replacement.
 *
 * A proven different Storage generation starts a new trust lifecycle
 * (prior clean cannot approve the replacement object).
 *
 * For the same generation — or when a generation change cannot be proven —
 * a terminal state (`clean` | `quarantined` | `scan_failed`) is immutable.
 * Only an identical terminal verdict may be replayed (idempotent). Same-gen
 * upgrades such as quarantined→clean or scan_failed→clean are rejected.
 */
export function shouldReplaceTrustRecord(
  existing: EvidenceTrustRecord | undefined,
  next: EvidenceTrustRecord
): boolean {
  if (!existing) return true;

  const existingGen = trustGenerationToken(existing.generation);
  const nextGen = trustGenerationToken(next.generation);
  const provenDifferentGeneration = Boolean(existingGen) && Boolean(nextGen) && existingGen !== nextGen;

  if (provenDifferentGeneration) {
    return true;
  }

  if (TERMINAL.has(existing.state)) {
    return existing.state === next.state;
  }

  if (existing.updatedAt && next.updatedAt && existing.updatedAt > next.updatedAt) {
    return false;
  }
  return true;
}

/**
 * Terminal `clean` may persist only after metadata validation recorded
 * matching `scan_pending` for this Storage generation, or as an idempotent
 * same-generation `clean` replay (G2). Premature clean must not land first:
 * same-gen metadata `quarantined` cannot replace it.
 */
export function canPersistScannerClean(
  existing: EvidenceTrustRecord | undefined,
  next: Pick<EvidenceTrustRecord, 'state' | 'generation'>
): boolean {
  if (next.state !== 'clean') return true;
  if (!existing) return false;
  const existingGen = trustGenerationToken(existing.generation);
  const nextGen = trustGenerationToken(next.generation);
  if (!existingGen || !nextGen || existingGen !== nextGen) return false;
  return existing.state === 'scan_pending' || existing.state === 'clean';
}

/** Drop `undefined` so Admin `tx.update` / Firestore does not reject the payload. */
export function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedDeep(item)) as T;
  }
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) continue;
      out[key] = omitUndefinedDeep(nested);
    }
    return out as T;
  }
  return value;
}

/**
 * Trusted evidence objects that currently satisfy a required evidence
 * requirement. Approval must re-bind each of these to live Storage generation.
 */
export function requiredSatisfyingEvidenceItems(input: {
  questions: Array<{ id?: string; required?: boolean }>;
  evidenceByQuestion?: Record<string, unknown[]>;
  evidenceTrustByStoragePath?: EvidenceTrustMap | null;
}): EvidenceItem[] {
  const evidenceByQuestion = input.evidenceByQuestion;
  if (!evidenceByQuestion) return [];
  const map = input.evidenceTrustByStoragePath;
  const seen = new Set<string>();
  const out: EvidenceItem[] = [];
  for (const q of input.questions) {
    if (!q.id || q.required === false) continue;
    for (const item of filterTrustedEvidence(evidenceByQuestion[q.id], map)) {
      const storagePath = String(item.storagePath || '').trim();
      if (!storagePath || seen.has(storagePath)) continue;
      seen.add(storagePath);
      out.push(item);
    }
  }
  return out;
}

/** Scanner-authored terminal states — never produced by metadata validation. */
export const SCANNER_VERDICT_STATES = ['clean', 'quarantined', 'scan_failed'] as const;
export type ScannerVerdictState = (typeof SCANNER_VERDICT_STATES)[number];

export function isScannerVerdictState(value: unknown): value is ScannerVerdictState {
  return typeof value === 'string' && (SCANNER_VERDICT_STATES as readonly string[]).includes(value);
}

/**
 * Build an authoritative scanner trust record bound to a specific object generation.
 * Callers must persist via Admin SDK only.
 */
export function buildScannerTrustRecord(input: {
  storagePath: string;
  generation: string;
  verdict: 'clean' | 'infected' | 'error';
  engine: string;
  signature?: string;
  contentType?: string;
  sizeBytes?: number;
  scannedAt?: string;
}): EvidenceTrustRecord {
  const scannedAt = input.scannedAt || new Date().toISOString();
  let state: ScannerVerdictState;
  if (input.verdict === 'clean') state = 'clean';
  else if (input.verdict === 'infected') state = 'quarantined';
  else state = 'scan_failed';

  const signature =
    typeof input.signature === 'string' && input.signature.length > 0
      ? input.signature
      : undefined;

  return omitUndefinedDeep({
    state,
    storagePath: input.storagePath,
    generation: String(input.generation),
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    updatedAt: scannedAt,
    scanner: {
      engine: input.engine,
      verdict: input.verdict,
      signature,
      scannedAt,
    },
  });
}

export function mergeTrustMapEntry(
  map: EvidenceTrustMap,
  storagePath: string,
  next: EvidenceTrustRecord
): EvidenceTrustMap {
  const canonical = encodeTrustMapKey(storagePath);
  const existing = lookupTrustRecord(storagePath, map);
  if (!shouldReplaceTrustRecord(existing, next)) return map;
  const merged: EvidenceTrustMap = { ...map };
  for (const alias of trustMapAliasKeys(storagePath)) {
    if (alias !== canonical) delete merged[alias];
  }
  merged[canonical] = { ...next, storagePath };
  return merged;
}

export function approvalBlockedByUntrustedEvidence(
  exceptions: Array<{ reason: string }>
): boolean {
  return exceptions.some((e) => e.reason === 'missing_evidence');
}
