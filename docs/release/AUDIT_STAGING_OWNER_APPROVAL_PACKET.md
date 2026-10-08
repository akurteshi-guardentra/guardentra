# GuardEntra #74 staging audit-spine Owner approval packet

Status: **PREPARATION IN PROGRESS — NOT APPROVED FOR APPLY**

Release candidate: `8db71492f5c1eac4d74b47ec239e4e94acac20ff`  
Target project/backend: `guardentra-staging / guardentra-staging`  
Target region: `us-central1`  
Production: **out of scope**

## Verified baseline

- current staging revision: `guardentra-staging-build-2026-09-14-001`;
- current staging source: `39fde456312586b1fff36a9cd68c13656ca6fa39`;
- staging automatic rollouts: disabled;
- backend environment: `staging`;
- runtime service account:
  `firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com`;
- runtime currently uses the default VPC / us-central1 default subnet;
- current scanner route must be preserved;
- no staging Cloud SQL instance or runtime Cloud SQL attachment was observed;
- `AUDIT_SPINE_ENABLED=false`, worker enabled;
- existing `AUDIT_DATABASE_URL` secret reference exists and must be preserved;
- secret payload has not been inspected.

Before apply, re-read every baseline value directly. This document does not turn stale
inventory into live proof.

## Proposed topology

Keep the App Hosting runtime on the current default VPC and us-central1 network path.
Add Private Service Access on that existing VPC using a collision-checked reserved range.
Create a staging-only private Cloud SQL PostgreSQL 16 Enterprise instance:

- name: `guardentra-staging-audit`;
- database: `guardentra_audit`;
- tier: `db-custom-2-8192` (2 vCPU / 8 GiB);
- availability: regional HA;
- initial disk: 20 GiB SSD, autoresize on;
- public IP: disabled;
- PITR: enabled;
- transaction-log retention: 7 days;
- retained backups: 7;
- deletion protection: enabled;
- Terraform prevent-destroy: enabled.

The new root is `infra/envs/named-staging`. It hard-rejects any project other than
`guardentra-staging` and is intentionally separate from the historical
`infra/envs/eu-staging` root/state.

## Cost estimate for Owner review

Google Cloud's published us-central1 Cloud SQL Enterprise HA on-demand rates at packet
preparation time are:

- HA vCPU: USD 0.0826 per vCPU-hour;
- HA memory: USD 0.014 per GiB-hour.

For 2 vCPU + 8 GiB at 730 hours/month:

- compute + memory: approximately **USD 202.36/month**;
- 20 GiB HA SSD: approximately **USD 6.80/month** at the published HA SSD capacity rate;
- if backup usage averages 20 GiB: approximately **USD 1.60/month** at the published
  backup-used rate.

Working staging estimate: approximately **USD 211/month before network traffic, extra
backup growth, taxes, logging/monitoring, or other GCP services**.

This is an estimate, not a quote. Any sizing/availability change is a material
cost/scope change and requires Owner review.

Pricing source:
https://cloud.google.com/sql/pricing

## Region / residency decision

Proposed region: `us-central1`.

Reason: the observed staging App Hosting runtime and scanner are already in
`us-central1`. Keeping the audit DB in the same region minimizes latency and avoids
silently redesigning the scanner/network path.

This is an operational recommendation, not a legal/data-residency approval. If the
binding architecture or counsel requires EU audit-data residency, stop and redesign
the private connectivity, latency/egress, backup residency, and secret/runtime
attachment before provisioning.

## Migration and database identity review

Migration set:
- `001_init.sql`: schema, event/outbox/hash-chain/metadata tables and indexes;
- `002_roles.sql`: append-only application privilege grants.

Preparation correction: `002_roles.sql` no longer creates `audit_app` with a
hard-coded password. It creates a NOLOGIN privilege role for managed environments.
Application and migrator LOGIN identities must be provisioned separately by an
approved secure method and their credentials stored outside Terraform/Git.

The application runtime must never receive migrator privileges.

## Retention ownership

Infrastructure retention candidate:
- PITR transaction logs: 7 days;
- retained backups: 7.

