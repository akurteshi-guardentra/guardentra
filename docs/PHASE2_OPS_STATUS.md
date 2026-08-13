# Phase 2 ops enablement — status

_Last verified: 2026-08-11 (staging-dod-prove: **PASS** — Direct VPC + HTTP emit/verify)_

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

## Remaining (human / console)

| Item | Notes |
|------|-------|
| Firebase CLI reauth | `npx firebase-tools login --reauth` (or `npm run firebase:reauth`) — blocks backends list + formal `grantaccess` + App Hosting rollout trigger |
| Confirm `grantaccess` via CLI | After reauth: `npx firebase-tools apphosting:secrets:grantaccess AUDIT_DATABASE_URL --project=guardentra-7f582` (IAM already green via gcloud) |
| Commit + App Hosting rollout | Push `apphosting.yaml` `AUDIT_*` so main traffic mounts `AUDIT_DATABASE_URL` with spine **false** |
| Optional cleanup | Temp `allow-iap-ssh` firewall + `gs://guardentra-audit-migrate-eu` — see staging doc |

## Direct VPC + HTTP prove (completed 2026-08-11)

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

## Staging spine ON without flipping prod

There is **one** App Hosting backend (`guardentra` in `us-central1`) serving guardentra.com. Do **not** set `AUDIT_SPINE_ENABLED=true` on 100% traffic.

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

### B) Console override (when a real staging backend exists)

1. Firebase console → App Hosting → **staging** backend → Environment.
2. Override `AUDIT_SPINE_ENABLED=true` (do not change shared yaml default).
3. Redeploy / wait for rollout.
4. `BASE_URL=<staging> TENANT_ID=<org> AUTH_BEARER=<id_token> npm run verify:audit-spine`

**Never** set `AUDIT_SPINE_ENABLED=true` on the production / 100% traffic backend until product sign-off.

## Proxy migrate (ops)

```powershell
# From a host that can reach private IP (GCE in VPC), or after Auth Proxy is up:
powershell -File scripts/phase2-cloudsql-proxy-migrate.ps1
# Bastion one-shot helper (historical): scripts/bastion-prove2.sh — bastion deleted after PASS
```

## Ratified defaults

- Production spine remains **off** on 100% traffic (`guardentra-build-2026-08-10-001`); staging DoD proven on tagged `auditspine` only
- Never commit `.local-secrets/`, `.tfvars`, `.tools/`, or migrator URLs into App Hosting / git
