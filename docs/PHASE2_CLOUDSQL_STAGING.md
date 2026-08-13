# Phase 2 — Cloud SQL EU staging checklist

After local Docker spine is green (`scripts/phase2-local-spine.ps1` + `npm run phase2:live-prove`):

## Status as of 2026-08-11

| Prerequisite | Status |
|--------------|--------|
| Week 0 WIF + TF state bucket | **Green** |
| Local spine live-prove | **Green** |
| Compute Engine API (`compute.googleapis.com`) | **Enabled** |
| Service Networking API | **Enabled** |
| Cloud SQL Admin API (`sqladmin.googleapis.com`) | **Enabled** |
| Private VPC (`guardentra-eu-staging`) | **Applied** (subnet + PSA) |
| Cloud SQL `guardentra-audit` | **RUNNABLE** — private IP `10.20.0.2`, conn `guardentra-7f582:europe-west3:guardentra-audit` |
| `terraform.tfvars` (local) | Present (gitignored); `enable_vpc` + `enable_cloud_sql` true |
| DB users `audit_app` / `audit_migrator` | **Green** |
| Schema migrate (GCS import) | **Green** — `001_init` + `002_roles` + marks |
| Secret Manager versions | **Green** — `AUDIT_DATABASE_URL`, `AUDIT_SPINE_ENABLED=false`, migrator/proxy ops |
| Bastion live-prove | **PASS** then bastion deleted |
| App Hosting SA → Secret Manager accessor | **Green** (`gcloud secrets get-iam-policy AUDIT_DATABASE_URL`) |
| Attach Cloud SQL — Cloud Run `us-central1` | **Green** |
| Attach Cloud SQL — Cloud Run `us-west1` | **Green** |
| Firebase CLI `apphosting:secrets:grantaccess` | **Blocked** — need `npx firebase-tools login --reauth` (IAM already present via gcloud) |
| Spine ON without prod traffic | **Green (tagged)** — tag `auditspine` / rev `guardentra-00076-fem` @ 0%; `AUDIT_SPINE_ENABLED=true` + `AUDIT_DATABASE_URL` mounted |
| Prod / 100% traffic spine | **OFF** — still `guardentra-build-2026-08-10-001` without `AUDIT_*` |
| Tagged `/api/health` | **200** (Cloud Run IAM identity token) |
| HTTP `/api/audit/verify` DoD | **Blocked on Firebase ID token** (401) — see human commands below |
| App Hosting rollout of yaml `AUDIT_*` | **Remaining** — commit/push + Firebase reauth / console rollout |
| Dual Firebase EU/US projects | **Gated** — Org Owner; do not CLI-create |

## Exact human commands (Path B)

### 1) Enable APIs (once)

```powershell
$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
& $gcloud services enable compute.googleapis.com servicenetworking.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com --project=guardentra-7f582
```

### 2) Terraform tfvars

```powershell
Copy-Item infra\envs\eu-staging\terraform.tfvars.example infra\envs\eu-staging\terraform.tfvars
# Edit: leave enable_vpc / enable_cloud_sql false until you are ready to apply
```

### 3) Apply VPC first (review plan)

In `infra/envs/eu-staging/terraform.tfvars`:

```hcl
enable_vpc       = true
enable_cloud_sql = false
```

```powershell
terraform -chdir=infra/envs/eu-staging init
terraform -chdir=infra/envs/eu-staging plan
terraform -chdir=infra/envs/eu-staging apply   # only after plan review
```

Module: `infra/modules/vpc` (private subnet + Private Service Access peering).

### 4) Apply Cloud SQL (after VPC)

```hcl
enable_vpc       = true
enable_cloud_sql = true
# vpc_network_id can stay "" — eu-staging resolves module.vpc[0].network_id
```

```powershell
terraform -chdir=infra/envs/eu-staging plan
terraform -chdir=infra/envs/eu-staging apply   # only after plan review
```

Cloud SQL module forces `ipv4_enabled = false` (private IP only).

### 5) Staging App Hosting secrets (not production)

```
AUDIT_SPINE_ENABLED=true   # staging / tagged prove only — NOT shared apphosting.yaml default
AUDIT_DATABASE_URL=<app role, unix socket /cloudsql/INSTANCE>
AUDIT_DATABASE_URL_MIGRATOR=<migrator role — ops only, not App Hosting>
AUDIT_WORKER_ENABLED=true
```

