# GuardEntra named staging audit infrastructure

Target only: `guardentra-staging` / `us-central1`.

This root is intentionally isolated from `infra/envs/eu-staging` and its historical
state. It preserves the existing default VPC so the current staging scanner route is
not moved by this work.

## Hard stop before plan

Do not run `terraform plan` until all of these are complete:

1. read-only inventory of existing allocated private-service ranges, VPC routes,
   peerings, App Hosting runtime identity, current staging revision/source SHA, and
   rollback baseline;
2. a collision-free `private_service_range_cidr` is selected;
3. the Owner verifies a dedicated GCS state bucket and state prefix that are not the
   historical `guardentra-tfstate-eu-staging/terraform/state`;
4. the existing `AUDIT_DATABASE_URL` secret is confirmed preserved and outside this
   root's resource-creation scope;
5. the proposed Cloud SQL shape/cost and retention ownership are documented for
   Owner review; the exact plan is preparation, and approval remains required before apply.

## Read-only inventory examples

Every cloud command must name the project explicitly.

```bash
gcloud compute networks describe default --project=guardentra-staging
gcloud compute addresses list --global --project=guardentra-staging
gcloud services vpc-peerings list --network=default --project=guardentra-staging
gcloud compute routes list --project=guardentra-staging
gcloud sql instances list --project=guardentra-staging
gcloud secrets describe AUDIT_DATABASE_URL --project=guardentra-staging
gcloud projects get-iam-policy guardentra-staging
```

Do not read secret payloads.

## Local validation

From this directory:

```bash
terraform fmt -check
terraform init -backend=false
terraform validate
```

## Remote state initialization

Owner-supplied inventory on 2026-10-08 found no dedicated Terraform state bucket.
The preparation-only bootstrap is `infra/bootstrap/named-staging-state`; its proposed
bucket name requires read-only availability/ownership verification. Do not run its
apply before separate concrete bootstrap authorization.

Create a local, gitignored `backend.hcl` from `backend.hcl.example` only after
the Owner verifies the dedicated state bucket and ownership.

```bash
terraform init -reconfigure -backend-config=backend.hcl
```

## Exact plan

Copy `terraform.tfvars.example` to a local, gitignored `terraform.tfvars`, replace
the intentionally invalid private-service CIDR after inventory, and retain the exact
staging project id.

```bash
terraform plan \
  -var='project_id=guardentra-staging' \
  -out=guardentra-staging-audit.tfplan
terraform show -no-color guardentra-staging-audit.tfplan > guardentra-staging-audit.plan.txt
```

The saved plan and state can contain sensitive metadata. Do not commit or paste them
into chat. Record only the reviewed resource action summary and non-secret identifiers.

## Expected infrastructure intent

- existing default VPC: reference only, never recreate;
- Private Service Access: additive, collision-checked range;
- Cloud SQL PostgreSQL 16 Enterprise;
- candidate tier: `db-custom-2-8192`;
- candidate availability: `REGIONAL`;
- 20 GiB SSD initial disk, autoresize enabled;
- private IP only;
- 7 retained backups;
- 7-day transaction-log retention/PITR;
- deletion protection and Terraform `prevent_destroy`;
- additive `roles/cloudsql.client` for the observed staging runtime service account;
- database `guardentra_audit`;
- existing audit secret preserved; no secret value managed in Terraform.

## Database identities

`migrations/audit/002_roles.sql` defines `audit_app` as a NOLOGIN privilege role.
Managed staging must create separate LOGIN identities for the application and migrator
through the approved secure workflow, with secret-managed credentials. Grant the
application login the `audit_app` role. Never put database passwords in Terraform,
Git, terminal transcripts, plan evidence, or chat.

## Apply gate

No apply is authorized by this directory. Apply only after the Owner approves the
reviewed exact plan, cost, migration/connection method, rollback packet, and runtime
configuration change for Issue #74.
