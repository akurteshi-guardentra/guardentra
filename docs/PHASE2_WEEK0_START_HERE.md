# Phase 2 — Week 0 start here (runbook)

## Ratified decisions (Track B defaults)

- **Cloud:** Stay on GCP; Cloud SQL for Postgres; AlloyDB later if lag/failover needs it.
- **First infra target:** EU staging (`infra/envs/eu-staging`).
- **Current GCP project (demo until staging exists):** `guardentra-7f582` / number `967769575761`.
- **Audit retention (interim):** **7 years** until Phase 1 legal confirms otherwise.
  Constant: `AUDIT_RETENTION_YEARS` in `server/lib/audit/retention.ts`.

## Automated script

```powershell
# After: gcloud auth login
powershell -File scripts/phase2-week0-wif.ps1
```

Creates (idempotent re-run): WIF pool `github-pool`, OIDC provider `github-provider`
(with `attribute-condition` on this repo), SA `github-actions-ci`, bucket
`gs://guardentra-tfstate-eu-staging`, and GitHub Actions vars when `gh` is logged in.

## Status (2026-08-10)

| Resource | Status |
|----------|--------|
| WIF pool + OIDC provider | **ACTIVE** (re-verified) |
| SA `github-actions-ci` + WIF IAM binding | Created |
| TF state bucket `gs://guardentra-tfstate-eu-staging` | Created |
| GitHub Actions `GCP_PROJECT_ID` / `GCP_PROJECT_NUMBER` | **Set** (`guardentra-7f582` / `967769575761`) |
| Local audit spine Path A | Green — see `docs/PHASE2_OPS_STATUS.md` |

## Remaining human steps (Path B / Dual Firebase)

Week 0 WIF + GitHub vars are done. Next:

1. Cloud SQL Path B — enable APIs + VPC + apply (see [`PHASE2_CLOUDSQL_STAGING.md`](./PHASE2_CLOUDSQL_STAGING.md)).
2. Dual Firebase — org Owner must create `guardentra-eu` / `guardentra-us` (see [`PHASE2_DUAL_FIREBASE.md`](./PHASE2_DUAL_FIREBASE.md)).

Auth refresh if sessions expire (no Cloud Shell):

```powershell
powershell -File scripts/phase2-auth-gcloud.ps1   # URL + paste code (phone OK)
powershell -File scripts/phase2-auth-gh.ps1       # device code + sets Actions vars
```

See [`docs/PHASE2_AUTH_NO_BROWSER.md`](./PHASE2_AUTH_NO_BROWSER.md).

Or set vars manually after `gh auth login --web`:

```bash
gh variable set GCP_PROJECT_ID --body guardentra-7f582 --repo akurteshi-guardentra/guardentra
gh variable set GCP_PROJECT_NUMBER --body 967769575761 --repo akurteshi-guardentra/guardentra
```

Local audit DB — `powershell -File scripts/phase2-local-spine.ps1` (requires Docker Desktop; script prepends Docker bin on Windows).

See also `docs/PHASE2_ISSUE_BACKLOG.md`, `docs/PHASE2_CLOUDSQL_STAGING.md`, `docs/PHASE2_DUAL_FIREBASE.md`, `docs/FASTTRACK_PHASE2.md`, `infra/README.md`.
