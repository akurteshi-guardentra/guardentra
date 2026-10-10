# GuardEntra Completion Evidence

## Classification

- Status: `CHECKPOINT`
- Claim being verified: repository-side #80 self-managed mail worker preparation and local tests, stopped before commit as instructed. This is not live email delivery or closure of Issue #80.

## Mandatory evidence

1. **Branch name:** `feat/self-managed-email-worker-80`
2. **Commit SHA:** `NOT COMMITTED`; current HEAD/base is `a355ea70271c511d2985ba068dd2c40fbeb86dff`.
3. **GitHub PR:** `NO PR — NOT DELIVERED TO GITHUB`
4. **Exact changed files:** repository-relative list from `git diff --name-only` plus `git ls-files --others --exclude-standard` (18 files):

   ```text
   docs/SELF_MANAGED_EMAIL.md
   docs/STAGING_EMAIL_DELIVERY.md
   docs/adr/0080-self-managed-mail.md
   docs/agent-ops/ISSUE_80_COMPLETION_EVIDENCE.md
   docs/agent-ops/ISSUE_80_TASK_PACKET.md
   package-lock.json
   package.json
   server/lib/mailQueue.ts
   server/lib/mailWorker/firestoreStore.ts
   server/lib/mailWorker/provider.ts
   server/lib/mailWorker/worker.ts
   server/mailWorkerFunctions.ts
   server/routes/notify.ts
   src/tests/firestore.rules.test.mjs
   src/tests/mailWorker.firestore.test.ts
   src/tests/mailWorker.test.ts
   src/tests/mailWorkerFunctions.test.ts
   src/tests/notifyRoute.test.ts
   ```

5. **Test results:** local Windows/Node v22.23.2, Java 21, on 2026-09-27:

   | Exact command/check | Result |
   |---|---|
   | `npm ci --ignore-scripts --no-audit --no-fund` | PASS, lockfile dependencies installed; no real provider used |
   | `npm run lint` | PASS on final source/tests |
   | `npm run test:vitest -- src/tests/mailWorker.test.ts src/tests/mailQueue.test.ts src/tests/notifyRoute.test.ts src/tests/notifications.test.ts` | PASS: 54 tests / 4 files |
   | `npm run test:vitest` | PASS: 401 tests / 48 files; 2 emulator-only tests skipped outside emulator. Run preceded addition of the five entrypoint tests below; functional source unchanged afterward (comments only) |
   | `npm run test:vitest -- src/tests/mailWorkerFunctions.test.ts` | PASS: 5 tests / 1 file, subsequently added to verify disabled/config/redaction boundaries |
   | `npm run test:firestore-rules` | PASS: 76 checks, including 16 new mail deny-all checks (admin/member/portal/unauthenticated, create/read/update/delete) |
   | `npx firebase emulators:exec --only firestore --project demo-guardentra-firestore-rules "npx vitest run src/tests/mailWorker.firestore.test.ts"` | PASS: 2 real Firestore transaction/recovery tests |
   | `npm test` | PASS: 1 HTTP server smoke test on isolated rerun |
   | `npm run build` | PASS: client and server bundles; existing chunk-size advisory remains |
   | `npm run build:mail-worker` | PASS: standalone function bundle, rerun after app build to preserve both outputs |
   | `git diff --check` | PASS |
   | `git -c core.autocrlf=false diff --no-index --check -- NUL <each untracked file>` | PASS: no whitespace diagnostics; exit 1 is the normal new-file diff, not a whitespace failure |
   | `git diff --exit-code -- scripts/guardentra docs/agent-ops/orchestration firestore.rules firebase.json apphosting.yaml apphosting.staging.yaml .firebaserc .env.example` | PASS: unchanged |
   | `git diff --cached --exit-code` | PASS: nothing staged |
   | Exact changed-file allowlist comparison against Git | PASS: the 18 paths listed above only |
   | Required remote CI and staging provider receipt/failure/retry E2E | BLOCKED/NOT RUN: no push/PR/runtime configuration/deployment authorized |

   Initial typecheck/rules attempt failed on a duplicate test variable name;
   renamed the new test fixture and both checks passed. Initial HTTP smoke attempt
   failed with ECONNREFUSED during concurrent checks; rerun alone after emulator
   shutdown passed. No unrelated product change was made for either failure.
   Shell project-override presence was inspected (none). Inherited DEBUG was
   removed from later local Firebase CLI/test processes to prevent verbose output;
   no live environment configuration was changed.

