/**
 * Audit retention policy (Phase 2 §1.3).
 * Interim Product default until legal confirms SOC 2 / DPA wording.
 */
export const AUDIT_RETENTION_YEARS = 7;

export function auditRetentionCutoffIso(
  now = new Date(),
  years = AUDIT_RETENTION_YEARS
): string {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString();
}
