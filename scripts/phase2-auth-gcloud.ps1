# Historical Phase 2 gcloud authentication/project helper — intentionally quarantined.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

throw @"
REFUSED: scripts/phase2-auth-gcloud.ps1 is a quarantined historical helper.

The original script changed gcloud/ADC project state to legacy project guardentra-7f582
and inspected its historical WIF resources.
Current staging authority: guardentra-staging
Current production authority: guardentra-prod

Authenticate only through the current Owner-local #116 packet and keep project selection
explicit. Do not derive new commands by substituting project names into this script.
Issue #130 preserves this refusal; git history retains the historical procedure.
"@
