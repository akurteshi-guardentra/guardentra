# Production cutover + rollback runbook — #72 mail delivery and #73 evidence scanner

Issues: #72 (production invitation/notification mail delivery), #73 (production
authoritative evidence malware scanner).

Repository SHA this runbook is grounded against: `ff9f9d2387e76e369ff3ce5ebd99d0bf1a0d4a09`.
Project id: `guardentra-prod`.

## 1. Purpose and scope

This is one consolidated operator runbook for the production cutover and rollback
of the self-managed mail worker (#72) and the authoritative evidence scanner (#73).
It exists so an operator can see both cutovers, both rollbacks, and every
owner-only gate in a single place.

It **consolidates and cross-references** the existing release documents and does
**not** replace any of them:

- `docs/release/GO_LIVE_E2E.md` — the final runtime release E2E gate (#124).
- `docs/release/EMAIL_CONSUMER_CUTOVER.md` — the single-consumer gate (#87).
- `docs/release/MAIL_WORKER_PACKAGE_191.md` — isolated `guardentra-mail` package prep (#191).
- `docs/release/PRODUCTION_SCANNER_PREFLIGHT.md` — the static manifest gate (#73).
- `docs/release/PRODUCTION_SCANNER_EVIDENCE_TEMPLATE.md` — the #73 inventory/acceptance evidence shapes.
- `docs/EVIDENCE_SCANNER.md` — scanner architecture, flow, and staging live state.
- `docs/SELF_MANAGED_EMAIL.md` — mail worker architecture and cutover design (#80).
- `docs/adr/0080-self-managed-mail.md` — the mail delivery architecture decision.

Where those documents and this one disagree about a fact, the cited authoritative
source file wins; this runbook is navigation and sequencing, not a new source of
truth.

### This document grants no authority

Per `AGENTS.md` section 2 and the "Owner command meanings" table, a commit, PR,
merge, runtime release, and verified deployment are separate states, and
**production deployment always requires a separate explicit owner instruction.**
Executing anything in this runbook — deploying, creating or granting secrets,
creating or changing IAM, provisioning infrastructure, incurring provider cost,
or enabling either feature — requires separate owner authorization. This document
does **not** itself authorize or perform any of it. Reading or preparing against
it is safe; acting on it is not authorized here.

`MERGED != STAGING_LIVE_VERIFIED != PRODUCTION_LIVE_VERIFIED`
(`docs/release/GO_LIVE_E2E.md:64`).

## 2. Local verification evidence (already green at ff9f9d2)

These checks need no production infrastructure. They were re-run on
`ff9f9d2387e76e369ff3ce5ebd99d0bf1a0d4a09` and record what IS proven without prod
infra. They prove code/config shape and logic only; they are **not** live proof.

| Check | Command | Result |
|---|---|---|
| Audit hash-chain / verify / canonicalize / event-identity | `npx vitest run src/tests/auditCanonicalize.test.ts src/tests/auditHashChainLocking.test.ts src/tests/auditVerificationTruth.test.ts src/tests/auditMaterialEventIdentity.unit.test.ts src/tests/emitValidation.test.ts` | 5 files, 19 tests PASS |
| Scanner engine + delivery | `npx vitest run src/tests/malwareScanner.test.ts src/tests/scannerDelivery.test.ts` | 2 files, 69 tests PASS |
| Mail queue / reconcile / worker / package | `npx vitest run src/tests/mailQueue.test.ts src/tests/mailReconcile.test.ts src/tests/mailWorker.test.ts src/tests/mailWorkerFunctions.test.ts src/tests/mailWorkerPackage.test.ts src/tests/mailWorkerPackage.real.test.ts` | 6 files, 94 tests PASS |
| Typecheck | `npm run lint` (`tsc --noEmit`) | PASS, 0 errors |
| Scanner manifest gate | `node scripts/release/scanner-prod-preflight.mjs apphosting.prod.yaml` | `{"state":"disabled","pass":true}` |

**Totals:** 13 test files / 182 tests PASS, typecheck clean, at SHA
`ff9f9d2387e76e369ff3ce5ebd99d0bf1a0d4a09`.

### Suites that CANNOT run here (require live infra)

These require a Firebase emulator, Postgres, a ClamAV daemon, Cloud Tasks, or live
Gmail/SendGrid, so they are **not** part of the green evidence above and remain
separate live-acceptance work:

- `*.postgres.test.ts` — require a live Postgres instance.
- `*.firestore.test.ts` — require the Firebase Firestore emulator
  (e.g. the mail-worker transaction suite via `npm run test:mail-worker-firestore`,
  per `docs/SELF_MANAGED_EMAIL.md:112`).
- Firestore and Storage security-rules suites — require the rules emulator.
- Live ClamAV scan paths (`clamd` INSTREAM), live Cloud Tasks enqueue/OIDC worker
  paths, and live SendGrid Mail Send paths — require provisioned cloud infra and
  are covered only by production acceptance evidence, not local tests.

## 3. #73 — Production scanner cutover

### 3.1 Precondition checklist (owner-only provisioning)

The static manifest gate `evaluateProductionScannerManifest`
(`scripts/release/scanner-prod-preflight.mjs:97`) plus the runtime config contract
(`server/lib/malwareScanner/types.ts`) define exactly what a production scanner
manifest must contain. VERIFIED-FROM-REPO, the full required set when the scanner
block is active:

| Requirement | Authoritative source | Notes |
|---|---|---|
| `EVIDENCE_SCANNER_ENABLED` true | `scanner-prod-preflight.mjs:117` | must be true when the block is active |
| `APP_ENV` = `prod`/`production` | `scanner-prod-preflight.mjs:121-124` | hosted environment |
| `EVIDENCE_SCANNER_SECRET` as Secret Manager `secret:` ref (never a literal) | `scanner-prod-preflight.mjs:130-133` | manifest `secret: EVIDENCE_SCANNER_SECRET`, no `value:` |
| `EVIDENCE_SCANNER_MODE` unset | `scanner-prod-preflight.mjs:126-128`; `types.ts:85-89` | test-only modes rejected in hosted env |
| `CLAMAV_HOST` set, `CLAMAV_PORT` 1..65535 | `scanner-prod-preflight.mjs:135-137`; `types.ts:91-98` | `<owner-supplied>` ClamAV host IP |
| `EVIDENCE_SCANNER_DELIVERY` = `cloud_tasks` | `scanner-prod-preflight.mjs:139-141` | durable path |
| `EVIDENCE_SCANNER_TASK_PROJECT` = `guardentra-prod` | `scanner-prod-preflight.mjs:154-156` | exact project |
| `EVIDENCE_SCANNER_TASK_LOCATION` set | `scanner-prod-preflight.mjs:143-152` | queue region |
| `EVIDENCE_SCANNER_TASK_QUEUE` set | `scanner-prod-preflight.mjs:143-152` | queue id |
| `EVIDENCE_SCANNER_TASK_TARGET_URL` set, safe https | `scanner-prod-preflight.mjs:158-161` | no creds/hash/localhost |
| `EVIDENCE_SCANNER_TASK_AUDIENCE` set, safe https | `scanner-prod-preflight.mjs:158-161` | |
| `TARGET_URL` == `AUDIENCE` exactly | `scanner-prod-preflight.mjs:162-164` | must match |
| `EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT` ends `@guardentra-prod.iam.gserviceaccount.com` | `scanner-prod-preflight.mjs:166-172` | OIDC task SA |
| VPC `PRIVATE_RANGES_ONLY` + a `networkInterfaces` network, when `CLAMAV_HOST` is RFC1918 private | `scanner-prod-preflight.mjs:174-181` | required only for private ClamAV |

The task body carries only `assessmentId`, `storagePath`, `generation`, optional
`organizationId`; it never carries the scanner secret or Firebase tokens
(`docs/EVIDENCE_SCANNER.md:52-54`). The OIDC worker route
`POST /api/internal/evidence-scan-task` accepts Google-signed OIDC only and does
**not** accept the shared secret (`docs/EVIDENCE_SCANNER.md:38-39`).

### 3.2 The current prod manifest is INSUFFICIENT — enabling is NOT config-only

VERIFIED-FROM-REPO: the scanner block in `apphosting.prod.yaml` is commented out
(`apphosting.prod.yaml:72-88`), so the gate returns `disabled` / `pass:true` —
safe and truthful. But even if that commented block were uncommented as-is, it
contains only `EVIDENCE_SCANNER_ENABLED`, `EVIDENCE_SCANNER_SECRET`, `CLAMAV_HOST`,
and `CLAMAV_PORT`. It is **missing the entire Cloud Tasks delivery set**
(`EVIDENCE_SCANNER_DELIVERY=cloud_tasks`, `_TASK_PROJECT`, `_TASK_LOCATION`,
`_TASK_QUEUE`, `_TASK_TARGET_URL`, `_TASK_AUDIENCE`, `_TASK_SERVICE_ACCOUNT`) and
any VPC access block. Uncommenting it would fail the gate with
`invalid_activation`. Enabling the production scanner is therefore **not a
config-only change**: it requires the full manifest above **and** owner-only
infrastructure that must pre-exist.

Owner-only infra that must pre-exist (none of this is proven by the repo):

- A production ClamAV VM/daemon reachable at `CLAMAV_HOST:CLAMAV_PORT`
  (default clamd port 3310).
- A production Cloud Tasks queue in `guardentra-prod` at the chosen location.
- A task OIDC service account `...@guardentra-prod.iam.gserviceaccount.com` for
  the worker route audience.
- A Secret Manager secret `EVIDENCE_SCANNER_SECRET` plus a
  `roles/secretmanager.secretAccessor` grant to the App Hosting runtime SA.
- VPC/Direct VPC access (`PRIVATE_RANGES_ONLY`) if ClamAV uses a private
  (RFC1918) address.

### 3.3 Cutover sequence (owner-authorized)

1. Re-read protected `main`, record the exact SHA
   (`docs/release/PRODUCTION_SCANNER_EVIDENCE_TEMPLATE.md:13`).
2. Add the complete manifest (section 3.1) to `apphosting.prod.yaml` in one change
   and run `node scripts/release/scanner-prod-preflight.mjs apphosting.prod.yaml`;
   require `state: config_ready`, `pass: true`, `live_proof: false`. `config_ready`
   means only that the manifest is structurally ready for a separately authorized
   rollout (`docs/release/PRODUCTION_SCANNER_PREFLIGHT.md:27`).
3. Capture the read-only production inventory
   (`guardentra.production_scanner_inventory.v1`) and a rollback baseline before any
   change (`docs/release/PRODUCTION_SCANNER_EVIDENCE_TEMPLATE.md:147-170`).
4. Deploy through the existing approved production path only.
5. Collect live acceptance proof using only synthetic owner-controlled fixtures,
   recorded as `guardentra.production_scanner_acceptance.v1`
   (`docs/release/PRODUCTION_SCANNER_EVIDENCE_TEMPLATE.md:176-228`):
   - clean fixture → `clean` (`clamav` / `clean`),
   - EICAR fixture → `quarantined` (`clamav` / `infected`, signature
     `Eicar-Test-Signature`),
   - timeout/unreachable/invalid-response → fail-closed `scan_failed`, never a
     false `clean`.

## 4. #73 — Rollback

Fail-closed is the safe state: `EVIDENCE_SCANNER_ENABLED=false` keeps the app
deployable with no scanner infra (`docs/EVIDENCE_SCANNER.md:69`), the unavailable
engine returns `error`/fail-closed (`server/lib/malwareScanner/engine.ts:138-149`),
and reviewer/org download without an authoritative clean record for the live
generation returns HTTP 403 (`server/lib/evidenceAccess.ts:748-775`).

Rollback sequence:

1. Set `EVIDENCE_SCANNER_ENABLED=false` (or restore the prior commented block) in
   the manifest.
2. Redeploy the prior manifest through the approved production path.
3. Verify `node scripts/release/scanner-prod-preflight.mjs apphosting.prod.yaml`
   returns `state: disabled`, `pass: true`.
4. Record the rollback baseline and readback in the evidence template
   (`docs/release/PRODUCTION_SCANNER_EVIDENCE_TEMPLATE.md:218-223`).

UX consequence the owner must weigh: with the scanner disabled, new portal uploads
stay `scan_pending` and reviewer/org downloads of not-yet-clean bytes are refused
with 403 (`server/lib/evidenceAccess.ts:748-775`). This is intentional
fail-closed behavior, not data loss, but it blocks evidence download until a
proven clean record exists.

## 5. #72 — Production mail cutover

### 5.1 Precondition checklist (owner-only provisioning)

VERIFIED-FROM-REPO from the worker entrypoint `server/mailWorkerFunctions.ts` and
the provider `server/lib/mailWorker/provider.ts`:

| Requirement | Authoritative source | Notes |
|---|---|---|
| `MAIL_WORKER_ENABLED` true | `server/mailWorkerFunctions.ts:11,38,45` | defaults false; handlers no-op when false |
| `MAIL_WORKER_CUTOVER_AT` an ISO UTC timestamp ending `Z` | `server/mailWorkerFunctions.ts:12,21-23` | config invalid otherwise (`MAIL_WORKER_CONFIG_INVALID`) |
| `MAIL_WORKER_DATABASE` set | `server/mailWorkerFunctions.ts:13,23` | same Firestore database as the API |
| `MAIL_WORKER_REGION` set | `server/mailWorkerFunctions.ts:14,52,56` | function region near the queue db |
| `MAIL_WORKER_SERVICE_ACCOUNT` set | `server/mailWorkerFunctions.ts:15,52,56` | dedicated function identity |
| `MAIL_PROVIDER_REGION` = `us` or `eu` | `server/mailWorkerFunctions.ts:16,23`; `provider.ts:19,23` | selects sendgrid.com vs api.eu.sendgrid.com |
| `MAIL_FROM` a verified sender address | `server/mailWorkerFunctions.ts:17`; `provider.ts:22` | `<owner-supplied>` verified sender |
| `SENDGRID_API_KEY` as a function secret | `server/mailWorkerFunctions.ts:18,52,57` | `<owner-supplied>` Secret Manager ref, Mail Send-only |

The provider uses a fixed HTTPS endpoint, `redirect: 'error'`, and a 15s timeout
(`server/lib/mailWorker/provider.ts:26-34`); HTTP 202 = accepted (not inbox
receipt).

### 5.2 Owner-only cutover steps

1. **Deploy the isolated `guardentra-mail` Cloud Functions codebase** (2nd gen):
   `deliverMail` (`mail/{mailId}` create trigger) and `recoverMail` (every-1-minute
   scheduler), both exported from `server/mailWorkerFunctions.ts:50-58` and
   packaged by `scripts/prepare-mail-worker-package.mjs`
   (`docs/release/MAIL_WORKER_PACKAGE_191.md`). The entrypoint is deliberately
   **not** wired into the root `firebase.json`
   (`server/mailWorkerFunctions.ts:1`).
2. **SendGrid account + verified sender** matching `MAIL_PROVIDER_REGION` data
   handling (`docs/SELF_MANAGED_EMAIL.md:91,99-100`).
3. **`SENDGRID_API_KEY` in Secret Manager** with a least-privilege (Mail Send-only)
   binding to the function SA; never in source, build config, `VITE_*`, Firestore,
   logs, or command args (`docs/SELF_MANAGED_EMAIL.md:93-101`).
4. **Deploy the `mail` composite index** declared in `firestore.indexes.json`
   (`delivery.owner` ASC + `delivery.dueAt` ASC, `firestore.indexes.json:44-51`)
   and verify it serves the recovery query before activation
   (`docs/release/MAIL_WORKER_PACKAGE_191.md:76-94`).
5. **Single-consumer gate (#87):** remove the managed Firebase Trigger Email
   extension so exactly one consumer owns the `mail` collection, enforced by the
   deterministic preflight `scripts/release/Test-EmailConsumerGate.ps1`
   (`docs/release/EMAIL_CONSUMER_CUTOVER.md`). Any dual-active, stale, or ambiguous
   state fails closed (`docs/release/EMAIL_CONSUMER_CUTOVER.md:17-19`). Take the
   cutoff `CUT` before uninstalling the extension and reuse it for both
   `MAIL_WORKER_CUTOVER_AT` and the reconcile `--cutover-at`
   (`docs/SELF_MANAGED_EMAIL.md:144-147`).
6. **Live staging proof before prod:** prove `QUEUED -> PROVIDER_ACCEPTED ->
   INBOX_RECEIVED` through the real invitation path
   (`docs/release/GO_LIVE_E2E.md:28`), then promote only with recorded staging
   evidence and a separate production command.

## 6. #72 — Rollback

Per `docs/release/EMAIL_CONSUMER_CUTOVER.md:54-55` and
`docs/SELF_MANAGED_EMAIL.md:205-218`:

1. Rollback must restore **exactly one** previously proven consumer; never run the
   managed extension and the self-managed worker active at the same time on `mail`.
2. Disable `MAIL_WORKER_ENABLED` (handlers then no-op,
   `server/mailWorkerFunctions.ts:38,45`), stop both triggers, wait for in-flight
   provider calls, and reconcile uncertain outcomes against provider activity.
   Preserve terminal results and attempt records; do not clear `delivery` or blindly
   resubmit `SUCCESS`/`OUTCOME_UNKNOWN`.
3. Rerun `scripts/release/Test-EmailConsumerGate.ps1` to prove exactly one consumer
   before live traffic resumes.

## 7. Owner-only decision gates (consolidated)

Every item below requires explicit owner approval per `AGENTS.md` ("Owner command
meanings" and section 4); none is authorized by this document.

1. Authorize production deploy of the mail worker (#72). **Requires explicit owner approval.**
2. Authorize production deploy of the evidence scanner (#73). **Requires explicit owner approval.**
3. Provision the production ClamAV VM/daemon. **Requires explicit owner approval.**
4. Provision the production Cloud Tasks queue + OIDC task service account. **Requires explicit owner approval.**
5. Create and grant Secret Manager secret `EVIDENCE_SCANNER_SECRET` (+ accessor grant). **Requires explicit owner approval.**
6. Create and grant Secret Manager secret `SENDGRID_API_KEY` (+ least-priv binding). **Requires explicit owner approval.**
7. Any VPC / IAM change (Direct VPC access, role bindings). **Requires explicit owner approval.**
8. Provision/approve the paid SendGrid account and verified sender. **Requires explicit owner approval.**
9. Remove the managed Firebase Trigger Email extension (single-consumer cutover). **Requires explicit owner approval.**

## 8. Unverified live-state items

This runbook is grounded only in the repository at
`ff9f9d2387e76e369ff3ce5ebd99d0bf1a0d4a09`. It CANNOT confirm, from the repo,
whether any of the following live resources actually exist, are RUNNING, or are
correctly configured in `guardentra-prod`:

- Whether a production ClamAV VM/daemon exists and is reachable.
- Whether a production Cloud Tasks queue exists and is RUNNING.
- Whether the task OIDC service account exists and has correct IAM.
- Whether `EVIDENCE_SCANNER_SECRET` / `SENDGRID_API_KEY` secret versions exist and
  are accessible.
- Whether the `mail` Firestore composite index is deployed and serving.
- The current state of the managed Firebase Trigger Email extension (installed,
  ERRORED, or absent).
- The current live App Hosting build/revision/source SHA and runtime service
  account.

Access denial when observing any of these is `BLOCKED`, not proof of absence
(`docs/release/PRODUCTION_SCANNER_EVIDENCE_TEMPLATE.md:159`). Observe live state
only through the read-only evidence workflows, which hold `contents: read` and
never print secret payloads:

- `.github/workflows/prod-scanner-readonly-evidence.yml` — production scanner
  read-only evidence (`TARGET_PROJECT: guardentra-prod`).
- `.github/workflows/staging-email-evidence.yml` — staging email read-only
  evidence (`TARGET_PROJECT: guardentra-staging`).

A green read-only inventory is prerequisite evidence only; `live_proof` remains
`false` until a separately owner-authorized production acceptance record passes
(`docs/release/PRODUCTION_SCANNER_EVIDENCE_TEMPLATE.md:14-21`).
