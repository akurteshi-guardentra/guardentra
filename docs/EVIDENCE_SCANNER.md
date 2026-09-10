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

## Staging secrets / IAM (not applied by this PR)

| Item | Purpose |
|------|---------|
| `EVIDENCE_SCANNER_ENABLED=true` | Turn on enqueue + scan |
| `EVIDENCE_SCANNER_SECRET` | Shared secret for `/api/internal/evidence-scan` (≥16 chars) |
| `CLAMAV_HOST` / `CLAMAV_PORT` | Reachable ClamAV daemon |
| App Hosting runtime SA | Storage objectViewer/get + Firestore write on assessments |
| Eventarc (optional) | Object finalize → scan endpoint |

Deploy ClamAV as a sidecar/Cloud Run service on the same VPC or private IP as App Hosting.

## Local verify

```bash
# Unit tests (mocked engine)
npm run test:vitest -- src/tests/malwareScanner.test.ts src/tests/evidenceTrust.test.ts

# Optional live ClamAV
EVIDENCE_SCANNER_ENABLED=true CLAMAV_HOST=127.0.0.1 EVIDENCE_SCANNER_SECRET=dev-secret-at-least-16 npm run dev
```
