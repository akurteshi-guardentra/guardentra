# Phase 2 infrastructure (from Drive starter-kit)

Copied from Phase 2 Build the security spine starter-kit.

- `modules/secret-manager` — Week 0 first PR
- `modules/vpc` — Path B private VPC + Private Service Access (default off)
- `modules/cloud-sql` — Week 2 private IP (default off; needs VPC)
- `envs/eu-staging` — secrets always; optional `enable_vpc` then `enable_cloud_sql`

Follow `docs/PHASE2_WEEK0_START_HERE.md` and `docs/PHASE2_CLOUDSQL_STAGING.md`.
Prefer `migrations/audit/` over the starter-kit SQL stub.
