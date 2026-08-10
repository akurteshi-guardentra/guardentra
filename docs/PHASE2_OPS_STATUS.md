# Phase 2 ops enablement — status

_Last verified: 2026-08-10_

## Completed (green)

| Item | Evidence |
|------|----------|
| Local audit Postgres | Docker compose healthy; `npm run phase2:live-prove` PASS |
| Week 0 WIF | pool + OIDC provider ACTIVE; SA `github-actions-ci` |
| TF state bucket | `gs://guardentra-tfstate-eu-staging/` |
| GitHub Actions vars | `GCP_PROJECT_ID` / `GCP_PROJECT_NUMBER` set |
| GCP APIs | compute, servicenetworking, sqladmin, secretmanager **enabled** |
| Secret Manager secrets | `PG_CONNECTION_STRING`, `AUDIT_DATABASE_URL`, `AUDIT_SPINE_ENABLED` + accessor IAM |
| Private VPC | `guardentra-eu-staging` + subnet + PSA peering (terraform apply) |
| Cloud SQL | `guardentra-audit` POSTGRES_16 private IP (if apply finished — see below) |
| No-browser auth | `scripts/phase2-auth-*.ps1`, `docs/PHASE2_AUTH_NO_BROWSER.md` |

## Still blocked / manual

| Item | Notes |
|------|-------|
| App Hosting secrets + migrate | Wire connection strings; keep prod spine **off** until staging DoD |
| Dual Firebase `guardentra-eu` / `us` | Org Owner create; Firebase CLI needs `login --reauth` |

## Path B apply order (done locally)

1. Enable APIs ✓
2. `enable_vpc=true` apply ✓
3. `enable_cloud_sql=true` apply (edition `ENTERPRISE` + `db-custom-2-8192`)
4. Populate secret versions + App Hosting env (human)
5. `npm run migrate:audit` against migrator URL

## Ratified defaults

- GCP + Cloud SQL; EU staging first
- Audit retention 7 years
- Keep `AUDIT_SPINE_ENABLED=false` on production until staging DoD
