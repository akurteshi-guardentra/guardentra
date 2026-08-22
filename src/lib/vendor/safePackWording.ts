/**
 * Issue #26 — safe product wording until provenance and rights are verified.
 *
 * Required baseline: GuardEntra-authored assessment packs aligned to selected
 * security domains. Do not describe packs as official, certified,
 * publisher-approved, or guaranteed to establish compliance.
 */

export const SAFE_PACK_BASELINE =
  'GuardEntra-authored assessment packs aligned to selected security domains.';

export const SAFE_PACK_PICK_HINT = 'Pick at least one GuardEntra assessment pack.';

export const SAFE_NO_QUESTIONS =
  'No questions available for the selected packs. Pick at least one GuardEntra assessment pack.';

export const SAFE_CUSTOM_UNAVAILABLE =
  "Custom questionnaires aren't available yet — select at least one GuardEntra assessment pack.";

export const SAFE_CUSTOM_CATALOG_DESC =
  'Not available yet — use a GuardEntra assessment pack';

export const SAFE_EMPTY_RECOVERY_NO_PACKS =
  'No assessment packs available to rebuild from. Archive this assessment or create a new one with a GuardEntra assessment pack.';

export const SAFE_EMPTY_RECOVERY_UI =
  'No recoverable packs on this assessment (custom-only or missing frameworks). Archive it and create a new assessment with a GuardEntra assessment pack.';

/** Public landing labels — shipped pack display names, not partners or certifications. */
export const PUBLIC_PACK_DOMAIN_LABELS = [
  'NIST CSF 2.0',
  'ISO 27001:2022',
  'SOC 2',
  'HIPAA',
  'PCI DSS 4.0',
  'CIS Controls',
] as const;

/** Authority-like words that must not appear in newly shipped user-visible copy. */
export const UNSUPPORTED_AUTHORITY_CLAIM_RE =
  /\b(official|certified|certification|publisher-approved|guaranteed compliant|guaranteed to establish compliance|audited proof)\b/i;
