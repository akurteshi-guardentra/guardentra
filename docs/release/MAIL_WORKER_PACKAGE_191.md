# Mail worker package preparation (#191)

Source-preparation only for an isolated Firebase Functions codebase named
`guardentra-mail`. This document does **not** authorize email activation, paid
provider setup, Secret Manager / IAM changes, index deployment, live queue
writes, or any Cloud deployment.

Baseline: `release/rc-2026-10-08@c7e5a04b2d20b8c04ed5afb5ba0fc811c2e63e05`.

## What this prepares

| Artifact | Role |
|---|---|
| `scripts/prepare-mail-worker-package.mjs` | Builds and stages the isolated package from one explicit Git SHA |
| Staged `guardentra-mail` directory | Upload context: `index.cjs`, `package.json`, `package-lock.json`, staging descriptor, package-local `firebase.json` |
| Receipt JSON (outside upload context) | Source SHA, dependency provenance, artifact paths and hashes |

The package reuses the existing worker implementation:

- `server/mailWorkerFunctions.ts` (exports `deliverMail` and `recoverMail`)
- `server/lib/mailWorker/*`

It does **not** add a second consumer, overlay obsolete #80 worktrees, or wire
functions into the repository root `firebase.json`.

## How to prepare

From a clean checkout of the reviewed SHA:

```bash
npm run build:mail-worker
node scripts/prepare-mail-worker-package.mjs \
  --source-sha <40-char-sha> \
  --target staging \
  --project-id guardentra-staging \
  --out-dir /path/to/upload/guardentra-mail \
  --receipt /path/to/receipts/mail-worker-package.receipt.json
```

Optional runtime inputs may be passed (`--database`, `--region`,
`--service-account`, `--mail-from`, `--provider-region`, `--cutover-at`,
`--secret-name`). Omitted values are recorded as **unresolved inputs** in the
staging descriptor and receipt — they are never invented.

### Guarantees of the prepare script

1. Refuses missing `--target` / `--project-id` and any target other than
   `staging` / project other than `guardentra-staging`.
2. Requires the workspace `HEAD` to match `--source-sha`.
3. Builds via `npm run build:mail-worker` → `dist/mail-worker/index.cjs`.
4. Reads the bundle’s external `require(...)` imports and pins dependency
   versions from the **same commit’s** root `package-lock.json` (Node 22).
5. Stages only the worker bundle (as `index.cjs` exporting `deliverMail` and
   `recoverMail`), isolated `package.json` / `package-lock.json`, and a
   staging-only deployment descriptor. Excludes `.env`, tokens, keys,
   Terraform, Git metadata, `node_modules`, and unrelated app source.
6. Runs a clean-install + load smoke against a temporary copy (not left in the
   upload context).
7. Writes the receipt **outside** `--out-dir`.
8. Keeps `MAIL_WORKER_ENABLED=false` in the descriptor. Packaging does not
   invoke handlers or provider APIs.

## Composite index (record only — do not deploy from this task)

Recovery queries equality on `delivery.owner` with a range on `delivery.dueAt`.
That composite index is already declared in repository `firestore.indexes.json`:

```json
{
  "collectionGroup": "mail",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "delivery.owner", "order": "ASCENDING" },
    { "fieldPath": "delivery.dueAt", "order": "ASCENDING" }
  ]
}
```

Package preparation records this requirement. It is **not** proof that the live
Firestore index, function, scheduler, or Eventarc trigger exists. Index deploy
remains a separate authorized operation.

## Unresolved activation inputs (parallel track)

Resolve these before any cutover — not before writing a package:

- Provider account readiness and approved US/EU data handling
- Owner-approved verified sender (`MAIL_FROM`)
- Private `SENDGRID_API_KEY` Secret Manager binding (never VITE / chat / source)
- Same Firestore database as the API (`MAIL_WORKER_DATABASE`)
- Function region (`MAIL_WORKER_REGION`) and least-privilege service account
- `MAIL_PROVIDER_REGION` (`us` \| `eu`) and `MAIL_WORKER_CUTOVER_AT` (UTC `…Z`)
- Live index state for `delivery.owner` + `delivery.dueAt`
- Competing-consumer / in-flight inventory (exactly one consumer)
- Cutoff / backlog reconciliation, cost ceiling, sanitized observability, reversible stop

`MAIL_WORKER_ENABLED` must remain `false` until a separate exclusive-consumer
cutover is authorized.

## Tests

- `src/tests/mailWorkerPackage.test.ts` — package/entrypoint, refusal, disabled
  handler / no provider call, clean-install/load smoke (no real providers/GCP)
- Existing `src/tests/mailWorker*.test.ts` — ownership, duplicates, retries,
  unknown outcomes (reuse; not replaced by packaging tests)

## Out of scope for this artifact

- Deploying the package or enabling the worker
- Root `firebase.json` / App Hosting / CI deploy hooks
- SQL, Terraform, IAM, secrets, or index application
- Auth verification email (#196)
- Claiming inbox delivery acceptance
