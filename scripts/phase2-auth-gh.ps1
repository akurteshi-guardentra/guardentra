# Historical Phase 2 GitHub/GCP variable helper — intentionally quarantined.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

throw @"
REFUSED: scripts/phase2-auth-gh.ps1 is a quarantined historical helper.

The original script wrote GitHub Actions GCP variables for legacy project guardentra-7f582.
Current staging authority: guardentra-staging
Current production authority: guardentra-prod

Do not rewrite repository cloud variables from this helper.
Use the issue-bound #116 cloud-authority packet and current environment-specific evidence.
Issue #130 preserves this refusal; git history retains the historical procedure.
"@
