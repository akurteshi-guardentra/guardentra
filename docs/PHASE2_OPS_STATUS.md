# Phase 2 ops enablement — HISTORICAL 2026-08-11 status

> **HISTORICAL PROOF ONLY — DO NOT USE THESE COMMANDS FOR CURRENT #74 ENABLEMENT.**
>
> The proof below targeted `guardentra-7f582` before GuardEntra established the
> current named environments. Current staging is `guardentra-staging`; current
> production is `guardentra-prod`; `guardentra-7f582` is rollback/history only.
>
> Current #74 prerequisite: obtain a fresh **read-only** inventory of
> `guardentra-staging` Cloud SQL, VPC/private connectivity, App Hosting backend and
> runtime service account, non-secret audit env/config references, secret
> names/references, and the current `AUDIT_SPINE_ENABLED` state. Only then derive a
> new staging-only enablement/rollback packet. The historical commands in this file
> must not be replayed by substitution or copy/paste.
>
> Repository hardening being merged does not prove staging enablement. Require live
> exact-SHA emit → outbox → worker → hash-chain → verify/export plus tamper,
> stale-processing recovery, crash/retry exactly-once, health/readback and rollback
> evidence before any production promotion.

_Last historical verification: 2026-08-11 (staging-dod-prove: **PASS** — Direct VPC + HTTP emit/verify)_

## staging-dod-prove result: **PASS**

| Step | Result | Evidence |
|------|--------|----------|
| Custom-token mint | **PASS** | ADC + `roles/iam.serviceAccountTokenCreator` on `firebase-adminsdk-fbsvc@guardentra-7f582.iam.gserviceaccount.com` for `user:admin@guardentra.com`; `createCustomToken` → Identity Toolkit ID token OK |
| Cloud Run proxy | **PASS** | `gcloud run services proxy … --tag=auditspine --port=8787` |
| Tagged `/api/health` | **PASS** | **200** via proxy |
| Firebase auth on `/api/audit/*` | **PASS** | Bearer Firebase ID token accepted |
| HTTP emit / verify | **PASS** | emit **200** `queued:true`; verify **200** `ok:true` checked=1; `verify:audit-spine` exit 0 |
| HTTP tamper | **not run** | Needs migrator DB (bastion emit/verify/tamper already **PASS** 2026-08-11) |
| Dual Firebase EU/US | **DONE (gated)** | Org Owner runbook — see [`PHASE2_DUAL_FIREBASE.md`](./PHASE2_DUAL_FIREBASE.md) |

**Unblock applied:** Created subnet `guardentra-eu-staging-us-central1` (`10.10.1.0/24`) on VPC `guardentra-eu-staging`; redeployed tagged rev `guardentra-00077-juw` with Direct VPC (`--network` / `--subnet` / `--vpc-egress=private-ranges-only`), gen2, Cloud SQL annotation, spine ON @ **0%** traffic.

## Completed (green)

| Item | Evidence |
|------|----------|
| Local + Cloud SQL live prove | Bastion Auth Proxy: emit/verify/tamper **PASS** (2026-08-11); bastion VM deleted |
| Cloud SQL users | `audit_app`, `audit_migrator` on `guardentra-audit` |
| Schema migrate | GCS import `001_init` + `002_roles` + schema_migrations marks |
| Secret Manager versions | `AUDIT_DATABASE_URL` (unix socket), `AUDIT_SPINE_ENABLED=false`, migrator + proxy ops secrets |
| `roles/cloudsql.client` | App Hosting SA (bastion SA was temporary; bastion gone) |
| Secret Manager accessor | `firebase-app-hosting-compute@guardentra-7f582.iam.gserviceaccount.com` → `roles/secretmanager.secretAccessor` on `AUDIT_DATABASE_URL` |
| `apphosting.yaml` | `AUDIT_SPINE_ENABLED=false` (prod-safe default), `AUDIT_DATABASE_URL` secret ref, `AUDIT_WORKER_ENABLED=true` (local tree; **not yet rolled out** via App Hosting build) |
| us-central1 Direct VPC subnet | `guardentra-eu-staging-us-central1` `10.10.1.0/24` on `guardentra-eu-staging` |
| Tagged staging prove revision | Tag `auditspine` → rev `guardentra-00077-juw` @ **0% traffic**; Direct VPC + Cloud SQL + spine ON |
| Prod traffic spine OFF | **100%** still on `guardentra-build-2026-08-10-001` (no `AUDIT_*` env) |
| Firebase ID token mint (ops) | Token Creator binding on `firebase-adminsdk-fbsvc@…` for `admin@guardentra.com` |
| staging-dod-prove HTTP | **PASS** 2026-08-11 via proxy → emit/verify/chain |

