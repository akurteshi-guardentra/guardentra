# Environment-gap fixes (prepared 2026-10-31, NOT applied)

Source: `reports/env-consistency-2026-10-31.md` (read-only audit, owner-PC readback 2026-10-31T15:41Z).

**Status: PREPARED, NOTHING RUN.** Each step below needs its own explicit owner go. Merging this PR does not run anything and does not change prod: prod tracks `main` with rollout disabled, and the yaml change only takes effect when the RC is promoted to prod. Never deploy the RC Firestore rules to prod; nothing here touches rules.

Every script checks live state first and stops if it is not what was verified, asks you to type the project name before changing anything, reads the result back, writes `out\*.json`, and has an undo.

| Gap | Fix | Changes | Undo |
|---|---|---|---|
| I1 prod has 0 of the 4 indexes 29171a6 defines | `01-create-indexes.ps1 -Project guardentra-prod -Set running` | Creates only the missing composite indexes on `(default)` | `02-rollback-indexes.ps1` with the `out\indexes-created-…json` it wrote |
| I1 legacy has 0 of the 4 indexes 7b914ee defines | `01-create-indexes.ps1 -Project guardentra-7f582 -Set running` | Same | Same |
| RC needs 8 indexes on prod | `01-create-indexes.ps1 -Project guardentra-prod -Set rc` **at promotion** | Adds the 4 RC-only ones (mail, remediations x2, evidence_reviews). If `running` already ran, only these 4 are created | Same |
| E1 prod yaml lacks `PUBLIC_APP_URL` | `apphosting.prod.yaml` + `apphosting.production.yaml` (repo, this PR) | `PUBLIC_APP_URL=https://guardentra.com`, RUNTIME. Applies only when a build of this config rolls out on guardentra-prod | Revert the two lines |
| A1 staging anonymous sign-in ON | `03-staging-anonymous-signin.ps1` | Auth `signIn.anonymous.enabled=false` on guardentra-staging only | `03-staging-anonymous-signin.ps1 -Rollback` |
| R1 CLI default = legacy | `.firebaserc` (repo, this PR) | Removes `"default": "guardentra-7f582"`. Plus the per-machine check below | Re-add the line |
| I2 delete protection / PITR off | Commands below (no script) | Per-database setting | `--no-delete-protection` / `--no-enable-pitr` |

## 1. Indexes (I1)

- `indexes.running-29171a6-7b914ee.json` is byte-identical to `firestore.indexes.json` at both live builds, prod 29171a6 and legacy 7b914ee: `policies` and `incidents` (organizationId+status), `contract_audits` (organizationId+createdAt desc), `vendor_assessments` (vendorId+createdAt desc). Today the queries that need these fail with FAILED_PRECONDITION.
- `indexes.rc-caf2709.json` is the RC's `firestore.indexes.json` at caf2709 (8 indexes, the same 8 that are READY on staging). `-Set rc` is refused for legacy.
- The script uses the Firestore Admin API directly instead of `firebase deploy --only firestore:indexes`, so it can't pick up the CLI default project and can never delete an index that isn't in the file.
- Creating an index doesn't touch documents. It builds in the background, minutes on small collections, and costs only index storage. Run the same command again later: it reads back and reports READY.
- Suggested order: legacy `running`, then prod `running`. Prod `rc` waits for the promotion packet.

## 2. PUBLIC_APP_URL (E1)

- On the RC, `server/routes/notify.ts` builds invitation and reminder links from it, and refuses to guess in production when it is unset. `server/middleware/edgeSecurity.ts` uses it for the `/api` CORS allowlist and the security.txt `Canonical:` line. `server/routes/stripe.ts` refuses to build checkout redirects without it.
- Value: `https://guardentra.com`, which is what prod serves today (www 301s to it). **The owner confirms the canonical origin before promotion.**
- Same-origin requests from the hosted.app URL don't need CORS. If prod is ever used cross-origin from another origin, add it to `CORS_ALLOWED_ORIGINS`; that's not needed today.
- Prod 29171a6 doesn't read this variable, so the value only matters once the RC is promoted.

## 3. Staging anonymous sign-in (A1)

The vendor portal was checked first. The RC never calls `signInAnonymously()`: `src/pages/VendorPortal.tsx` gets a custom token from `POST /api/portal/session` (`server/routes/portal.ts`) and calls `signInWithCustomToken`. Custom-token sign-in doesn't depend on the anonymous provider. The only remaining mentions of "anonymous" in `firestore.rules` and `storage.rules` are comments.

The script also checks this live before it changes anything:
- `/api/health` must report `release.environment=staging`, project `guardentra-staging` and a `sourceSha` (RC builds only).
- A made-up assessment id on `/api/portal/session` must return the portal's own 404.

Afterwards, open one real staging vendor portal link to confirm it still loads. Existing anonymous accounts are not deleted.

## 4. Delete protection, PITR and the CLI default (I2, R1)

**Delete protection** blocks deleting the whole database (not documents). It's free, and it's the cheapest guard against a mistaken `gcloud firestore databases delete`. Recommended on all three projects, prod and legacy first.

```powershell
# Read (safe):
gcloud firestore databases list --project=guardentra-prod --format="table(name,locationId,deleteProtectionState,pointInTimeRecoveryEnablement)"
# Turn on (needs the owner's go, one project at a time):
gcloud firestore databases update --database="(default)" --delete-protection --project=guardentra-prod
# Undo:
gcloud firestore databases update --database="(default)" --no-delete-protection --project=guardentra-prod
```

- Repeat with `guardentra-7f582` and `guardentra-staging`.
- Legacy also has the ai-studio named database (us-west1, deny-all rules). Take its exact id from the `list` output and pass it as `--database=<id>`.
- **PITR** keeps 7 days of document versions and lets you read or restore any minute in that window. It costs storage for the retained versions. Turn on with `--enable-pitr`, undo with `--no-enable-pitr`, same command shape. It's the closest thing to an "undo" for a bad write or a bad rules change. Recommended for prod and legacy.
- **Scheduled backups** are an alternative or addition: `gcloud firestore backups schedules create --database="(default)" --recurrence=daily --retention=7d --project=<p>`. For legacy, PR #235 step 1 is the one-off backup.

**CLI default project (R1).** This PR removes `"default": "guardentra-7f582"` from `.firebaserc`. A bare `firebase deploy` now fails with "No currently active project" instead of hitting legacy. The `demo` alias still names legacy explicitly. Two things outside the repo can still set a target, so check once on the PC:

```powershell
cd C:\Users\Admin\repos\guardentra   # your checkout
npx firebase use                     # shows the active project for this folder, if any
npx firebase use --clear             # clears a sticky selection made earlier with "firebase use <alias>"
```

- `firebase use <alias>` is stored per machine and per folder, outside the repo, and overrides `.firebaserc`.
- Keep passing `--project=<id>` on every deploy, as the scripts here and in #235 do.
- `src/tests/firebaseDeployGuidance.test.ts` now asserts that there is no default.

## File hashes (SHA-256, LF line endings)

See the PR description for the current list. To check on Windows: `Get-FileHash .\<file> -Algorithm SHA256`. A CRLF checkout of a text file gives a different hash. `01-create-indexes.ps1` normalises line endings before checking its JSON input.
