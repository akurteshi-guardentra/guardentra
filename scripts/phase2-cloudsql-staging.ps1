# Historical Phase 2 Cloud SQL staging helper — intentionally quarantined.
#
# The original helper targeted guardentra-7f582, which is now rollback/history only.
# Current named staging is guardentra-staging. Do not derive live mutation commands
# by substituting project names into the historical procedure.
#
# Before any #74 staging enablement, reconcile the read-only evidence contract in
# Issue #74 and the historical warnings in docs/PHASE2_CLOUDSQL_STAGING.md.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

throw @"
REFUSED: this historical helper is quarantined and must not be used for current #74 staging enablement.

Current staging target: guardentra-staging
Production target: guardentra-prod
Historical rollback project: guardentra-7f582

Next gate: collect the Issue #74 READ-ONLY STAGING AUDIT-SPINE EVIDENCE CONTRACT,
then generate a fresh staging-only enablement/rollback packet from observed state.
No project-name substitution or historical command replay is permitted.
"@
