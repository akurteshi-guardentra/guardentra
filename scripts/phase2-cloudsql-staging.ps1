# Cloud SQL EU staging enablement (Path B — after local spine green).
#
# Prerequisites:
# - Week 0 WIF + TF state bucket (scripts/phase2-week0-wif.ps1) — DONE
# - infra/envs/eu-staging terraform.tfvars from terraform.tfvars.example
# - Enable APIs first (compute, servicenetworking, sqladmin) — see docs
#
# Steps (human / DevOps):
# 1. gcloud services enable compute.googleapis.com servicenetworking.googleapis.com sqladmin.googleapis.com --project=guardentra-7f582
# 2. Copy terraform.tfvars.example → terraform.tfvars
# 3. Set enable_vpc=true; terraform -chdir=infra/envs/eu-staging init && plan && apply
# 4. Set enable_cloud_sql=true; plan && apply (vpc_network_id optional if module.vpc on)
# 5. App Hosting secrets (STAGING ONLY):
#      AUDIT_SPINE_ENABLED=true
#      AUDIT_DATABASE_URL=<cloud-sql connection>
#      AUDIT_DATABASE_URL_MIGRATOR=<migrator role url>
#      AUDIT_WORKER_ENABLED=true
# 6. npm run migrate:audit against migrator URL
# 7. npm run verify:audit-spine with TENANT_ID=<org>
#
# Do NOT enable AUDIT_SPINE_ENABLED on production App Hosting until staging DoD.

Write-Host @"
Cloud SQL staging checklist is in docs/PHASE2_CLOUDSQL_STAGING.md
This script only prints the checklist (apply is gated on APIs + VPC + human approval).

Blocked until:
  - compute.googleapis.com / servicenetworking / sqladmin enabled on guardentra-7f582
  - enable_vpc apply succeeds
  - enable_cloud_sql plan reviewed
"@
