# Historical local Cloud SQL proxy migrate/prove helper — intentionally quarantined.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

throw @"
REFUSED: scripts/phase2-cloudsql-proxy-migrate.ps1 is a quarantined historical helper.

The original procedure depended on a legacy guardentra-7f582 Cloud SQL proxy path and
local audit database passwords. Current staging audit work must target guardentra-staging
only after the Issue #74/#116 READ-ONLY inventory is reconciled.

Do not load local secret files, run migrations, or perform live prove from this helper.
Generate a fresh exact-SHA, environment-bound migration/prove packet under separate
Owner-authorized staging scope. Issue #130 preserves this refusal; git history retains
the historical implementation.
"@