Application source currently advertises an interim audit-retention default of 7 years,
but no automatic purge/enforcement job has been proven in the inspected source.
Therefore:
- Product/Legal owns the final audit-record retention requirement;
- Platform/Infra owns backup/PITR configuration and restore evidence;
- #74 acceptance must not claim 7-year enforcement until an executable retention
  mechanism and ownership are approved.

## IAM / secret intent

Terraform may add only:
- `roles/cloudsql.client` for the observed staging App Hosting runtime service account.

The existing `AUDIT_DATABASE_URL` secret remains outside Terraform resource-creation
scope. Do not replace it or alter replication to match another module.

Before deployment:
- provision separate app and migrator DB identities securely;
- write a new secret version without displaying the value;
- preserve previous secret versions;
- pin/review the runtime secret reference as supported by App Hosting;
- verify effective IAM readback.

## Isolated Terraform state gate

Do not initialize or reuse:
`guardentra-tfstate-eu-staging/terraform/state`.

The named-staging root uses a partial GCS backend and requires an Owner-verified
dedicated bucket/prefix before the first remote plan.

Still required before exact plan:
1. identify the dedicated state bucket and verify ownership/versioning/locking posture;
2. inventory existing default-VPC routes, peerings, and allocated ranges;
3. select a collision-free private-service CIDR;
4. authenticate through the approved local/cloud workflow;
5. run fmt/validate/init and save the exact plan;
6. review every create/change and confirm zero production/legacy/secret-replacement/
   scanner-network/DNS actions.

## Runtime configuration / exact-RC deployment

Only after infrastructure + migration proof:
- add reviewed Cloud SQL runtime attachment/connection method;
- configure `AUDIT_DATABASE_URL` by secret reference only;
- set `AUDIT_SPINE_ENABLED=true` only in staging;
- retain `AUDIT_WORKER_ENABLED=true`;
- deploy exact RC `8db71492f5c1eac4d74b47ec239e4e94acac20ff`;
- keep automatic staging/prod rollouts disabled;
- read back effective revision, source SHA, runtime config references, and health.

Do not enable audit on the old staging revision as a substitute for RC acceptance.

## Rollback packet

Baseline application rollback:
- revision: `guardentra-staging-build-2026-09-14-001`;
- source: `39fde456312586b1fff36a9cd68c13656ca6fa39`;
- audit spine: false;
- worker: true.

Before change, verify the retained image/build and record current config/IAM/secret
references.

If acceptance fails:
1. stop new controlled acceptance writes;
2. restore the exact previous staging application revision through the approved App
   Hosting rollback path;
3. restore prior staging runtime config/secret reference/IAM if those were changed;
4. read back source SHA/config/traffic/health/scanner;
5. keep the new database and written audit records for investigation;
6. do not run `terraform destroy`;
7. do not run destructive schema down-migrations;
8. do not treat merely disabling audit as successful acceptance.

Infrastructure rollback must be preplanned per exact Terraform plan. Resources carrying
data are protected from destroy; cleanup/decommission, if later desired, is a separate
Owner-approved action.

## Live #74 acceptance after Owner approval/apply

Required evidence on exact RC:
- org/admin material events persist;
- vendor-portal material events persist;
- Firestore material intent -> Postgres outbox -> worker -> audit event/hash chain works;
- verify/readiness returns expected chain/state;
- export behavior works;
- deliberate tamper is detected;
- delivery/database failure is observable;
- stale processing lease is reclaimed;
- crash/retry produces logical exactly-once persistence;
- no secret/token payload is logged;
- retention/storage ownership is documented;
- rollback readiness/execution is evidenced;
- production unchanged.

Then complete the complete staging go-live evidence journey, including email
QUEUED -> PROVIDER_ACCEPTED -> INBOX_RECEIVED and clean/EICAR scanner cases.

## Concrete Owner approval gate

Do not apply until the packet is updated with:
- exact dedicated Terraform state location;
- collision-checked private-service CIDR;
- exact saved Terraform plan action summary;
- final monthly cost estimate from that plan/sizing;
- approved DB connection method;
- secure app/migrator identity method;
- migration validation results;
- rollback image/config readback.

Owner approval authorizes only the reviewed staging plan/config/deployment packet.
Production always requires separate authorization.
