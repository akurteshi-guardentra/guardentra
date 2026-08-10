# Phase 2 — Cloud SQL EU staging checklist

After local Docker spine is green (`scripts/phase2-local-spine.ps1` + `npm run phase2:live-prove`):

## Blocked as of 2026-08-10 (verified)

| Prerequisite | Status |
|--------------|--------|
| Week 0 WIF + TF state bucket | **Green** |
| Local spine live-prove | **Green** |
| Compute Engine API (`compute.googleapis.com`) | **Disabled** on `guardentra-7f582` |
| Service Networking API | **Disabled** |
| Cloud SQL Admin API (`sqladmin.googleapis.com`) | **Disabled** |
| Private VPC | **None** (cannot list networks until Compute API is on) |
| `terraform.tfvars` (local) | Not created yet (copy from example) |
| `enable_cloud_sql` apply | **Do not run** until VPC exists |

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
AUDIT_SPINE_ENABLED=true
AUDIT_DATABASE_URL=<app role, private Cloud SQL>
AUDIT_DATABASE_URL_MIGRATOR=<migrator role>
AUDIT_WORKER_ENABLED=true
```

Then: `npm run migrate:audit` → `npm run phase2:live-prove` (or `verify:audit-spine` with `TENANT_ID` + staging `BASE_URL`).

**Do not** set `AUDIT_SPINE_ENABLED=true` on production App Hosting until staging DoD is evidenced.

## In-repo readiness

| Piece | Status |
|-------|--------|
| `infra/modules/cloud-sql` | Present |
| `infra/modules/vpc` | Present (stub; default off) |
| `enable_vpc` / `enable_cloud_sql` in eu-staging | Present (default `false`) |
| Secret names for audit | Present |
| Live apply | Blocked on API enable + human plan/apply |
