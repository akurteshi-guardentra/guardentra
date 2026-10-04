#!/usr/bin/env node
/**
 * Historical 2026-08-11 staging DoD helper — intentionally quarantined.
 *
 * The original implementation minted tokens and called audit endpoints against
 * guardentra-7f582. That project is now rollback/history only; current staging is
 * guardentra-staging. Replaying this helper (or changing only the project id) could
 * produce misleading evidence or target the wrong runtime.
 *
 * Current #74 flow:
 *   1. collect the READ-ONLY STAGING AUDIT-SPINE EVIDENCE CONTRACT from Issue #74;
 *   2. reconcile guardentra-staging App Hosting / Cloud SQL / VPC / non-secret config;
 *   3. generate a fresh, exact-SHA staging prove packet;
 *   4. run live mutation/prove only under the separately scoped Owner-authorized packet.
 *
 * Git history preserves the historical proof implementation.
 */
console.error(
  [
    'REFUSED: scripts/staging-dod-http-prove.mjs is a quarantined historical helper.',
    'Current staging target: guardentra-staging.',
    'Historical rollback project: guardentra-7f582.',
    'Collect the Issue #74 read-only staging inventory before generating a new prove script.',
  ].join('\n')
);
process.exit(2);
