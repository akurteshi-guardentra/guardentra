# Audit app role NOLOGIN hardening (#74)

## Purpose

Keep `audit_app` as a NOLOGIN privilege role without putting role-administration
authority into the restricted `audit_migrator` path, and without rewriting applied
`002_roles.sql` history.

## Split authority (required)

| Path | Actor | Responsibility |
|---|---|---|
| `scripts/audit-managed-staging/bootstrap-prerequisites.sql` | Role admin on empty DB | Create `audit_app` NOLOGIN (+ migrator/runtime) |
| `scripts/audit-managed-staging/admin-harden-audit-app.sql` | Role admin on non-empty/unsafe DB | `ALTER … NOLOGIN` / `PASSWORD NULL` or create if missing |
| `migrations/audit/003_harden_audit_app_nologin.sql` | `audit_migrator` only | **Verify** NOLOGIN + re-assert GRANTs/REVOKEs |

PostgreSQL 16 requires a role administrator to change another role’s attributes.
The restricted migrator must fail closed on `ALTER ROLE` / elevated memberships
(`scripts/audit-managed-staging/core.mjs`). Merely making `ALTER` idempotent does
not remove that privilege requirement.

## Managed runner set

Allowlisted migrations (lexical order):

1. `001_init.sql`
2. `002_roles.sql` (greenfield `CREATE ROLE audit_app NOLOGIN` if missing)
3. `003_harden_audit_app_nologin.sql` (verify + grants)

Checksums live in `scripts/audit-managed-staging/manifest.json`.

## Existing LOGIN / password environments

1. Run `admin-harden-audit-app.sql` under an approved role administrator (separate Owner apply).
2. Then run the restricted migrator for `001`–`003`.
3. Do **not** expect `runMigrations()` to repair LOGIN attributes.
4. Do **not** fabricate `schema_migrations` rows for admin SQL.

## Explicit non-actions

- SQL is **not** applied by this documentation/source PR
- Terraform / IAM / Firebase / Cloud SQL are **not** modified here
- Staging and production are **not** deployed

## Validation

- Unit: `scripts/audit-managed-staging/unit.test.mjs`
- Disposable PostgreSQL 16: `scripts/audit-managed-staging/postgres.test.mjs`
- Static Vitest: `src/tests/auditAppRoleNologinMigration.test.ts`
