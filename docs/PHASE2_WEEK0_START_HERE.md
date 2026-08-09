# Phase 2 — Week 0 start here (runbook)

Copied into the repo from the Drive starter-kit. Execute in a human terminal with
`gcloud` / `gsutil` access — agents cannot complete WIF OAuth for you.

## Ratified decisions (Track B defaults)

- **Cloud:** Stay on GCP; Cloud SQL for Postgres; AlloyDB later if lag/failover needs it.
- **First infra target:** EU staging (`infra/envs/eu-staging`).
- **Audit retention (interim):** **7 years** until Phase 1 legal confirms otherwise.
  Constant: `AUDIT_RETENTION_YEARS` in `server/lib/audit/retention.ts`.

## Steps

1. Confirm the cloud decision with Chief + Product Owner (above).
2. Confirm or override retention years in `server/lib/audit/retention.ts`.
3. Workload Identity Federation (replace `PROJECT_ID` / `PROJECT_NUMBER`):

```bash
gcloud iam workload-identity-pools create "github-pool" \
  --project="PROJECT_ID" --location="global" \
  --display-name="GitHub Actions pool"

gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="PROJECT_ID" --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub OIDC provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

gcloud iam service-accounts create "github-actions-ci" --project="PROJECT_ID"

gcloud iam service-accounts add-iam-policy-binding \
  "github-actions-ci@PROJECT_ID.iam.gserviceaccount.com" \
  --project="PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/akurteshi-guardentra/guardentra"
```

4. Terraform state bucket:

```bash
gsutil mb -p PROJECT_ID -l EU gs://guardentra-tfstate-eu-staging
gsutil versioning set on gs://guardentra-tfstate-eu-staging
```

5. Set GitHub Actions vars `GCP_PROJECT_ID` and `GCP_PROJECT_NUMBER`, then open a PR
   touching `infra/` so `.github/workflows/infra-ci.yml` can plan.

6. Local audit DB (no cloud required) — prefer existing migrations:

```bash
docker compose -f docker-compose.audit.yml up -d
npm run migrate:audit
# .env.local:
# AUDIT_SPINE_ENABLED=true
# AUDIT_DATABASE_URL=postgres://audit_app:audit_app@localhost:5433/guardentra_audit
```

See also `docs/PHASE2_ISSUE_BACKLOG.md`, `docs/FASTTRACK_PHASE2.md`, `infra/README.md`.
