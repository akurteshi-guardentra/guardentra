# Audit app role NOLOGIN hardening (#74)

## Purpose

Correct unsafe `audit_app LOGIN PASSWORD 'audit_app'` behavior that may exist from
`migrations/audit/002_roles.sql` on release baseline `237a6260…`, without rewriting
already-applied migration history and without overwriting infrastructure work in
[PR #183](https://github.com/akurteshi-guardentra/guardentra/pull/183).

## Change

- New versioned migration: `migrations/audit/003_harden_audit_app_nologin.sql`
- Forces `audit_app` to `NOLOGIN` and clears any role password
- Re-asserts append-only grants/revokes (idempotent)

## Reconciliation with PR #183

PR #183 changes greenfield `002_roles.sql` to create `audit_app NOLOGIN`. This branch
leaves `002_roles.sql` untouched so it does not fight that PR. After both land:

1. Fresh installs: `002` creates NOLOGIN; `003` is a no-op harden + grant assert
2. Environments that already applied unsafe `002`: `003` removes LOGIN/password

## Explicit non-actions

- SQL is **not** applied by this PR
- Terraform / IAM / Firebase / Cloud SQL are **not** modified
- Staging and production are **not** deployed

## Validation (local, safe)

- Static contract test: `src/tests/auditAppRoleNologinMigration.test.ts`
- Does not require a live database
