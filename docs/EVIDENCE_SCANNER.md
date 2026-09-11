# Authoritative evidence malware scanner (P0)

## Flow

```text
portal upload (Storage portal/{assessmentId}/{file})
  → POST /api/portal/evidence-validate
      → metadata classify → scan_pending | quarantined | scan_failed
      → Admin write assessments/{id}.evidenceTrustByStoragePath
      → if scan_pending: enqueue scanner (when EVIDENCE_SCANNER_ENABLED)
  → scanner (ClamAV)
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
| `server/lib/malwareScanner/` | ClamAV engine + scan/write |
| `server/routes/scanner.ts` | `POST /api/internal/evidence-scan` |
| `server/lib/evidenceAccess.ts` | Validate → enqueue |

## Trigger mechanisms

1. **Post-validate enqueue** (in-process `setImmediate`) after `scan_pending`.
2. **HTTP** `POST /api/internal/evidence-scan` with `Authorization: Bearer $EVIDENCE_SCANNER_SECRET`  
   (or `x-evidence-scanner-secret`). Accepts direct JSON or GCS Pub/Sub push envelopes.

Recommended staging/prod: Eventarc **google.cloud.storage.object.v1.finalized** on the
project bucket → authenticated push (or OIDC proxy that adds the shared secret) to the
App Hosting `/api/internal/evidence-scan` URL.

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

Operator-verified infrastructure evidence from Action #4 on **2026-09-11**.
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
| Clean-file scan | PASS (Infected files: 0) |
| Direct VPC egress (repo) | `PRIVATE_RANGES_ONLY` on `default`/`default` in `apphosting.staging.yaml` |
| `CLAMAV_HOST` / `CLAMAV_PORT` (repo) | `10.128.0.2` / `3310` (RUNTIME; endpoint bind only) |

### Explicitly still offline

| Control | Status |
|---------|--------|
| `EVIDENCE_SCANNER_ENABLED` | **NOT ENABLED** (remains commented in `apphosting.staging.yaml`) |
| `EVIDENCE_SCANNER_SECRET` | **NOT CREATED** |
| Eventarc | **NOT CONFIGURED** |
| App Hosting deployment from this action | **NO** |
| Production | **UNCHANGED** |

### Production

**Out of scope.** Do not add Direct VPC, ClamAV, scanner secrets, or scanner
enablement to `apphosting.prod.yaml` / `apphosting.production.yaml` until a
separate owner-authorized production workstream.

## Staging secrets / IAM (not applied by this action)

| Item | Purpose |
|------|---------|
| `EVIDENCE_SCANNER_ENABLED=true` | Turn on enqueue + scan (**not set**) |
| `EVIDENCE_SCANNER_SECRET` | Shared secret for `/api/internal/evidence-scan` (≥16 chars) (**not created**) |
| `CLAMAV_HOST` / `CLAMAV_PORT` | Bound in staging YAML to `10.128.0.2:3310` (does not enable scanning) |
| App Hosting runtime SA | Storage objectViewer/get + Firestore write on assessments |
| Eventarc (optional) | Object finalize → scan endpoint (**not configured**) |

## Local verify

```bash
# Unit tests (mocked engine)
npm run test:vitest -- src/tests/malwareScanner.test.ts src/tests/evidenceTrust.test.ts

# Optional live ClamAV
EVIDENCE_SCANNER_ENABLED=true CLAMAV_HOST=127.0.0.1 EVIDENCE_SCANNER_SECRET=dev-secret-at-least-16 npm run dev
```
