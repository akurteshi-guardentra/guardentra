# Authoritative evidence malware scanner (P0)

## Flow

```text
portal upload (Storage portal/{assessmentId}/{file})
  → POST /api/portal/evidence-validate
      → metadata classify → scan_pending | quarantined | scan_failed
      → Admin write assessments/{id}.evidenceTrustByStoragePath
      → if scan_pending + enabled:
           await durable enqueue (Cloud Tasks) OR inline setImmediate
  → scanner worker (ClamAV)
      → clean | quarantined | scan_failed
      → Admin write trust record bound to Storage generation
  → reviewer download / approved decision require authoritative clean
```

Clients **cannot** write `evidenceTrustByStoragePath` (Firestore rules).  
Metadata validation **never** writes `clean`.

## Modules

| Path | Role |
|------|------|
| `src/lib/vendor/evidenceTrust.ts` | States, generation binding, `buildScannerTrustRecord` |
| `server/lib/malwareScanner/` | ClamAV engine + scan/write + Cloud Tasks adapter |
| `server/routes/scanner.ts` | `POST /api/internal/evidence-scan` (shared secret) + `POST /api/internal/evidence-scan-task` (OIDC) |
| `server/lib/evidenceAccess.ts` | Validate → await enqueue |

## Trigger / delivery mechanisms

1. **Post-validate enqueue** after `scan_pending` is persisted:
   - `EVIDENCE_SCANNER_DELIVERY=inline` (default): process-local `setImmediate` — **not durable** across process exit.
   - `EVIDENCE_SCANNER_DELIVERY=cloud_tasks`: **await** Cloud Tasks `createTask` **before** HTTP 200. Incomplete cloud_tasks config fails closed.
2. **HTTP** `POST /api/internal/evidence-scan` with `Authorization: Bearer $EVIDENCE_SCANNER_SECRET`
   (or `x-evidence-scanner-secret`) — manual/diagnostic / optional Eventarc proxy.
3. **HTTP** `POST /api/internal/evidence-scan-task` — Cloud Tasks worker. Google-signed **OIDC only**
   (audience + task service account). Does **not** accept the scanner shared secret.

### Cloud Tasks contract (implementation in progress — infra not provisioned in #8H-A)

| Variable | Purpose |
|----------|---------|
| `EVIDENCE_SCANNER_DELIVERY` | `inline` (default) \| `cloud_tasks` |
| `EVIDENCE_SCANNER_TASK_PROJECT` | GCP project for the queue |
| `EVIDENCE_SCANNER_TASK_LOCATION` | Queue region (e.g. `us-central1`) |
| `EVIDENCE_SCANNER_TASK_QUEUE` | Queue id |
| `EVIDENCE_SCANNER_TASK_TARGET_URL` | Absolute URL to `/api/internal/evidence-scan-task` |
| `EVIDENCE_SCANNER_TASK_AUDIENCE` | Exact OIDC audience |
| `EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT` | Exact task SA email for OIDC |

Task body fields **only**: `assessmentId`, `storagePath`, `generation`, optional `organizationId`.
**Never** includes `EVIDENCE_SCANNER_SECRET`, Firebase ID tokens, or other credentials.
Task id is a deterministic hash of `(assessmentId, storagePath, generation)`; `ALREADY_EXISTS` = success.

Eventarc remains optional and **not configured**. Cloud Tasks is the durability path for post-validate scans.

## Malware engine

- **Production:** ClamAV via `clamd` TCP INSTREAM (`CLAMAV_HOST`, `CLAMAV_PORT` default 3310).
- **Tests/local only:** `EVIDENCE_SCANNER_MODE=eicar_only` (EICAR detection). Hosted
  `APP_ENV` values `staging` / `prod` / `production` reject test-only modes and
  missing/invalid `CLAMAV_HOST`/`CLAMAV_PORT` at startup when the scanner is enabled.
  Do not silently downgrade a hosted scanner to eicar-only.

If the scanner is enabled in a hosted environment without ClamAV config, startup
fails closed. If ClamAV is configured but unreachable at scan time, the verdict
is **`scan_failed`** (fail closed). The app remains deployable with
`EVIDENCE_SCANNER_ENABLED=false` until scanner infrastructure is configured.

## Trust write path

`assessments/{assessmentId}.evidenceTrustByStoragePath[encodeTrustMapKey(storagePath)]`

Fields include `state`, `storagePath`, `generation`, `updatedAt`, `scanner.{engine,verdict,signature,scannedAt}`.

