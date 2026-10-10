# Self-managed email migration — Issue #80

Repository preparation reconciled onto the release candidate (2026-10-10). No runtime configuration, provider credentials,
APIs, IAM, deployment, or real email were changed by this work.
The owner must authorize staging configuration/deployment and production separately.

## Architecture trace and current boundaries

1. The application submits a tenant-bound notification intent to `/api/notify/mail`.
   Callers cannot supply recipient, subject, text, or HTML.
2. `server/lib/notificationIntent.ts` resolves the authorized tenant, object,
   recipient, content, and deterministic queue ID from server-authoritative state.
3. `server/routes/notify.ts` preserves the existing authorization, rate limit,
   deterministic deduplication, and assessment invitation transaction. Queue creation,
   assessment/vendor updates, and durable material audit intent remain atomic for
   assessment invitations.
4. `buildMailQueueDocument` preserves the `to[]` + `message` queue contract.
   `notification` metadata stays on the stored queue document; it is not sent to
   the provider or logged by this worker.
5. `firestore.rules` denies all client reads and writes to `mail`. Queue acceptance
   proves persistence, not provider acceptance or inbox receipt.
6. `server/mailWorkerFunctions.ts` prepares a separate 2nd-gen create trigger and
   scheduled recovery function. It is deliberately not wired into `firebase.json`.
   `MAIL_WORKER_ENABLED` defaults to false.
7. The worker sends only the stored recipient and message. It does not resolve
   recipients from other tenant documents, accept caller-selected sender settings,
   or emit queue bodies or invitation URLs into logs.

This integration preserves the newer candidate notification route; the older
generic mail endpoint and its route tests were not imported. Provider credentials,
exclusive-consumer cutover, IAM, deployment packaging, and live delivery acceptance
remain separate runtime gates.

## Durable delivery model

Queue creation retains `to`, `message`, `createdAt`, and `source`, plus existing
server-owned notification metadata. It does not initialize `delivery`, preserving
#72 compatibility. The new worker owns
`delivery` only after an exclusive cutover:

| Field | Meaning |
|---|---|
| `owner` | `guardentra.mail.v1`; extension records without this marker are skipped |
| `state` | PROCESSING, RETRY, SUCCESS, ERROR |
| `attempts`, `attemptId` | Bounded send count and random transaction fencing token |
| `startedAt`, `updatedAt` | Epoch milliseconds, worker timestamps |
| `dueAt` | Epoch milliseconds for retry/lease recovery; null on terminal state |
| `code` | Allowlisted status code, never raw response/exception |

