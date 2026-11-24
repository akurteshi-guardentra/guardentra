/**
 * Fields a portal session must not receive. Firestore document reads cannot
 * redact fields, so these are stored on assessment_reviews/{id} and deleted
 * from the vendor-visible assessment document when a decision is written.
 * decisionOutcome, decidedAt, and remediationDueAt stay on the assessment:
 * the vendor receipt and remediate deadline use them.
 */
export const VENDOR_PRIVATE_ASSESSMENT_FIELDS = [
  'decisionNotes',
  'decidedBy',
  'decidedByName',
  'residualRiskLevel',
  'remediationOwner',
] as const;

export type VendorPrivateAssessmentField = (typeof VENDOR_PRIVATE_ASSESSMENT_FIELDS)[number];

export function partitionVendorAssessmentPatch(patch: Record<string, unknown>): {
  publicPatch: Record<string, unknown>;
  privatePatch: Record<string, unknown>;
  hasPrivate: boolean;
} {
  const publicPatch: Record<string, unknown> = { ...patch };
  const privatePatch: Record<string, unknown> = {};
  let hasPrivate = false;
  for (const key of VENDOR_PRIVATE_ASSESSMENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(publicPatch, key)) continue;
    privatePatch[key] = publicPatch[key];
    publicPatch[key] = null;
    hasPrivate = true;
  }
  return { publicPatch, privatePatch, hasPrivate };
}