## Historical remaining items from 2026-08-11 — NOT CURRENT WORK

The original proof still had legacy reauthentication, secret-grant, rollout, and cleanup
tasks outstanding. Those steps are **not** current operator instructions.

Current #74 work begins with the #116 read-only inventory of `guardentra-staging`, then a
fresh exact-SHA staging-only enablement/rollback packet. Do not replay the historical
`guardentra-7f582` grant-access, rollout, project-selection, firewall, storage-cleanup,
or Cloud Run mutation commands from this document.

## Historical Direct VPC + HTTP prove (completed 2026-08-11) — evidence only

```powershell
$gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$proj = "guardentra-7f582"
$img = "us-central1-docker.pkg.dev/guardentra-7f582/firebaseapphosting-images/guardentra@sha256:d8c104bcb445b0b8851f203d24a1bb454bdefe4c3050fa134c7023aeb0b6bef7"
$sa = "firebase-app-hosting-compute@guardentra-7f582.iam.gserviceaccount.com"

# 1) Subnet (created)
& $gcloud compute networks subnets create guardentra-eu-staging-us-central1 `
  --project=$proj --network=guardentra-eu-staging --region=us-central1 `
  --range=10.10.1.0/24 --enable-private-ip-google-access

# 2) Tagged revision @ 0% with Direct VPC (gen2 required)
& $gcloud run deploy guardentra --project=$proj --region=us-central1 --image=$img `
  --service-account=$sa `
  --execution-environment=gen2 `
  --network=guardentra-eu-staging --subnet=guardentra-eu-staging-us-central1 `
  --vpc-egress=private-ranges-only `
  --add-cloudsql-instances=guardentra-7f582:europe-west3:guardentra-audit `
  --update-secrets=AUDIT_DATABASE_URL=AUDIT_DATABASE_URL:latest `
  --update-env-vars=AUDIT_SPINE_ENABLED=true,AUDIT_WORKER_ENABLED=true,APP_ENV=production `
  --no-traffic --tag=auditspine

# 3) Proxy + prove
& $gcloud run services proxy guardentra --region=us-central1 --project=$proj --tag=auditspine --port=8787
$env:AUDIT_SPINE_ENABLED = "true"
$env:BASE_URL = "http://127.0.0.1:8787"
node scripts/staging-dod-http-prove.mjs
```

**Tamper:** bastion PASS stands; not re-run on HTTP path.

## Historical spine-ON proof without flipping then-production traffic

**Historical 2026-08-11 topology:** the proof then used one legacy App Hosting backend
(`guardentra` in `us-central1`). This sentence is historical evidence, not a statement
about the current guardentra.com serving backend. Current traffic/backend authority must
come from #116/#126 live inventory.

### A) Tagged Cloud Run revision (agent path)

```text
tag:      auditspine
revision: guardentra-00077-juw
url:      https://auditspine---guardentra-bwbcopcc5q-uc.a.run.app
env:      AUDIT_SPINE_ENABLED=true, AUDIT_WORKER_ENABLED=true, AUDIT_DATABASE_URL=<secret>
vpc:      Direct VPC guardentra-eu-staging / guardentra-eu-staging-us-central1, egress=private-ranges-only, gen2
```

Mint without browser (after Token Creator grant — already applied):

```powershell
# Requires: gcloud ADC, VITE_FIREBASE_API_KEY in .env.local, proxy on :8787
$env:AUDIT_SPINE_ENABLED = "true"
$env:BASE_URL = "http://127.0.0.1:8787"
node scripts/staging-dod-http-prove.mjs
```

Browser fallback: sign in at guardentra.com → DevTools → copy Bearer → `AUTH_BEARER=… npm run verify:audit-spine`.

### B) Historical console-override concept

This section records how the 2026-08-11 proof was conceived. It does not authorize a
current console override or rollout. Current staging enablement must be generated from
fresh #116 inventory under #74, with exact environment binding, rollback, health/readback,
and no production mutation.

## Historical proxy-migrate note

The old proxy-migrate and bastion helpers are historical evidence and are quarantined by
#130. Do not run them for current staging. Generate a fresh environment-bound migration
or prove packet only after #116 inventory identifies the current topology.

## Ratified defaults

- Production spine remains **off** on 100% traffic (`guardentra-build-2026-08-10-001`); staging DoD proven on tagged `auditspine` only
- Never commit `.local-secrets/`, `.tfvars`, `.tools/`, or migrator URLs into App Hosting / git
