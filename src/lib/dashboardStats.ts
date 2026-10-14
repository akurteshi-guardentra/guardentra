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
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || !/^-?(?:\d+|\d+\.\d+)$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
