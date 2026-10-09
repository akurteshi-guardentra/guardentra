# Issue #74 — private migration execution design

Status: PREPARATION PROPOSAL; no credential operation, job deployment or SQL execution.
Owner continuation permits preparation; prior exact infrastructure approval does not
authorize these additional cloud resources, credentials or application rollout.

## Verified starting point

Infrastructure executable 89637c01768808ecd203f89102c2dabe4707ee3a was applied.
Owner API output confirms PostgreSQL 16 RUNNABLE at 10.20.0.2, private-only,
ENCRYPTED_ONLY, API deletion protection, regional HA and enabled backups/PITR.
One automated backup is SUCCESSFUL in location us; no restore has been executed.
Database guardentra_audit exists, UTF8/en_US.UTF8. Returned SQL users list contains
postgres only; it is not a complete pg_roles/privilege inventory.

Active revision guardentra-staging-build-2026-09-14-001 has AUDIT_SPINE_ENABLED=false.
AUDIT_DATABASE_URL references secret-alias-3, version 1, no inline value; returned
annotation maps alias to staging AUDIT_DATABASE_URL. Its value was not inspected.
Direct VPC default/us-central1/default with private-ranges-only egress is configured;
no Cloud SQL socket attachment is shown. Network/TLS/authentication remain untested.
Preserve this revision, traffic, secret version and disabled audit state.

## Selected candidate and exact scope

Prepare two one-task Cloud Run jobs in guardentra-staging/us-central1, using Direct
VPC egress on existing default network and us-central1 default subnet. No inbound
service, scheduler, public IP, firewall change or scanner VM reuse. Candidate limits:
1 CPU, 512 MiB, concurrency one, one task, 10-minute task timeout, zero retries.
Cloud execution/build/image/secret storage is separately billed; no price cap is
claimed. Resolve actual API readiness, name collisions and immutable image digest
before producing the execution packet. Deployment and execution are separate steps.

| Candidate resource | Intended use | Privilege boundary |
|---|---|---|
| guardentra-audit-bootstrap-74 service account / job | Initial administrative role and schema prerequisites only | Cloud SQL Client plus access only to reviewed bootstrap/input secret resources; no Owner, Editor, state-bucket access or long-lived key |
| guardentra-audit-migrator-74 service account / job | Run exact migrations and repeat/privilege verification | Cloud SQL Client plus only migrator credential secret access; no application credential or admin secret access |
| audit_migrator PostgreSQL LOGIN | Own audit objects and apply migrations | No superuser, CREATEDB, CREATEROLE, replication or BYPASSRLS; necessary public-schema ownership/grants established explicitly by bootstrap |
| audit_runtime PostgreSQL LOGIN | Application persistence | Member of audit_app NOLOGIN only, no schema/table ownership or administrative attributes |
| Dedicated bootstrap secret | Temporary administrative DB authentication | Reviewed postgres credential setup needed; do not assume or reset a pre-existing password |
| AUDIT_DATABASE_URL_MIGRATOR | Migrator-only input | Version-pinned reference, never mounted on application runtime |
| New app credential version | Future application connection | Never overwrite/use version 1 blindly; no runtime adoption until separate rollout approval |

Role names and resources above are proposed and must be checked for collisions before
creation. Do not create builtin application users through an API and assume they have
limited rights: Cloud SQL builtin user creation can grant cloudsqlsuperuser. Bootstrap
SQL must explicitly establish and verify restricted attributes and memberships.

Use the official Node Cloud SQL Connector with PRIVATE IP for jobs. It supplies
authenticated encrypted transport; database LOGIN authentication remains separate.
VPC connectivity must already exist. Do not use sslmode=no-verify, plaintext direct
pg connections, public-IP enablement or a local Windows proxy without a VPC route.
Job image must contain pinned dependencies, exact reviewed migration bytes/checksums
and only runner files; never include .env, credentials, Terraform state or plans.

## Runner implementation requirements before execution approval

- Add a separate managed-staging runner without modifying frozen application RC.
  Hard-limit project, connection name and database; require explicit migration mode
  and migrator credential. No fallback to AUDIT_DATABASE_URL or postgres.
- Bootstrap must create pgcrypto and audit_app NOLOGIN before the restricted migrator
  executes 002_roles.sql; that file conditionally creates a role, which otherwise
  needs CREATEROLE. Establish public-schema ownership/grant authority explicitly,
  without giving the runtime CREATE or migration-history write permissions.
- Verify current_user, session_user, role attributes/memberships and database identity
  before mutation. Validate expected role ownership and no unexpected existing schema.
- Serialize migration execution with an advisory lock, use per-migration transactions,
  validate the exact migration set/checksums and produce only safe identifiers/counts.
- Catch failures without logging URLs, passwords, tokens, SQL parameter values or raw
  driver errors. Exit nonzero; zero automatic retries, no destructive recovery.
- Test both migrations against real PostgreSQL 16 as the restricted migrator, then
  repeat through the Node runner; prove the second run applies no new migration.
  Existing CI SQL fixture uses postgres and is insufficient for this runner claim.
- Prove runtime INSERT/SELECT and required outbox/metadata updates; reject audit-event
  UPDATE/DELETE/TRUNCATE, hash-chain UPDATE/DELETE/TRUNCATE, role escalation, schema
  creation/ownership and migration-history modification. Use synthetic rolled-back
  data; CI role-contract.sql is disposable-fixture-only and must not be run live.