6. **Remaining uncommitted files:** exact `git status --short` (all task changes unstaged):

   ```text
    M docs/STAGING_EMAIL_DELIVERY.md
    M package-lock.json
    M package.json
    M server/lib/mailQueue.ts
    M server/routes/notify.ts
    M src/tests/firestore.rules.test.mjs
   ?? docs/SELF_MANAGED_EMAIL.md
   ?? docs/adr/
   ?? docs/agent-ops/ISSUE_80_COMPLETION_EVIDENCE.md
   ?? docs/agent-ops/ISSUE_80_TASK_PACKET.md
   ?? server/lib/mailWorker/
   ?? server/mailWorkerFunctions.ts
   ?? src/tests/mailWorker.firestore.test.ts
   ?? src/tests/mailWorker.test.ts
   ?? src/tests/mailWorkerFunctions.test.ts
   ?? src/tests/notifyRoute.test.ts
   ```

7. **Deployment status:** `NOT DEPLOYED`. RUNTIME CONFIG CHANGES=NONE; COMMIT=NONE; PUSH=NONE; PR=NONE; DEPLOYMENT=NONE.

## Supporting evidence

- Issue and requirement IDs: #80 acceptance criteria and explicit owner session task; #72 existing queue path. Architecture trace: invitation/assessment creation -> `src/lib/notifications.ts` -> authenticated/rate-limited `/api/notify/mail` -> Admin SDK `mail/{id}` -> exclusive consumer -> replaceable provider -> durable result/retry/held failure.
- CI checks/URLs: NOT RUN for this local uncommitted change. No PR exists for this work.
- Security/privacy/data/migration/documentation impact: client deny-all rules unchanged; queue payload unchanged; stricter malformed-input rejection; no raw queue/provider errors logged. Worker adds consumer-owned delivery metadata only if later activated. Provider receives existing recipient/message only; credentials bound to functions through Secret Manager. Cutover, IAM residual scope, rollback and data/retention notes in `docs/SELF_MANAGED_EMAIL.md`; local architecture decision in `docs/adr/0080-self-managed-mail.md`.
- Known limitations: runtime packaging/deployment/configuration and live staging E2E remain separately authorized work. SUCCESS means provider acceptance, not receipt. Unknown send outcomes require manual reconciliation; no exactly-once guarantee. Separate API submissions remain separate mail. Existing generic API does not bind a message to a server-validated tenant invitation; pre-existing reminder UI says sent on queue success. These inherited limitations are documented, not silently claimed resolved.
- Rollback procedure: prior to activation leave the worker disabled/unwired. For a future deployed rollback stop ingress/consumers, wait and reconcile in-flight/unknown outcomes, prefer previous self-managed revision, never clear SUCCESS/unknown statuses blindly. Returning to #72 requires isolation of all worker-owned documents before reactivating the legacy consumer. See runbook for exact sequence.
- Optional reviewer (`review:*`, if engaged): `NONE`.
- Owner authorization still required (merge/deploy/secrets/production): yes; current instruction stops before commit. Any commit/push/PR/merge or runtime/secret/provider work needs the corresponding later owner command; production deploy is separate.
- Repository/live-state reconciliation: local worktree created at the supplied exact SHA; #72 source verified there. GitHub #80 and full #72 issue/comments read. PROJECT_STATE.md is an older snapshot, not proof of live email delivery. Live state not inspected or changed. No labels written (no `writer:*` label introduced).
- Project-state transition: none; this uncommitted local checkpoint is not a merge/deploy/issue transition. No historical ledger entries rewritten.
- Next authorized issue/action: owner reviews this local #80 diff; STOP BEFORE COMMIT.

## Gate decision

- Evidence gate: `FAIL` for delivered completion (expected authorization boundary); local implementation/checkpoint evidence recorded.
- Failed or unverified fields: NOT COMMITTED; NO PR/remote CI; live staging E2E NOT RUN; NOT DEPLOYED.
- Permitted wording: `local checkpoint`.

The gate passes only when every mandatory field is populated and consistent with repository, GitHub, CI, and deployment evidence. `NOT COMMITTED`, `NO PR`, failed/unrun required tests, unexplained working-tree changes, or unverified deployment prevent a full completion claim.

Merge requires required CI pass and owner authorization. Optional review is not a merge gate unless the owner explicitly designated it blocking for that task.

Local artifact location: `C:\Users\Admin\repos\guardentra-codex-80` (owner-accessible
filesystem worktree; not GitHub, Drive, or any deployed environment). Generated
ignored bundles `dist/server.cjs` and `dist/mail-worker/index.cjs` were confirmed
present in that worktree. The shared original checkout was not edited.