Creation events re-read the current document transactionally. Duplicate events and
concurrent workers cannot both claim the same attempt. No network call occurs in
the transaction callback. Only the winning attempt can write its result.
Firestore create time (not the queue's string timestamp) enforces cutover ownership.

| Result | State / code | Recovery |
|---|---|---|
| HTTP 202 | SUCCESS / ACCEPTED | No resend; acceptance is not inbox receipt |
| HTTP 429 | RETRY / RATE_LIMITED | 60s exponential delay, honor longer Retry-After |
| Fifth confirmed temporary rejection | ERROR / RETRY_EXHAUSTED | Operator review |
| Definite 4xx except 408/429 | ERROR / PROVIDER_REJECTED | Correct config/input, reconcile, then authorized new submission |
| Timeout, transport failure, 408, 5xx, unexpected response | ERROR / OUTCOME_UNKNOWN | Reconcile provider activity; no automatic resend |
| Expired 120s PROCESSING lease | ERROR / OUTCOME_UNKNOWN | Same; includes crash before/after acceptance |
| Invalid queue source/recipient/message | ERROR / INVALID_QUEUE | No provider call |

The scheduled function processes at most 20 due documents per minute using a
worker-owner equality and `delivery.dueAt` range query. The composite index is
recorded in `firestore.indexes.json`; deploy and verify it before activation. Ownership
is filtered before the batch limit so foreign overdue records cannot starve retries. It recovers
durable retries after process restarts and marks expired attempts uncertain.
The create trigger uses platform event retry for infrastructure failures. Functions
sanitize thrown SDK errors to `MAIL_WORKER_FAILED`. An unavailable database can
leave PROCESSING until lease recovery; it cannot produce false SUCCESS.

The provider request has a 15-second timeout, fixed HTTPS endpoint and redirects
disabled. Adapter replacements must bound execution below the 120-second lease and
classify **only confirmed non-acceptance** as temporary. No idempotency guarantee is
invented: SendGrid custom IDs/headers are not deduplication. Distinct queue documents
are distinct sends; the notification API preserves its existing deterministic queue
ID deduplication. Uncertain mail may be unsent and
needs prompt operator action; this design prioritizes avoiding duplicate invitations.

## Runtime configuration required later — names only

| Name | Requirement |
|---|---|
| `MAIL_WORKER_ENABLED` | Default false. Enable only after exclusive-consumer cutover |
| `MAIL_WORKER_CUTOVER_AT` | Explicit UTC ISO timestamp ending Z; keep stable on redeploy |
| `MAIL_WORKER_DATABASE` | Same Firestore database as the API, including `(default)` if applicable |
| `MAIL_WORKER_REGION` | Owner-approved function region near the queue database |
| `MAIL_WORKER_SERVICE_ACCOUNT` | Dedicated function identity for both functions |
| `MAIL_PROVIDER_REGION` | Explicit `us` or `eu`; match approved SendGrid account/data handling |
| `MAIL_FROM` | Owner-approved, verified sender address |
| `SENDGRID_API_KEY` | Secret Manager/function secret reference; Mail Send-only permission |

Do not put secret values in source, App Hosting client/build configuration, VITE_*
variables, Firestore, logs, test output, or command arguments. Both functions bind
the secret explicitly. Use workload identity/ADC, never downloaded account keys.
Function identity needs queue read/update/query access and access only to the named
secret. Firestore Admin bypasses client rules; database/project IAM may be broader
than a collection, so do not describe rules as a service-account boundary. Review
the narrowest viable IAM permissions and residual database scope before release.
Scheduler/Eventarc invocation and deployment identities remain distinct from the
application and provider identities. No IAM binding is created by this repository work.

`npm run build:mail-worker` produces `dist/mail-worker/index.cjs` locally.
This is prepared source/bundle, **not a configured deployment**: a future authorized
release must package it with Node 22, `firebase-admin` and `firebase-functions`
versions from this repository lockfile, create its own codebase/package manifest,
and explicitly wire that codebase to the correct project. `firebase.json`,
App Hosting, CI deployment paths, and production secrets are unchanged. CI now
checks both builds and explicitly executes `npm run test:mail-worker-firestore`
inside the local Firestore emulator, so the transaction suite is not silently skipped.
The emulator does not prove that the production composite index is deployed.

## Cutover — separately authorized operation

1. Verify actual #72 consumer installation/version, queue database, region, sender,
   provider account and current backlog. Never rely on stale docs for live state.
   Prove the old path's receipt/failure behavior first if it will serve pilot traffic.
2. Review function package, IAM/data region, secret references, capacity/cost,
   due-time index availability, alerts and retention; authorize staging explicitly.
3. Pause invitation/email ingress operationally; drain legacy sends. Reconcile all
   PROCESSING/ERROR/no-status records and capture safe counts. Do not copy queue
   payloads or secrets into issue evidence.
4. Disable/uninstall the extension under owner authorization and verify its event
   consumers can no longer invoke. Wait for active executions/provider calls to
   end. Merely deploying this worker disabled does not stop the extension.
5. Record cutoff after the old consumer is stopped, deploy the separate functions,
   set the matching database and explicit parameters/secret reference, then enable.
   There must never be two active consumers on `mail`. The extension does not honor
   our owner field and may react to updates; ownership markers alone do not isolate it.
6. Resume ingress and execute the staging acceptance drill below. Historical docs
   and any extension-owned docs remain untouched. Reconcile paused/disabled-period
   documents explicitly; skipped create events are not replayed automatically when
   enablement changes. An authorized admin tool can call `process(id)` for never-sent
   post-cutoff docs without delivery metadata. Pre-cutoff backlog needs explicit
   reviewed resubmission, not a widened cutoff or mass status reset.
7. Promote only with recorded staging evidence and a separate production command.

## Observability and staging acceptance gate

Create log-based alerts for ERROR codes, RETRY_EXHAUSTED, OUTCOME_UNKNOWN,
MAIL_WORKER_FAILED, sustained retries, stale PROCESSING, oldest queue age, and
backlog growth. Logs contain event/state/code/attempt count only. Operators correlate
using authorized queue inspection; provider responses and addresses are never logged.
Monitor event-trigger delivery failures and never-claimed queue records as well as
scheduled recovery health. Capacity is bounded; review quota/backlog before scaling.

Required live proof (NOT RUN in this task): synthetic owner-controlled invitation
through the real UI/API -> durable queue -> SUCCESS -> confirmed inbox receipt;
controlled definite failure; rate-limit/retry -> success; duplicate event; worker
restart/expired lease; secret redaction; unauthenticated API denial; authenticated
and unauthenticated direct-client queue denial; no production mutation. Use a
separate controlled test provider/adapter for injected failures, never rotate real
credentials merely to induce failure. Acceptance and bounces need provider activity
or an independently designed webhook; SUCCESS alone does not prove receipt.

## Rollback and recovery

Before activation, rollback is to leave the worker disabled/unwired and discard or
revert this local change under normal owner controls. No runtime rollback is needed.

After an authorized cutover: pause ingress and stop both worker triggers; wait for
in-flight calls and reconcile uncertain outcomes using provider activity. Preserve
terminal results and attempt records. Prefer the last verified self-managed revision
with the same state contract. Do not clear delivery metadata or resubmit SUCCESS or
OUTCOME_UNKNOWN blindly. If a confirmed never-accepted message needs another send,
record the operator decision and create one new reviewed queue record.

Restoring #72 is only possible while its installation/management path is supported
and separately authorized. Before restarting it, isolate **all** self-managed mail
records from its watched collection (owner-reviewed archival plan, preserving audit
and privacy/retention), reconcile legacy backlog, and verify no active self-managed
consumer. Never restore the extension over a mixed backlog or reinterpret our RETRY
fields as extension retry instructions. After the managed service cutoff, use the
previous self-managed revision; do not rely on reinstallation as disaster recovery.

Firebase documents managed extension operations ending **2027-03-31**, while already
installed workloads may continue running. Sources checked 2026-09-27:
[deprecation FAQ](https://firebase.google.com/docs/extensions/faq-and-troubleshooting),
[Firestore event delivery](https://firebase.google.com/docs/functions/firestore-events),
[scheduled functions](https://firebase.google.com/docs/functions/schedule-functions),
[SendGrid Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send).
