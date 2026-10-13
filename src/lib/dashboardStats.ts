/**
 * Pure helpers for Dashboard spine stats (#42).
 * Distinguishes a real readiness score of 0 from missing/invalid values.
 */

export function parseReadinessScore(row: {
  readinessScore?: unknown;
  score?: unknown;
} | null | undefined): number | null {
  if (!row) return null;
  const raw = row.readinessScore ?? row.score;
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}
