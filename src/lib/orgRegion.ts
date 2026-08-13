/**
 * Client-side P2B residency helpers (mirrors server/lib/regionRouter.ts contracts).
 */
export type DataRegion = 'eu' | 'us';

export function isDataRegion(value: unknown): value is DataRegion {
  return value === 'eu' || value === 'us';
}

export function parseDataRegion(value: unknown, fallback: DataRegion = 'us'): DataRegion {
  return isDataRegion(value) ? value : fallback;
}

/** Once set on an organization, dataRegion must not change. */
export function assertDataRegionImmutable(
  previous: unknown,
  next: unknown
): { ok: true } | { ok: false; error: string } {
  if (!isDataRegion(previous)) return { ok: true };
  if (next === previous) return { ok: true };
  if (next === undefined || next === null) {
    return { ok: false, error: 'dataRegion cannot be cleared once set' };
  }
  if (!isDataRegion(next)) {
    return { ok: false, error: 'dataRegion must be eu or us' };
  }
  return { ok: false, error: 'dataRegion is immutable after first set' };
}