A different Storage generation supersedes the prior trust record and starts a new
lifecycle (`shouldReplaceTrustRecord`). The same generation is terminal-immutable:
only an identical `clean` | `quarantined` | `scan_failed` verdict may be replayed.

Scanner terminals require a matching `scan_pending` record for the live generation
(`canPersistScannerVerdict`). Premature Eventarc/finalize must not call the engine
or write `clean` / `quarantined` / `scan_failed`; later metadata validation may
still create `scan_pending` and the normal enqueue scan proceeds.

Approval of `approved` re-checks live Storage metadata and requires
`reviewerTrustMatchesObject` against the current object generation. A scanner
event whose `generation` does not match the live object is rejected as
`stale_generation` and does not write trust.

## Staging ClamAV infrastructure (operator-verified)

Operator-verified infrastructure evidence (Actions #4–#8A).
This is **not** independently GitHub-verified cloud state.

| Item | Value |
|------|-------|
| ClamAV VM | **PROVISIONED — OPERATOR VERIFIED 2026-09-11** |
| Project | `guardentra-staging` |
| VM | `guardentra-staging-clamav-01` |
| Region / zone | `us-central1` / `us-central1-a` |
| Static private IP | `10.128.0.2` |
| External IP | **NONE** |
| Network / subnet | `default` / `default` |
| CIDR | `10.128.0.0/20` |
| TCP port | `3310` |
| Cloud NAT | existing `guardentra-staging-nat` reused (`guardentra-staging-nat-router`) |
| Firewall | `allow-guardentra-staging-clamav` — source `10.128.0.0/20`, target tag `guardentra-clamav`, `tcp:3310` |
| clamav-daemon | active |
| clamav-freshclam | active |
| Clean-file scan (on VM) | PASS (Infected files: 0) |
| Direct VPC egress (repo + live) | `PRIVATE_RANGES_ONLY` on `default`/`default` |
| `CLAMAV_HOST` / `CLAMAV_PORT` | `10.128.0.2` / `3310` (RUNTIME) |

### Action #7B — exact-commit staging rollout (VPC + ClamAV host)

| Item | Value |
|------|-------|
| Source commit | `ebcf6cae16a03b1f66e889d3548054d8ca005739` (PR #52) |
| Rollout | `rollout-2026-09-12-001` (SUCCEEDED) |
| Build | `build-2026-09-12-001` (READY) |
| Cloud Run revision | `guardentra-staging-build-2026-09-12-001` (100% traffic at #7B) |

### Private connectivity (operator-verified)

| Item | Value |
|------|-------|
| Connectivity test | `guardentra-staging-clamav-3310` |
| Result | **REACHABLE** |
| Source | App Hosting revision → `10.128.0.2:3310` TCP |
| ClamAV VM | `guardentra-staging-clamav-01` |

### Action #8A — scanner secret (Secret Manager)

| Item | Value |
|------|-------|
| Secret ID | `EVIDENCE_SCANNER_SECRET` |
| Status | **CREATED** in `guardentra-staging` Secret Manager |
| Version | `1` enabled |
| Secret value | **NEVER LOGGED / NOT STORED IN REPO** (symbolic `secret:` reference only) |
| Runtime SA | `firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com` |
| IAM | `roles/secretmanager.secretAccessor` |
| Scope | `EVIDENCE_SCANNER_SECRET` only |

### Action #8D — secret-reference revision live

| Item | Value |
|------|-------|
| Project | `guardentra-staging` |
| Rollout | `rollout-2026-09-12-002` (SUCCEEDED) |
| Build | `build-2026-09-12-002` (READY) |
| Revision | `guardentra-staging-build-2026-09-12-002` (100% traffic) |
| Source SHA | `483204bb9291371d6faf36ffa70909f13d58291b` |
| Secret reference | **LIVE** (`EVIDENCE_SCANNER_SECRET` → Secret Manager) |
| Automatic scanner before #8F | **OFF** (`EVIDENCE_SCANNER_ENABLED` absent) |

### Action #8E — manual authenticated GuardEntra → ClamAV proof

| Item | Value |
|------|-------|
| Status | **PASS** |
| Health | HTTP 200 before / 200 after |
| No secret | HTTP **401** |
| Wrong secret | HTTP **401** |
| Stale generation | HTTP **409** `stale_generation` |
| Clean fixture | `state=clean`, `engine=clamav`, `verdict=clean`, replay **PASS** |
| EICAR fixture | `state=quarantined`, `engine=clamav`, `verdict=infected`, signature `Eicar-Test-Signature`, replay **PASS** |
| Fixture assessment | `scanner-e2e-1789239115031` |
| Cleanup | temporary Storage objects deleted; temporary Firestore assessment deleted; temporary script removed |
| Secret value | **NEVER LOGGED / NOT COMMITTED** |

### Action #8F-A — enable staging flag in config

| Item | Value |
|------|-------|
| `EVIDENCE_SCANNER_ENABLED` | **ENABLED IN STAGING CONFIG** (`value: "true"`, RUNTIME) |
| Commit | `5c3887097845d020c2d47dd1fa3a069739568cdc` |

### Action #8F-C — staging rollout (scanner flag LIVE)

| Item | Value |
|------|-------|
| Rollout | `rollout-2026-09-13-001` (SUCCEEDED) |
| Build | `build-2026-09-13-001` (READY) |
| Revision | `guardentra-staging-build-2026-09-13-001` (100% traffic) |
| Source SHA | `5c3887097845d020c2d47dd1fa3a069739568cdc` |
| `EVIDENCE_SCANNER_ENABLED` | **`true` LIVE** |
| Delivery at this revision | **inline** `setImmediate` (happy path only; not durable) |

### Action #8G — staging portal automatic scan E2E

| Item | Value |
|------|-------|
| Status | **PASS** |
| Revision | `guardentra-staging-build-2026-09-13-001` |
| Source | `5c3887097845d020c2d47dd1fa3a069739568cdc` |
| Portal session | **PASS** |
| Firebase client Storage upload | **PASS** |
| Clean | `scan_pending` → `clean` / `clamav` / `clean` |
| EICAR | `scan_pending` → `quarantined` / `clamav` / `infected` (`Eicar-Test-Signature`) |
| Direct `/api/internal/evidence-scan` calls | **ZERO** |
| Harness `EVIDENCE_SCANNER_SECRET` access | **ZERO** |
| Generation binding | **PASS** |
| Validate replay | **PASS** |
| Cleanup | **PASS** |
| Durability | **NOT YET PROVEN** (inline enqueue) |

### Action #8H-A — durable Cloud Tasks delivery (repo only)

| Item | Value |
|------|-------|
| Status | **IMPLEMENTATION IN PROGRESS** (this commit) |
| Code | Cloud Tasks adapter + OIDC worker route + await-before-200 enqueue |
| Cloud Tasks API / queue / IAM | **NOT PROVISIONED** (separate action) |
| Staging deploy of cloud_tasks mode | **NOT DONE** |
| Eventarc | **NOT CONFIGURED** |
| Production | **UNCHANGED** |

Enabling the staging flag / proving #8G does **not** establish durable delivery.
Durable Cloud Tasks infra + staging `EVIDENCE_SCANNER_DELIVERY=cloud_tasks` remain separate gates.

### Explicitly still offline / incomplete

| Control | Status |
|---------|--------|
| Staging automatic happy path (#8G) | **PROVEN** (inline) |
| Durable Cloud Tasks delivery | **CODE READY** — infra/config/deploy **NOT** done |
| Eventarc | **NOT CONFIGURED** |
| Production | **UNCHANGED** |

### Production

**Out of scope.** Do not add Direct VPC, ClamAV, scanner secrets, or scanner
enablement to `apphosting.prod.yaml` / `apphosting.production.yaml` until a
separate owner-authorized production workstream.

## Staging secrets / IAM

| Item | Purpose / status |
|------|------------------|
| `EVIDENCE_SCANNER_ENABLED=true` | **LIVE** on staging revision `…-2026-09-13-001` |
| `EVIDENCE_SCANNER_SECRET` | Secret Manager secret **created**; App Hosting YAML uses symbolic `secret:` reference only |
| `CLAMAV_HOST` / `CLAMAV_PORT` | Bound to `10.128.0.2:3310` |
| App Hosting runtime SA | Secret Accessor on this secret; Storage/Firestore for trust writes |
| Cloud Tasks queue / task SA | **NOT CREATED** (required before `EVIDENCE_SCANNER_DELIVERY=cloud_tasks`) |
| Eventarc (optional) | Object finalize → scan endpoint — **not configured** |

## Local verify

```bash
# Unit tests (mocked engine)
npm run test:vitest -- src/tests/malwareScanner.test.ts src/tests/evidenceTrust.test.ts

# Optional live ClamAV
EVIDENCE_SCANNER_ENABLED=true CLAMAV_HOST=127.0.0.1 EVIDENCE_SCANNER_SECRET=dev-secret-at-least-16 npm run dev
```
