# Audit database TLS: pin the Cloud SQL server CA (#74 A3)

**Status:** source only. Nothing in any environment uses this yet.

## Problem

Staging's `AUDIT_DATABASE_URL` connects over the private IP with `sslmode=no-verify`.
The link is encrypted, but the server certificate is never checked, so anything on
the network path that can present *a* certificate is accepted as the audit database.
A local proof (below) shows that setting connecting to an impostor server.

## Change

`server/lib/audit/pool.ts` reads an optional `AUDIT_DATABASE_CA_CERT` (PEM).

| `AUDIT_DATABASE_CA_CERT` | Behaviour |
|---|---|
| unset or blank | Unchanged: the pool uses `AUDIT_DATABASE_URL` exactly as today. |
| a PEM certificate | TLS required; the server chain must lead to that CA (`verify-ca`). Host name is not compared, because Cloud SQL server certificates name the instance, not the private IP. Any `ssl*` / `uselibpqcompat` parameters in the URL are removed, since node-postgres lets the URL override the ssl object. |
| anything else | Boot fails closed: `AUDIT_DATABASE_CA_CERT must be a PEM certificate`. |

A key/value connection string (`host=... sslmode=...`) is refused when a CA is pinned,
because its `sslmode` cannot be stripped safely; use the `postgres://` form.

## Proof (local, disposable PostgreSQL 16 with TLS, synthetic certificates)

| Server presents | `no-verify` URL (today) | CA pinned |
|---|---|---|
| certificate from the pinned CA | connects (TLSv1.3) | connects (TLSv1.3) |
| impostor certificate from another CA | **connects** | **refused** (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) |

Unit tests: `src/tests/auditDatabaseTls.test.ts`.

## Rollout (each step owner-authorized; none done)

1. Read the instance's server CA (read-only):
   `gcloud sql instances describe guardentra-staging-audit --project guardentra-staging --format="value(serverCaCert.cert)"`.
   The server CA is public data, not a credential.
2. Store it as a Secret Manager secret or a plain App Hosting value named
   `AUDIT_DATABASE_CA_CERT` (staging backend only), RUNTIME availability.
3. Roll out staging; check `/api/audit/verify` still reports the chain valid and
   new events reach the journal.
4. Rollback: remove the variable and roll out again. The URL's `sslmode=no-verify`
   is then used exactly as before.
5. Note the CA's expiry and the Cloud SQL server CA rotation procedure: rotating the
   instance CA without updating this value stops audit writes (journal intents stay
   pending and replay once fixed).