Shared [`apphosting.yaml`](../apphosting.yaml) keeps `AUDIT_SPINE_ENABLED=false` so production stays safe.

**Current single-backend reality:** only App Hosting backend `guardentra` exists (serves guardentra.com). Spine ON was staged as Cloud Run traffic tag `auditspine` at **0%** (does not flip prod).

### 5b) Finish HTTP DoD against tagged revision (human)

Cloud Run IAM + Firebase auth cannot share one Bearer header. Proxy for IAM, then pass only the Firebase ID token:

```powershell
$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
# Terminal A (install cloud-run-proxy if prompted):
& $gcloud run services proxy guardentra --region=us-central1 --project=guardentra-7f582 --tag=auditspine --port=8787
# Terminal B — sign in at https://guardentra.com → DevTools → Network → copy Bearer from /api/*
$env:AUTH_BEARER = "<firebase_id_token>"
$env:AUDIT_SPINE_ENABLED = "true"
$env:BASE_URL = "http://127.0.0.1:8787"
$env:TENANT_ID = "<org_id>"
npm run verify:audit-spine
```

Optional confirm Cloud SQL attach + tag:

```powershell
$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
& $gcloud run services describe guardentra --project=guardentra-7f582 --region=us-central1 --format="yaml(status.traffic)"
# Expect: percent 100 on build-2026-08-10-001; auditspine present with no percent / 0
```

When a dedicated staging App Hosting backend exists:

1. Firebase console → App Hosting → **staging** backend → env → `AUDIT_SPINE_ENABLED=true`.
2. After CLI reauth (optional confirm):  
   `npx firebase-tools apphosting:secrets:grantaccess AUDIT_DATABASE_URL --project=guardentra-7f582`
3. Redeploy staging / wait for rollout.
4. HTTP DoD with `AUTH_BEARER` as above.

**Do not** set `AUDIT_SPINE_ENABLED=true` on production / 100% traffic until staging DoD is evidenced.

### 6) Firebase CLI reauth (when blocked)

```powershell
npx firebase-tools login --reauth
# or: npm run firebase:reauth
npx firebase-tools projects:list
npx firebase-tools apphosting:backends:list --project=guardentra-7f582
npx firebase-tools apphosting:secrets:grantaccess AUDIT_DATABASE_URL --project=guardentra-7f582
```

Needs an interactive browser — agents cannot complete this headless. See also [`PHASE2_AUTH_NO_BROWSER.md`](./PHASE2_AUTH_NO_BROWSER.md).

### 7) Verify Cloud SQL attach (both regions)

```powershell
$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
foreach ($r in @('us-central1','us-west1')) {
  & $gcloud run services describe guardentra --project=guardentra-7f582 --region=$r --format="yaml(spec.template.metadata.annotations)"
}
# If missing: --add-cloudsql-instances=guardentra-7f582:europe-west3:guardentra-audit
```

### 8) Optional cleanup (safe after bastion deleted)

Bastion VM is gone; these leftovers are optional:

```powershell
$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
# IAP SSH rule only needed while bastion existed:
& $gcloud compute firewall-rules delete allow-iap-ssh --project=guardentra-7f582 --quiet
# Migrate SQL objects (keep until you no longer need re-import):
# & $gcloud storage rm -r gs://guardentra-audit-migrate-eu
```

Do **not** delete the migrate bucket until you are sure schema re-import is unnecessary.

## In-repo readiness

| Piece | Status |
|-------|--------|
| `infra/modules/cloud-sql` | Present (`edition = ENTERPRISE`) |
| `infra/modules/vpc` | Present + applied |
| `enable_vpc` / `enable_cloud_sql` in eu-staging | Applied true in local tfvars |
| Secret Manager secret **shells** + IAM | Applied + App Hosting accessor on `AUDIT_DATABASE_URL` |
| Secret **versions** + Cloud Run Cloud SQL attach | **Green** |
| Tagged spine-ON revision (0% traffic) | **Green** — HTTP verify needs Firebase ID token |
| App Hosting yaml rollout (`AUDIT_*` on main traffic, spine false) | **Remaining** |
| Live migrate against private IP | Done via bastion/GCS path; Auth Proxy script remains for ops |
