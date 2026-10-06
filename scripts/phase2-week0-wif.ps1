# Historical Phase 2 Week 0 WIF provisioning helper — intentionally quarantined.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

throw @"
REFUSED: scripts/phase2-week0-wif.ps1 is a quarantined historical helper.

The original script created Workload Identity Federation / service-account / IAM resources
in legacy project guardentra-7f582.
Current staging authority: guardentra-staging
Current production authority: guardentra-prod

Do not create, update, or bind WIF/IAM resources from this helper.
Use the current #116 read-only inventory first, then a separately scoped least-privilege
change packet with rollback/readback evidence if IAM changes are actually required.
Issue #130 preserves this refusal; git history retains the historical procedure.
"@
