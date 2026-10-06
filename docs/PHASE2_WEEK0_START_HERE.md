# Phase 2 Week 0 — HISTORICAL BOOTSTRAP, QUARANTINED

> **DO NOT EXECUTE THE 2026-08-10 WIF / GitHub-variable bootstrap as a current runbook.**

The historical Week 0 procedure created Workload Identity Federation resources, a
`github-actions-ci` service account, Terraform state storage and repository variables
around the old `guardentra-7f582` topology. Current named release environments now exist:

- staging: `guardentra-staging`
- production: `guardentra-prod`
- `guardentra-7f582`: demo / legacy / rollback-history context pending #126.

Git history preserves the old bootstrap procedure and resource names for audit. Routine
Terraform CI that authenticated through those historical variables is separately
quarantined by #136.

## Current path

1. #116: collect the real sanitized read-only cloud inventory from the approved
   Owner-local/cloud identity.
2. Reconcile existing WIF/service-account/state-bucket ownership and the historical
   Terraform state lock before changing anything.
3. Do not run `scripts/phase2-week0-wif.ps1`, `phase2-auth-gcloud.ps1` or
   `phase2-auth-gh.ps1`; they are quarantined by #130.
4. Any WIF/IAM/repository-variable change needs a fresh least-privilege task with exact
   target project, preflight, readback and rollback.
5. Any Terraform live plan/apply needs a fresh environment-bound execution packet after
   #116; routine CI is static-only under #136.
6. Dual EU/US residency remains a separate gated roadmap capability; inventory before
   any project creation.

No command in this document grants cloud mutation authority.

Issue #138 tracks this quarantine.
