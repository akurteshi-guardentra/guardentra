# Managed named-staging audit migration runner — preparation only

This package is separate from the frozen application RC. It performs no cloud build,
job deployment, identity/credential creation or migration merely by installation or
CI. Do not run run.mjs on Windows or against existing customer databases.

## Scope and checks

The cloud entry point hard-limits the exact staging connection/database, restricted
audit_migrator username and guardentra-audit-migrator-74 job name. Password input
must be AUDIT_MIGRATOR_PASSWORD via a pinned secret reference, never a URL fallback.
Cloud SQL Connector PRIVATE transport uses the job's attached identity; no key file
or credential override. Its encrypted connector transport is not inferred from
PostgreSQL pg_stat_ssl. Raw errors and credentials are never printed.

Both reviewed SQL migrations are hashed over UTF-8 text with CRLF normalized to LF.
The exact manifest/set is checked before connecting. PostgreSQL 16, exact database,
restricted login/session identity, no inherited migrator memberships, an unprivileged
NOLOGIN audit_app with no inherited memberships, installed pgcrypto and ownership
of public schema must already be established by a separately approved bootstrap.
This package does not create LOGIN identities or provision passwords.

Execution acquires a nonblocking advisory lock; transactions apply migrations and
record canonical SHA256 in a migrator-owned schema_migrations table. Repeated runs
skip matching history; missing legacy hash columns, unknown entries and mismatched
hashes fail for explicit reconciliation. No legacy history is silently upgraded.
A concurrent run exits with failure; Cloud Run retries must be configured zero.
Failed migrations roll back individually; previously committed migrations remain.

## Real verification

Inside this directory, npm ci --ignore-scripts then npm test checks scope and manifest.
The infra-ci managed-audit-runner job runs npm run test:postgres against a separate
disposable PostgreSQL 16 service at 127.0.0.1/guardentra_audit_runner_ci, trust auth.
The test creates restricted roles/schema prerequisites as fixture admin, then runs
the actual migration core twice as audit_migrator. It verifies app positive operations
and denied tampering/DDL/history/role escalation, checksum mismatches, unexpected
role inheritance and concurrency. Synthetic privilege data is rolled back.
These tests do not contact GCP or prove Cloud SQL bootstrap, private transport,
actual job IAM/secrets, application connector, tenant isolation or durable events.

## Build and execution gates

Do NOT submit the repository root to Cloud Build. First stage an allowlisted build
context from one exact reviewed Git commit with only:
- Dockerfile, package.json, package-lock.json, core.mjs, run.mjs, manifest.json
- migrations/001_init.sql and migrations/002_roles.sql from that same commit

Dockerfile is intended for that staged context. Never copy .env, credentials, state,
plans, dirty worktree files or application sources. Resolve/pin the Node base-image
digest and record built runner digest before job deployment approval. No actual
build-context generation or Cloud Build submission command is delivered yet.

BLOCKED: secret isolation must be reconciled before provisioning any credentials.
Earlier staging IAM includes project-wide Secret Accessor for application runtime,
Cloud Build and App Hosting principals. A new staging secret with a migrator-only
resource binding does not cancel those inherited grants. Do not put bootstrap/admin
or migrator secrets in that project and claim isolation. Obtain fresh policy/role
metadata, prepare an isolated credential location or reviewed IAM correction, then
request exact Owner authorization. Do not repurpose the state-only project or remove
existing runtime grants without a separately reviewed scope.

Next packet needs: bootstrap implementation and role/privilege proof; isolated secret
project/resource/version references and access evidence; API/resource changes; exact
source/image digest; build costs; job specification; positive and negative live tests;
rollback/custody. No credential mutation, cloud job execution, app rollout or
production action is authorized by this package.
