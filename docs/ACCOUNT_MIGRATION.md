# Historical account ownership migration — QUARANTINED

> **DO NOT EXECUTE THE HISTORICAL OWNERSHIP / BILLING / KEY-MIGRATION CHECKLIST FROM CURRENT MAIN.**

The checklist previously stored here assumed `guardentra-7f582` was GuardEntra's single
live Firebase/GCP project and that named staging/production projects did not yet exist.
That assumption is obsolete.

Current environment authority:

- staging: `guardentra-staging`
- production: `guardentra-prod`
- `guardentra-7f582`: demo / legacy / rollback-history context pending P0 #126
  live control-plane reconciliation.

The old checklist included Owner/IAM changes, billing relinking, API-key creation,
credential rotation, project/account decommissioning, and related console actions. Git
history preserves that procedure as historical evidence; it is not a current operational
runbook.

## Current identity / account-change rule

1. Read current state first through the #116 cloud-authority path and the relevant
   environment-specific issue packet.
2. Never infer current project ownership, billing, keys, domains, or live-data location
   from this historical document.
3. Never remove an Owner/principal, rotate/delete keys, relink billing, shut down a
   project, transfer a repository/domain, or alter IAM/secrets without a fresh scoped task,
   least-privilege plan, rollback/readback evidence, and Owner/counsel approval where
   applicable.
4. Never copy historical commands and replace only the project ID.
5. Keep secrets, tokens, API-key values, raw auth output, and customer data out of issue
   evidence.

For current release/cloud work use #116, #126, #72, #73, #74 and the exact current-source
release packet. Customer trust/legal readiness remains separately gated by #119.

Issue #132 tracks this quarantine.