- Pin built image digest, dependency lock, source commit, all secret version references,
  exact IAM/role changes and final job specification in the future execution packet.

## Order, rollback and remaining gates

1. Read API/job/secret metadata and check names; no secret payload reads.
2. Prepare runner, bootstrap SQL, real CI tests and build specification; run checks.
3. Present exact staged build/resource/credential/job-execution packet for Owner
   approval before any additional cloud or credential mutation.
4. Bootstrap restricted roles, run migrations twice, execute rollback-only privilege
   proof, capture safe results, remove temporary bootstrap access by reviewed action.
5. Prepare a separate app connection/config change. Existing pg.Pool uses only the
   URL; it has no connector integration, and documented socket path is not present
   in observed runtime configuration. A job connector does not fix the application.
6. Separately approve staging rollout and prove org/admin and vendor-portal events,
   chain/readiness verification, observability and rollback under #74. Production
   requires a separate explicit instruction.

Failure handling: stop and retain state/resources/log metadata; no repeat apply,
secret-version destruction, table drop, down-migration, peering removal or disabling
protection. Keep audit disabled until acceptance. Application rollback preserves
audit records and infrastructure; credential cleanup is a separate reviewed action.
Actual state recovery, scanner request/health tests and long-term retention ownership
remain open. Seven retained backups do not implement seven-year audit retention.

Sources: issue #74; Owner CLI outputs in this session;
migrations/audit/001_init.sql and 002_roles.sql; scripts/migrate-audit.mjs;
server/lib/audit/pool.ts; apphosting.yaml; docs/PHASE2_CLOUDSQL_STAGING.md (historical only).
Primary transport/job/role references:
https://github.com/GoogleCloudPlatform/cloud-sql-nodejs-connector
https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc
https://docs.cloud.google.com/run/docs/configuring/jobs/secrets
https://docs.cloud.google.com/sql/docs/postgres/users


## 2026-10-09 — runner candidate and credential-isolation correction

Owner inventory returns no jobs, no matching audit service accounts and only staging
AUDIT_DATABASE_URL secret. Prepared isolated scripts/audit-managed-staging package,
locked connector/pg dependencies, exact-target/no-fallback guardrails, migration
checksums/advisory lock and restricted PostgreSQL 16 CI execution/privilege contract.
Local Node syntax and three unit tests PASS; real PostgreSQL/CI pending at publication.
No cloud build, role/password creation, secret write or job execution performed.

The candidate secret-placement design above is BLOCKED: earlier staging IAM grants
application runtime and build/hosting principals project-wide Secret Accessor.
Resource-level access assigned to a job cannot cancel inherited runtime access.
Do not create admin/migrator secrets in staging and claim separation. Fresh policy
and role metadata is needed before selecting isolated credential custody or scoped
IAM correction. No state-project repurpose, IAM removal, token/key creation or
password operation is authorized. Runner bootstrap, build context/base-image pin,
exact cloud execution packet and application connector integration remain pending.


## 2026-10-10 — allowlisted migration build context checkpoint

Issue #74 preparation on infra/named-staging-audit-74 / draft PR #183, starting
bcb608e717bb4cf917785a07e3a2b5c827883662. Owner directed continuation toward dev,
test/staging and production rollout. This authorizes further preparation, not an
application release or production mutation. Added a Git-object-only eight-file
runner context generator requiring exact source SHA and Node base-image digest.
It rejects extra/modified SQL, mutable source refs and unpinned base inputs; a
receipt outside the context records hashes. No build submission/cloud mutation.

Local npm test PASS: five tests, zero failures, including two real disposable-Git
context/exclusion/negative tests and the existing three scope/manifest tests. The
new generator does not verify registry provenance or image availability. No local
PostgreSQL server: existing real PostgreSQL CI proof is unchanged; fresh CI pending
publication. Exact update files: scripts/audit-managed-staging/stage-context.mjs,
scripts/audit-managed-staging/stage-context.test.mjs,
scripts/audit-managed-staging/package.json, scripts/audit-managed-staging/README.md,
docs/release/AUDIT_STAGING_MIGRATION_DESIGN_74.md,
docs/release/AUDIT_STAGING_PREPARATION_TASK_74.md,
docs/agent-ops/PROJECT_STATE.md, docs/agent-ops/PROJECT_TRANSITIONS.md.
Source checkpoint NOT COMMITTED at preparation; working changes limited to this
list (verified by git status). No application deployment, merge, new secret version,
SQL/bootstrap execution, IAM mutation or production change. Rollback of this source
preparation is a feature-branch revert; it has no live resource side effects.

Deployment mapping is documented as dev -> guardentra-dev sandbox,
test -> guardentra-staging, main -> guardentra-prod. ENVIRONMENTS.md still says dev
"create when ready" and also contains stale "only demo exists" text, contradicted
by current staging/prod evidence; documentation is not live backend inventory.
Do not claim a live dev backend or deploy to legacy demo from those instructions.
The next actual app rollout remains blocked by bootstrap/credential/job setup,
live migrations and separate app connector/rollout approval. Production follows
staging durable events/chain/failure/rollback acceptance, never just Terraform apply.
No numeric readiness score or calendar deployment promise is minted here.
