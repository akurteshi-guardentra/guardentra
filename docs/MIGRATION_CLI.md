# Historical account-migration CLI — QUARANTINED

> **DO NOT EXECUTE THE HISTORICAL ACCOUNT / IAM / API-KEY PROCEDURE FROM CURRENT MAIN.**

The procedure previously stored in this file was written for the old single-project
`guardentra-7f582` topology. It included commands that changed gcloud project state,
enabled APIs, created/revealed API keys, wrote App Hosting secrets, and removed IAM
bindings.

Current environment authority is different:

- staging: `guardentra-staging`
- production: `guardentra-prod`
- `guardentra-7f582`: demo / legacy / rollback-history context pending P0 #126
  live control-plane reconciliation.

Git history preserves the historical procedure for audit/reference. It is not a current
runbook and must not be replayed, copied, or adapted by substituting project names.

## Current path

1. Use Issue #116 to obtain a sanitized, read-only cloud authority inventory from the
   approved Owner-local/cloud identity.
2. Use the environment-specific issue packet (#72, #73, #74, #126, or a newer scoped
   task) for any required change.
3. IAM, billing, API-key, Secret Manager, App Hosting, DNS, and account ownership changes
   require explicit least-privilege scope, preflight, readback, rollback evidence, and
   secret-value redaction.
4. Customer trust/legal identity work remains separately gated by #119.

No command in this document grants mutation authority.

Issue #132 tracks this quarantine.
