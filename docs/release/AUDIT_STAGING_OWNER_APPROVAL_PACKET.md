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

### Owner-supplied read-only inventory checkpoint — 2026-10-08

Evidence source: authenticated Windows PowerShell outputs supplied by the Owner.
This workspace has not independently authenticated to Google Cloud.

- serving revision: `guardentra-staging-build-2026-09-14-001`, previously reported 100% Ready;
- resolved image digest:
  `us-central1-docker.pkg.dev/guardentra-staging/firebaseapphosting-images/guardentra-staging@sha256:6b0ad89b731d401f540d1539ac554fa68b05eda8bbf00b4885bc443497479047`;
- no global allocated ranges, VPC/PSA peerings, Cloud SQL instances or VPN tunnels
  were returned in supplied inventory;
- default VPC is auto mode with regional routing; us-central1 subnet is `10.128.0.0/20`;
- scanner VM is `guardentra-staging-clamav-01`, private IP `10.128.0.2`;
- scanner TCP 3310 firewall source remains `10.128.0.0/20`;
- NAT router is `guardentra-staging-nat-router`; NAT reports 2 VM endpoints and
  `minExtraNatIpsNeeded=0`. This is topology/capacity metadata, not a fresh scanner test;
- only the Firebase application bucket was listed; no dedicated state bucket found;
- existing `AUDIT_DATABASE_URL` version 1 remains enabled; payload not retrieved;
- SQL Admin API was absent from the supplied enabled-service list;
- `servicenetworking.googleapis.com` was enabled when the earlier inventory command
  prompted the Owner. Record this baseline change; do not claim zero prior cloud changes.

`10.20.0.0/16` is a proposed PSA candidate with no overlap in the supplied subnet/route
inventory. Avoid the entire auto-mode `10.128.0.0/9` reservation. Recheck current routes,
ranges and connectivity before finalizing the saved plan; a candidate is not allocated.
An imageDigest proves the revision's image identifier, not an independent registry
retention or successful rollback test. Verify image availability before deployment.

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

Correction checkpoint: the malformed `DO $ ... $;` delimiters are replaced with
matching `$audit_roles$` delimiters. The cloud-neutral `audit-migrations` CI job runs
both SQL files twice on a disposable PostgreSQL 16 database and checks a separately
authenticated application login: allowed append/outbox/metadata operations, duplicate
event rejection, and forbidden updates/deletes/truncation/DDL/elevation.
Until the exact-head job succeeds, execution evidence remains pending.

The existing migration runner can fall back to the application URL. Managed staging
execution must explicitly supply `AUDIT_DATABASE_URL_MIGRATOR` through secure local
handling and verify the migrator identity; never rely on that fallback. The CI SQL
contract is not proof of Cloud SQL connectivity, IAM, the production migration runner,
or tenant/event-delivery behavior.

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

Proposed bootstrap root: `infra/bootstrap/named-staging-state` (local state only).
Proposed bucket: `guardentra-staging-tfstate-965959469996`; proposed audit-state prefix:
`guardentra/named-staging/audit`. Availability, project number and operator identity
remain unverified. Never silently adopt an existing bucket.

Bootstrap intent: one US-CENTRAL1 STANDARD bucket with uniform access, public access
prevention, versioning, seven-day soft delete and destroy protection, plus one
bucket-scoped `roles/storage.objectAdmin` binding to a verified Terraform operator.
No application/runtime state access is proposed. Inherited IAM still requires review.
This is two proposed resources, not an executed plan or authorized mutation.

Sequence when no backend exists:
1. verify candidate bucket ownership/absence, project number and Google operator;
2. prepare a local-state bootstrap plan and review access, cost and recovery custody;
3. obtain narrowly scoped Owner bootstrap authorization before bucket/IAM creation,
   including remote-backend initialization and lock-object writes;
4. create only approved bootstrap resources and verify metadata/IAM readback;
5. initialize the isolated audit backend and generate the exact database plan;
6. request approval of the final staging infrastructure/configuration/deployment packet.

The final database plan cannot be called executable against a nonexistent GCS backend.
State bootstrap authorization does not authorize SQL, secrets or deployment. Keep local
bootstrap state securely until its durable recovery custody is documented.

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

## Repository validation checkpoint — 2026-10-08

Code preparation commit: `9cd2584ce2d6966e77ff499e3a49769ec8b2e21d` on draft PR #183.

- infra-ci run 37712224946: SUCCESS; all three root validations and PostgreSQL migration job PASS.
- CI run 37712224826: SUCCESS; verify and dispatcher PASS.
- Migration job logs identify PostgreSQL 16.15; both execution passes and application
  privilege contract PASS. Tests use synthetic disposable CI data, not Cloud SQL.
- Windows Owner worktree remains separate; no local work was overwritten.
- Workspace Terraform validation initially failed because Unix sockets are unavailable;
  GitHub CI supplied the actual successful provider validation evidence.

Evidence links:
- https://github.com/akurteshi-guardentra/guardentra/actions/runs/37712224946
- https://github.com/akurteshi-guardentra/guardentra/actions/runs/37712224826

Any later documentation commit must be identified separately from this tested code
commit. No exact live Terraform plan, apply, deployment or #74 acceptance is claimed.

## State-access correction checkpoint — 2026-10-09

Owner-supplied authenticated output on 2026-10-08 returned 404 for the proposed state
bucket and shows `user:admin@guardentra.com` with project `roles/owner`. The omitted
project-describe output still needs capture; the metadata collector includes it.

The same policy gives the runtime project-wide `roles/storage.objectViewer` plus broad
Firebase roles. Google's role reference confirms `roles/firebase.admin` includes
Storage object read/write permissions. Uniform access and an operator-only bucket
binding do not override those inherited allows. The earlier two-resource bootstrap
proposal is therefore BLOCKED pending a complete state-isolation design.

The preparation now adds a metadata-only PowerShell collector for all runtime role
definitions and a default-false bucket precondition. No IAM grants have been removed
or changed. The precondition requires a recorded technical isolation review, not
pre-plan Owner approval or proof of effective access. Prepare the concrete plan before
requesting Owner approval of cloud changes.

Design review must compare: an isolated backend project (requires explicit project
scope extension and a new guarded root) versus same-project corrections to every
overlapping direct/inherited/impersonation access path. Preserve app/scanner permissions
and require negative state-access tests before writing any state/lock object. Do not
pretend that removing `storage.objectViewer` alone establishes isolation.

The collector's report includes IAM metadata and role definitions, not secret payloads
or access tokens. Run it in the authenticated Windows session; save a fresh report
without overwriting files. This is not an autonomous automation or a cloud apply.

Source references:
https://docs.cloud.google.com/storage/docs/access-control/iam
https://docs.cloud.google.com/iam/docs/roles-permissions/firebase


## 2026-10-09 authenticated ancestor/account review

The full collector now verifies the staging project number and parent organization.
All four overlapping runtime Storage grants are unconditional. Owner-provided
organization policy lists only the human operator; runtime account-level Token Creator
is a self-grant. No existing dedicated state project was identified in the returned
active direct-child project list. These snapshots narrow the isolation design but do
not substitute for fresh effective-access tests.

Recommended preparation is documented in
`docs/release/AUDIT_STAGING_STATE_ISOLATION_DESIGN_74.md`: a new state-only project
candidate, preserving staging application/scanner IAM. This is not selection approval
or permission to create/link/enable/apply. The existing same-project bootstrap stays
blocked. Billing, organization constraints, names, guarded root and exact local-state
plan are required before requesting concrete bootstrap approval.
