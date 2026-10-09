# GuardEntra Project Transitions

Append-only verified transition log. Never rewrite an earlier entry to conceal a correction; append a correction citing the superseded entry.

## Required entry

Date/verifier; issue; previous → new state; branch/commit/PR; checks; deployment target and revision/ruleset or `NOT DEPLOYED`; repository/live reconciliation; evidence; blockers; next authorized action; remaining owner authorization.

## 2026-08-14 — P0-1 repository completion and live-state correction

- Issue: #10 / P0-1
- Repository: PRs #23/#24 are `MERGED`; `main` is `2aae09a237b615ecd78ec5bb6f3b67723a952c36`.
- Checks: lint PASS; lifecycle 8/8 PASS; Firestore emulator 36/36 PASS; build PASS; required CI PASS.
- Rules: `DEPLOYED` to `guardentra-7f582`; live rules match P0-1 source.
- Application: PR #23/#24 client is `NOT DEPLOYED`; public site remains on `build-2026-08-10-001` / `aa213558d6ce40d89060e96f2d72db660f1230f1`.
- Reconciliation: **MISMATCHED**. Old client submits but lacks intended close/snapshot payload.
- Permitted wording: code merged and rules live; intended behavior not fully live verified.
- Next: prepare production-equivalent application rollout; no deploy without explicit owner command.

## 2026-08-14 — Framework track recorded

- Issues #25–#32 created.
- #25 ready; #26/#32 blocked; #27–#31 not ready.
- Deployment: `NOT DEPLOYED`.
- Next: #25 inventory after current P0 reconciliation.

## 2026-08-14 — Project-control protocol started

- Issue #33.
- Transition: continuity proposal → authorized documentation work.
- Deployment: `NOT DEPLOYED`.
- Next: commit and PR; no merge or deployment.

## 2026-08-14 — P0-1 application rollout and live-bundle verification

- App Hosting serves application commit `2aae09a237b615ecd78ec5bb6f3b67723a952c36` on `guardentra.com`.
- PR #35 merged at `2ca586db1f10266577cbc0a29ff363ac2b2377aa`; probe/documentation only.
- Live probe: PASS for current FastTrack spine and P0-1 markers `submittedSnapshot`, `correctionReopenedAt`, and `portalOpen:!1`.
- Reconciliation: product application code and rules are deployed; `main` is ahead only by probe/docs.
- Limitation: bundle-marker verification is not a production end-to-end vendor submission.
- Next: merge issue #33 governance after required checks, then issue #11 investigation.

## 2026-08-14 — P0-2 investigation complete; implementation issue opened

- Verifier: owner-authorized GitHub metadata + documentation PR.
- Issue #11: previous `open investigation` → **CONFIRMED DEFECT / investigation complete / closed**. Verdict is **not FIXED**.
- Issue #37: created, **approved, not started**. Title: `[P0-2] Authoritative evidence states and backend-only trust enforcement`. Owner decision: **Option B**. Writer `tool:antigravity`; optional `review:codex`.
- PR #36: **closed unmerged** (`REQUEST CHANGES`). Head `eecdd3561b53b6f887096af339f6355826cc1f33` on `fix/p0-2-evidence-before-scan` **retained**. Do not merge or deploy.
- Repository `main`: `8d3e66e76e0e75ce7f9e64c05c985173310c2f42` (verified). Product code for P0-2 **not** on `main`.
- Checks for this documentation PR: as reported on the PR.
- Deployment: **NOT DEPLOYED**. Production application/rules **unchanged**. **P0-1 remains live.** **No malware scanner exists.**
- Reconciliation: live still matches P0-1; P0-2 trust enforcement is not live.
- Next authorized action: implement #37 after owner start; merge this documentation PR only if the owner later authorizes merge. No production deploy.

## 2026-08-15 — P0-2 Option B implementation (repository only)

- Verifier: Cursor (`tool:cursor` reassigned from Antigravity by owner).
- Issue #37: previous `approved, not started` → **implemented on feature branch / PR opened**. Not merged. Not live verified.
- Starting `origin/main`: `dbcd2c4d97a0de307eba2aa27c88030e5e45e580`.
- Branch: `fix/p0-2-authoritative-evidence-states`.
- Commit: `e944e451d6feba49340446b3588e47ae2a6c8be5`.
- PR: https://github.com/akurteshi-guardentra/guardentra/pull/39 (**open, not merged**).
- PR #36 remains closed unmerged. That branch was not used.
- Checks (local): `npm run lint` PASS; `npm test` 1/1 PASS; `npm run test:vitest` 160/160 PASS; `npm run test:firestore-rules` 39/39 PASS; `npm run test:storage-rules` 14/14 PASS; `npm run build` PASS.
- Deployment: **NOT DEPLOYED**. Production unchanged. **P0-1 remains live.** **No malware scanner exists.** `clean` is never produced by metadata validation.
- Limitations: malware scanning out of scope; evidence remains `scan_pending` after `validated`; AI/approval treat non-`clean` as untrusted.
- Next: Codex security review; owner merge authorization separate from deploy.

## 2026-08-15 — PR #39 merged at rejected head (emergency)

- Verifier: Cursor (`tool:cursor`).
- GitHub merged PR #39 at 2026-08-15T10:55:20Z. This writer did **not** merge it.
- Rejected reviewed HEAD: `6acbd63de0b52a1697d16221ac5eb1be4a916124` (Codex REQUEST CHANGES).
- Merge commit on `main`: `85f718de43b19fa9a8d10312d726d2bf0899aaeb`.
- Security blockers reached `main`. Corrective commit `8e9aa693bc8589ec2c6b5b2461a3b98563572146` was **not** in that merge.
- Deployment/rollout: **UNKNOWN — VERIFY APP HOSTING ROLLOUT**. Not deployed by this task.

## 2026-08-15 — Post-merge P0-2 security recovery (repository only)

- Verifier: Cursor (`tool:cursor`).
- Branch: `fix/p0-2-post-merge-security-recovery` from `origin/main` `85f718de43b19fa9a8d10312d726d2bf0899aaeb`.
- Cherry-pick source: `8e9aa693bc8589ec2c6b5b2461a3b98563572146` (no conflicts).
- Additional: reviewer downloads require matching Storage generation + path. Implementation commit `42ef2176158b2afb3df3cfa186d5ddff15f6c0f7`.
- Corrective PR: https://github.com/akurteshi-guardentra/guardentra/pull/40 (**open, not merged**). Recovery HEAD `1561ef1`.

## 2026-08-15 — PR #40 Codex REQUEST CHANGES (remediate + legacy keys)

- Verifier: Cursor (`tool:cursor`).
- `remediate` is not terminal; terminal lock is `approved` / `conditional` / `rejected` only.
- Trust lookup/merge recognizes raw, PR #39 `__`, and canonical percent-encoded keys. New writes use `FieldPath` + canonical encoding only.
- Deployment: **NOT DEPLOYED**. **NOT MERGED**. Rollout of `85f718d`: **UNKNOWN — VERIFY APP HOSTING ROLLOUT**.
- Next: Codex re-review of PR #40. HEAD `a163cbad205481235c37676f46f15ce0adab4dcc`. Local: lint PASS; test 1/1; vitest 187/187; firestore-rules 42/42; storage-rules 19/19; build PASS.
- Checks (local): `npm run lint` PASS; `npm test` 1/1 PASS; `npm run test:vitest` 178/178 PASS; `npm run test:firestore-rules` 42/42 PASS (includes P0-1 correction reopen); `npm run test:storage-rules` 19/19 PASS; `npm run build` PASS.
- Deployment: **NOT DEPLOYED BY THIS TASK**. Rollout of `85f718d`: **UNKNOWN — VERIFY APP HOSTING ROLLOUT**.
- Limitations: no malware scanner; metadata validation never produces `clean`; reviewer download stays fail-closed until an authoritative scanner writes `clean`.
- Next: independent Codex security review. Do not merge. Do not deploy. Do not reopen PR #39.

## 2026-08-15 — PR #40 production recovery (deploy production recovery)

- Verifier: Cursor (`tool:cursor`). Owner phrase: `deploy production recovery`.
- Old `main`: `85f718de43b19fa9a8d10312d726d2bf0899aaeb`. PR #40 head: `e54fcc2eb02c5439794d8dddc9846ee9fcaf6938`. Squash merge: `8ea4b24e1a15b03e518de8d928d56d7491bc8599`. GitHub `reviewDecision` unset at merge; no Codex APPROVE object on the head.
- Storage previous `ebffb056-6adb-4522-8086-061ecf70064e` → live `7bf9df8c-474f-4100-b5cc-77d019d7b2a9` (`releases/firebase.storage/guardentra-7f582.firebasestorage.app`). Published text: portal read is matching open session only; attachments `allow read: if false`.
- Firestore `(default)` previous `6a2b8292-1fc2-41da-b77b-48dd5165071b` → live `c12a5117-1675-4775-b25b-ca463b36e7dc` (`releases/cloud.firestore`). Live text includes `orgPreservesEvidenceTrust()` and `orgDeniesClientDecisionWrites()`. AI Studio ruleset `546970cd-d45f-48c0-85c3-5cf73c0016b2` unchanged.
- App Hosting previous `guardentra-build-2026-08-15-001` (`sha256:b2afbc7d81ac403c1a5999e9f8d087ba0c41faef7a765f15270c1fd78c320da9`) → **100%** `guardentra-build-2026-08-15-002` (`sha256:211e44bd9551d7c99966e4b74db5bead8510ca568520af57674539ebe8c01fa0`), created `2026-08-15T16:56:48Z`, Ready `2026-08-15T16:57:40Z`. Rollback remains `guardentra-build-2026-08-14-006`.
- Live checks: homepage 200; `/login` 200; `npm run verify:live` PASS (P0-1 portal markers); unauthenticated org/portal APIs 401 except `POST /api/org/assessment-decision` 400 on empty body. Live bundle contains `/api/org/assessment-decision` and `/api/org/archive-empty-assessment`. Dedicated test-assessment SDK matrix **BLOCKED/NOT RUN**.
- **No malware scanner exists.** Metadata validation does not produce `clean`. Reviewer download remains fail-closed without authoritative `clean` + matching path + generation.
- Issue #37: **OPEN** (dedicated live SDK verification not completed).

## 2026-08-15 — PR #40 dedicated live verification (mixed)

- Verifier: Cursor (`tool:cursor`). Disposable org `6b61d58cdd61427ca7fa` assessments A–D (synthetic PDF only). No customer assessments used. No `clean` fabricated.
- Historical audit: **14** `assessments` documents; **0** `evidenceTrustByStoragePath` maps; **0** `state=clean` (object or string); **0** terminal `decisionOutcome`/`decidedAt`. No assessment `updateTime` in 2026-08-15T10:56Z–16:54Z.
- PASS: org client trust/decision writes 403; ordinary vendor field write 200; org Storage SDK portal/attachment reads 403; portal A→A 200 / A→B 403; portal read after submit close 403; propose-answers none 401 / org 403 / cross 403 / bound 200; unauthenticated valid-shaped decision **401**; P0-1 submit 200 then rewrite 403.
- FAIL: `/api/org/evidence-download` and `/api/org/attachment-download` **500** (`getStorage().bucket()` — bucket name not specified). `/api/org/assessment-decision` after successful remediate: rejected/second terminal **500** (`decisionNotes` undefined in Firestore `update`). Concurrent: 500 + 200, not 409.
- **No malware scanner exists.** Metadata validation does not produce `clean`.
- Issue #37 **OPEN**. PR #43 remains open (do not merge until owner instructs). Do not deploy a follow-up from this task.

## 2026-08-17 — PR #44 production recovery deployed and live-verified

- Verifier: Cursor (`tool:cursor`). Owner phrase: `deploy production recovery`. Documentation close-out only in this PR; **no further deploy**.
- Supersedes, as **current** live state, the 2026-08-15 notes that dedicated verification was **BLOCKED/NOT RUN**, that the live matrix still had **500** failures, and that #37 must stay open **because verification is incomplete**. Those 2026-08-15 entries remain historical fact for that date.
- PR #44 head: `1e90a37507b4623aba3f7f855ff28f07bc345657`. Squash merge on `main`: `d233eaa09fa7cd0b0c9f5a4518ae2850f7d34eb9`.
- Project `guardentra-7f582`; region `us-central1`; App Hosting backend `guardentra`.
- Auto-roll on merge to `main` **did not start**. Manual build+rollout of the exact merge SHA succeeded: revision `guardentra-build-2026-08-17-001` at **100%**. Image `sha256:9031ec3eb08516847c42e3db47f589cd37642d22f59dc405901532464e519659`. Rollback: `guardentra-build-2026-08-15-002`.
- Firestore and Storage rules were **unchanged in PR #44 and NOT redeployed**. Live rulesets remain Firestore `c12a5117-1675-4775-b25b-ca463b36e7dc` and Storage `7bf9df8c-474f-4100-b5cc-77d019d7b2a9`.
- Bundle/unauth checks: `npm run verify:live` **PASS**; homepage **200**; `/login` **200**; unauthenticated evidence/attachment downloads **401**.
- 2026-08-17 synthetic live matrix **PASS** (disposable org `a48bc751f6b948cea3bf`, label `P0-2-DISPOSABLE-LIVE-VERIFY-2026-08-17T14-18-41-852Z`; synthetic PDF only; no customer assessments; **no fabricated `clean`**):
  - Attachment signed URL: **200**; bad path **400**.
  - Reviewer evidence download: controlled **403/400**, **no 500**.
  - Remediate → no-notes terminal (`rejected`): **200**.
  - Same assessment, second terminal: **409**.
  - Concurrent terminals: exactly **200 + 409**.
  - Client decision/trust writes: **403**.
  - Portal isolation: **PASS**.
  - P0-1 submit lock: **PASS**.
  - Live matrix used `rejected` as the no-notes terminal after remediate. Remediate → approved note-clearing **PASS** on PR #44 unit tests (`1e90a37` / merge `d233eaa`); a separate live remediate → approved assessment was not executed in this matrix.
- **No malware scanner exists.** Authoritative `clean` still requires real scanner state + matching path + generation.
- GitHub auto-closed #37 when PR #44 merged (before live verification). #37 was **reopened** for this ledger/governance close-out and **remains OPEN** until PR #43 merges. Do not start #41 or #42 yet. Do not change App Hosting traffic from this documentation task.

## 2026-08-17 — P0-2 ledger close-out completed

- Verifier: GitHub repository state.
- Issue #37: previous `OPEN pending ledger` → **CLOSED / COMPLETED**.
- PR #43: **MERGED** at `0f07657620d853cd9228ed58cf29b7d7e9960b73`.
- Repository/live reconciliation: PR #43 is documentation-only; it records the already-deployed PR #44 recovery and does not create a new deployment.
- Deployment: **NOT DEPLOYED by PR #43**. Last live-verified App Hosting revision remains `guardentra-build-2026-08-17-001` from PR #44 recovery.
- Limitation remains: **no malware scanner exists**; do not fabricate authoritative `clean`.
- Next authorized action: proceed to the next owner-authorized P0 workstream; historical entries above remain unchanged.

## 2026-08-18 — P0-F1 inventory merged; P0-F2 dependency satisfied

- Verifier: GitHub PR/issue/main state plus owner-provided Codex approval.
- Issue #25: previous `OPEN / inventory in review` → **CLOSED / COMPLETED**.
- PR #45: feature head `0455ac9e385e26b8087076823dbf2570d1de6880` → **MERGED** by squash at `f0f085d701340747963ef28e46ecd92eb9baf579` on `main` at 2026-08-18T22:11:01Z.
- Exact PR files: `docs/compliance/FRAMEWORK_INVENTORY.md`, `docs/compliance/FRAMEWORK_RIGHTS_REGISTER.md` only.
- Checks before merge: required GitHub `verify` PASS (workflow `32164889915`, job `95802062104`); optional Codex re-review reported **APPROVE** against exact feature head.
- Inventory result on `main`: 54 `controlKey`s, 8 framework packs, 3 mapping subsystems, 112 claim rows. Rights/provenance states remain conservative `unknown` absent stronger owner/publisher/counsel evidence.
- Deployment: **NOT DEPLOYED**. PR #45 is documentation-only; no Firebase rules, App Hosting, traffic, infrastructure, application behavior, or runtime transition is established by the merge.
- Issue #26 dependency on #25 is now satisfied; issue remains open and has been reconciled to `status:ready`.
- Repository/live reconciliation: `main` advanced to `f0f085d...`; last explicitly live-verified application state remains the PR #44 deployment recorded above.
- Next authorized action: review/merge the separate ledger close-out PR if desired, then start #26 on a fresh one-writer branch. No deployment without separate explicit owner authorization.

## 2026-08-19 — P0-F2 safe framework wording merged

- Verifier: GitHub PR/issue/main state.
- Issue #26: previous `OPEN / READY after #25` → **CLOSED / COMPLETED**.
- PR #47: **MERGED** by squash at `a213981ae6f9e252fa5880f4f2a19b3d31663ca4` on `main`.
- Scope: product wording corrections, `FRAMEWORK_CLAIM_DISPOSITION.md` (112 claim rows), safe pack wording helpers, and focused tests. Preserves conservative rights/provenance posture; does **not** claim official certification/partnership where unsupported.
- Checks: required GitHub `verify` PASS before merge (as reported on PR #47).
- Deployment: **NOT DEPLOYED to `guardentra-7f582` by this merge alone** for the purposes of this ledger refresh. Staging subsequently deployed `a213981` separately (see below). Production-equivalent `guardentra-7f582` traffic remained on prior build until/unless separately authorized.
- Next authorized action: staging infrastructure and verification; merge ledger PR #46 when owner authorizes.

## 2026-08-20 — Staging Firebase project established

- Verifier: owner-authorized GCP/Firebase provisioning (`admin@guardentra.com`).
- Transition: named staging project absent → **`guardentra-staging` established** (project number `965959469996`, org `280975227603`, billing linked).
- Enabled: Firestore `(default)`, Firebase Auth (email/password, anonymous, Google), Storage bucket `guardentra-staging.firebasestorage.app`, web app, Secret Manager placeholders, Developer Connect to GitHub `test` branch.
- Deployment: infrastructure provisioning only; **no change to `guardentra-7f582` runtime**.
- Next: pre-deploy wiring (secrets, IAM, App Hosting backend).

## 2026-08-20 — Git `test` branch aligned to release candidate

- Verifier: Git remote state.
- Branch `test`: established/verified at `a213981ae6f9e252fa5880f4f2a19b3d31663ca4` (matches `main` release candidate).
- Deployment: **NOT DEPLOYED** (branch pointer only).

## 2026-08-21 — Staging App Hosting deployment live

- Verifier: Firebase App Hosting API + live HTTP checks.
- Target: project `guardentra-staging`; backend `guardentra-staging`; region `us-central1`; Git branch `test`.
- Release commit: `a213981ae6f9e252fa5880f4f2a19b3d31663ca4`.
- Build: `build-2026-08-21-002` **READY**.
- Rollout: `rollout-2026-08-21-001` **SUCCEEDED** at **100%**.
- URL: `https://guardentra-staging--guardentra-staging.us-central1.hosted.app` — homepage **200**; `/api/health` **200**.
- Runtime: `AUDIT_SPINE_ENABLED=false`; `APP_ENV=production` from shared `apphosting.yaml`.
- Production reconciliation: **`guardentra-7f582` unchanged** — no staging operation deployed application code, rules, traffic, or data to production-equivalent project.
- Next: deploy staging Firestore/Storage rules; portal E2E gate.

## 2026-08-21 — Staging Firestore and Storage rules deployed

- Verifier: Firebase Rules API releases + emulator/live denial checks.
- Firestore release: `projects/guardentra-staging/releases/cloud.firestore` → ruleset `ca5b4258-18e2-4d79-880b-b1a4e9129585`.
- Storage release: `projects/guardentra-staging/releases/firebase.storage/guardentra-staging.firebasestorage.app` → ruleset `6a4560f0-deac-4dd7-be16-a274e4bb8b56`.
- Checks: Firestore emulator **42/42 PASS**; Storage emulator **19/19 PASS**; live unauthenticated/anonymous denial checks **PASS**.
- Production reconciliation: **`guardentra-7f582` rules unchanged** (Firestore `c12a5117-1675-4775-b25b-ca463b36e7dc`; Storage `7bf9df8c-474f-4100-b5cc-77d019d7b2a9`).
- Next: final staging portal E2E gate.

## 2026-08-21 — Staging portal E2E troubleshooting (historical; superseded)

- Verifier: Cursor staging gate attempt.
- Symptom: `POST /api/portal/session` returned HTTP **500** (`PERMISSION_DENIED` — Admin SDK targeted wrong project until `GCLOUD_PROJECT`/`FIREBASE_STORAGE_BUCKET` set; App Hosting compute SA lacked Firestore/Auth access initially).
- Secondary: `gcloud logging read` quote-parsing failure (**exit 2**) during mid-gate probe — tooling error only.
- Status: **SUPERSEDED** — not a current blocker. Do not treat as live staging state.
- Superseded by: runtime env on Cloud Run revision `guardentra-staging-00002-lrg`, IAM grants for App Hosting compute + Storage rules agents, and successful final E2E below.

## 2026-08-21 — Final staging portal E2E PASS

- Verifier: owner-authorized synthetic fixture gate (`STAGING_PORTAL_E2E` / `stagingTest` tagged data; no real PII).
- Target: `guardentra-staging`; `PORTAL_API_BASE=https://guardentra-staging--guardentra-staging.us-central1.hosted.app`; staging Firebase client config (not `guardentra-7f582`).
- Mode: **`[mode: scoped-token]`** — anonymous fallback would have been **FAIL**.
- Results (**all PASS** at final verification): authenticated staging org login; portal token mint; scoped `portalAssessmentId` claim; Assessment A access; Assessment B isolation; Firestore cross-assessment read/write denial; Storage cross-assessment denial; scoped Assessment A Storage upload/read; submit; post-submit lock; invalid/missing assessment fail-closed.
- Synthetic fixtures: created for gate, then **deleted** (`CLEANUP=DELETED_SYNTHETIC_FIXTURES`). No production IDs or customer data used.
- Production reconciliation: **`guardentra-7f582` unchanged** — App Hosting `build-2026-08-18-002` at **100%** on branch `main`; rulesets unchanged.
- Remaining follow-up (not part of this ledger merge): persist `GCLOUD_PROJECT` / `FIREBASE_STORAGE_BUCKET` in committed App Hosting config before next staging rollout.
- Next authorized action: merge ledger PR #46; no production deploy implied.

## 2026-08-23 — Ledger PR #46 refresh (documentation only)

- Verifier: Cursor (`tool:cursor`); owner authorization: documentation-only refresh of existing PR #46.
- Branch: `docs/p0-f1-merge-ledger-closeout` reconciled onto `origin/main` `a213981ae6f9e252fa5880f4f2a19b3d31663ca4`.
- Files: `docs/agent-ops/PROJECT_STATE.md`, `docs/agent-ops/PROJECT_TRANSITIONS.md` only in this commit.
- Deployment: **NOT DEPLOYED — DOCUMENTATION RECONCILIATION ONLY**.
- Reconciliation: records P0-F2 merge, staging establishment/deployment/rules/portal E2E PASS, and unchanged production-equivalent `guardentra-7f582`. Clarifies intended architecture (`test` → `guardentra-staging`; `main` → `guardentra-prod`) vs current live legacy.
- Next authorized action: owner merge of PR #46 when satisfied. No production deployment authorized by this PR.

## 2026-08-27 — Production release acceptance (guardentra-prod LIVE; domain unchanged)

- Verifier: Cursor (`tool:cursor`). Owner phrases: `deploy production`, `deploy production rules`, then release-acceptance closeout (docs only; **no domain cutover**).
- Transition: `guardentra-prod` absent/unverified → **provisioned + App Hosting LIVE + rules LIVE + scoped portal E2E PASS**; public domain **unchanged** on legacy.
- Repository candidate / deployed application SHA: `29171a64078e3943149dccf63d8caa7650ad0125`.
- App Hosting: project `guardentra-prod`; backend `guardentra-prod`; build `build-2026-08-27-001` **READY**; rollout **SUCCEEDED** at **100%**; revision `guardentra-prod-build-2026-08-27-001`; automatic rollouts **DISABLED**.
- Hosted URL: `https://guardentra-prod--guardentra-prod.us-central1.hosted.app` — homepage **200**; `/api/health` **200**.
- Firestore rules: release `projects/guardentra-prod/releases/cloud.firestore` → ruleset `2e9c308d-9889-4b16-8d55-63b4c77e5ce4`.
- Storage rules: release `projects/guardentra-prod/releases/firebase.storage/guardentra-prod.firebasestorage.app` → ruleset `76913163-f67e-44d6-b262-6362447d8726`.
- IAM: `roles/datastore.viewer` granted to `service-191663365586@gcp-sa-firebasestorage.iam.gserviceaccount.com` (Storage rules `firestore.get()`).
- Portal security gate: **PASS** — mode **`[mode: scoped-token]`**; A→B isolation **PASS**; submit/lock **PASS**; Storage isolation **PASS**; synthetic assessment/org fixtures **deleted**.
- Auth: Email/password ENABLED; Google ENABLED; Anonymous DISABLED.
- **No malware scanner exists** / **NOT IMPLEMENTED**.
- Legacy public domain: `https://guardentra.com` still on `guardentra-7f582` backend `guardentra`, traffic **100%** `build-2026-08-22-001`; custom domain `guardentra.com` **HOST_ACTIVE / OWNERSHIP_ACTIVE / CERT_ACTIVE**.
- DNS snapshot (read-only): `guardentra.com` A `35.219.200.15` TTL ~1799s; `www` CNAME → `guardentra.com` TTL ~1799s; NS `dns1/dns2.registrar-servers.com` TTL ~1800s; TLS CN=`guardentra.com`, issuer Google Trust Services WR3.
- Cutover: **NOT AUTHORIZED / NOT PERFORMED**.
- Residual: synthetic Auth user `gate-noclaim-1787847305230@guardentra-test.invalid` (uid `yut6NIvWCeZXBYAQE2v71yXIPP52`) — **SYNTHETIC AUTH CLEANUP — OWNER AUTHORIZATION REQUIRED**.
- This documentation PR: docs-only; **NOT DEPLOYED**; does not change DNS, App Hosting traffic, or rules.
- Next authorized action: owner merge of this docs PR when satisfied; separate explicit command required for Auth cleanup and for any `guardentra.com` cutover.

## 2026-09-01 — PR #48 finalize: production SHA ledger clarification (docs only; no cutover)

- Verifier: Cursor (`tool:cursor`). Owner authorization: finalize PR #48 ledger wording; merge when CI green; **no public traffic cutover**.
- **Production application release SHA:** `29171a64078e3943149dccf63d8caa7650ad0125`. This is the deployed application SHA. Documentation-only repository commits may advance `main` without changing the deployed production application while automatic production rollouts remain **DISABLED**.
- Synthetic Auth cleanup (uid `yut6NIvWCeZXBYAQE2v71yXIPP52`): owner authorized 2026-09-01; **BLOCKED** this session — GCP/Firebase OAuth reauth required (`invalid_rapt` / non-interactive refresh failure). Re-run after interactive `gcloud auth login --update-adc`.
- Domain migration preparation (`Migrate a domain` on `guardentra-prod`): **BLOCKED** same credential failure; no custom domain API create performed this session.
- Public traffic: `guardentra.com` remains on legacy `guardentra-7f582` / backend `guardentra` / build `build-2026-08-22-001`.
- Deployment: docs merge must **NOT** trigger application rollout (automatic rollouts **DISABLED** on `guardentra-prod`).

## 2026-09-07 — P0 Firebase client environment isolation (code PR; NOT DEPLOYED)

- Verifier: Cursor (`tool:cursor`). Owner authorization: audit, implement fix, commit, push, open PR; **DO NOT MERGE / DEPLOY**.
- Confirmed defect: `src/firebase.ts` resolved `VITE_FIREBASE_* || firebase-applet-config.json` per field; shared `apphosting.yaml` supplied only `VITE_FIREBASE_API_KEY` at BUILD → staging Vite bundles could mix staging API key with demo `guardentra-7f582` projectId/authDomain/bucket/appId (onboarding permission-denied / empty staging tenant).
- Staging before fix: **MIXED** (live build `build-2026-09-07-001` / SHA `9f5e67b…` BUILD vite vars = `VITE_FIREBASE_API_KEY` only). App Hosting Environment name: **unset**.
- Production before fix: **SAFE** (BUILD overrideEnv includes full `VITE_FIREBASE_*` name set on backend `guardentra-prod`; Environment name = `prod`). Values not printed.
- Fix strategy: fail-closed coherent resolver (`src/lib/firebaseClientConfig.ts`); `apphosting.staging.yaml` + `apphosting.prod.yaml` (+ preferred `apphosting.production.yaml`); docs update.
- Deployment: **NOT DEPLOYED**. Rules/DNS/IAM/data: **unchanged**.
- Remaining operator actions: set staging Environment name → `staging`; merge PR when authorized; separate **deploy staging** command; optional rename prod Environment `prod` → `production`.


## 2026-09-15 — PR #52 merge + staging durable Cloud Tasks scanner LIVE VERIFIED (P0 scanner workstream CLOSED)

- Verifier: Cursor (`tool:cursor`). Owner authorized merge of PR #52; production deploy **not** authorized.
- Transition: P0 authoritative evidence malware scanner repository work → **MERGED**; staging durable delivery → **LIVE VERIFIED**; production scanner → remains **NOT DEPLOYED**.
- Feature tip: `39fde456312586b1fff36a9cd68c13656ca6fa39`.
- Merge commit / `main` tip: `a322f96146976a98a2b2ee800fdac7cce1af0380`.
- Post-merge CI: run **#170** / `34902620059` **SUCCESS**.
- Staging App Hosting: revision `guardentra-staging-build-2026-09-14-001`; build `build-2026-09-14-001`; rollout `rollout-2026-09-14-001`; traffic **100%**; source SHA matches feature tip; delivery `cloud_tasks`; queue `evidence-malware-scan` **RUNNING**.
- Durability (#8H-E): queue pause → portal validate → `scan_pending` + Cloud Task exists outside process → resume → terminal. Clean **PASS** (clamav/clean). EICAR **PASS** (quarantined/infected/Eicar-Test-Signature). Generation binding **PASS**. Idempotent deterministic task identity **PASS**.
- Informational limitation retained: live G1 stale-generation Cloud Task was not directly observed via `describe` during first pass; final G2 binding **PASS**; exact-tip automated `stale_generation` ACK **PASS**.
- Production (`guardentra-prod`): **UNCHANGED** — still `build-2026-08-27-001` at **100%**; scanner **NOT DEPLOYED**; no production secrets/DNS/IAM/Eventarc changes from this workstream.
- P0 authoritative evidence scanner workstream: **CLOSED**.
- This documentation update (Issue #53 / Action #9A): docs/governance only when committed; **NOT DEPLOYED**; does not authorize production scanner rollout.

## 2026-10-08 — Issue #74 migration correction and named-staging preparation evidence

- Writer/verifier: Codex, single preparation writer; Owner authorized continuation of
  existing preparation. No new automation or parallel branch writer created.
- PR #183 remains draft/unmerged on `infra/named-staging-audit-74`.
- Verified code checkpoint: `9cd2584ce2d6966e77ff499e3a49769ec8b2e21d`, parent
  `766f8bdd11fcfa1296e36a56e3496a04584193e3`.
- Confirmed defect: `002_roles.sql` used invalid `DO $ ... $;` delimiters; replaced with
  matching `$audit_roles$` delimiters. NOLOGIN role and existing privileges retained.
- PostgreSQL 16.15 job: first and repeated migration execution PASS; authenticated
  application login's allowed appends/outbox/metadata operations and forbidden
  mutation/DDL/elevation contract PASS. Synthetic disposable CI database only.
- All three Terraform roots validated without cloud auth or remote backends. Google
  provider 6.50.0 locks include Linux/Windows amd64 checksums.
- Exact-code runs: infra-ci 37712224946 SUCCESS, CI 37712224826 SUCCESS.
- Added preparation-only local-state backend bootstrap; proposed staging bucket and
  bucket-scoped operator binding are NOT PLANNED/APPLIED against live Google Cloud.
- Owner's Windows email changes and isolated local SQL correction were not touched.
- No cloud mutation occurred in this turn. Owner's earlier Service Networking API
  enablement is retained as baseline evidence, not hidden by a zero-change assertion.
- NOT DEPLOYED; production unchanged by this preparation. Final plans, identity/TLS,
  cost/retention/residency decisions, approvals and live #74 acceptance remain pending.

## 2026-10-09 — #74 state-isolation prerequisite identified (preparation only)

- Current verified prior head: `193343d95ce2002d6e167db81ed01bcdf9ea5ad8`, draft PR #183.
  Both exact-head workflows SUCCESS: CI 37712508453, infra-ci 37712508458.
- Authenticated Owner evidence: candidate state bucket lookup 404; operator
  `user:admin@guardentra.com` has project Owner; runtime has project-wide Storage
  Object Viewer and overlapping broad Firebase roles.
- Public Google role reference confirms Firebase Admin also has Storage object access.
  Bucket-scoped operator grants do not remove inherited access.
- Transition: original same-project bootstrap candidate -> BLOCKED pending isolation
  design. Added read-only role inventory collector and default-false approval gate.
- No live role removal, grant, bucket creation, state write, API enablement or deployment.
- Next prerequisite: run the collector, reconcile all overlapping permissions and
  review isolated-backend versus same-project IAM correction scope with the Owner.

### 2026-10-09 — Isolation gate ordering clarification

- The initial preparation used an Owner-design-approval flag before plan. Corrected
  to `state_isolation_review_complete`: record the technical isolation review, prepare
  the concrete plan, then request Owner approval before cloud apply. The gate is not
  proof of live access denial and cannot grant deployment/IAM authority.


## 2026-10-09 — #74 predefined-role collector command correction

- Owner's collector at `0f3a28e9c35e2d3ca63e8b090fb4844ba5ee35c7` failed on
  `roles/datastore.user`: predefined roles cannot receive a project/organization parent.
- Corrected global predefined-role requests to use `--billing-project=guardentra-staging`;
  other fixed metadata calls retain `--project=guardentra-staging`.
- Added Windows PowerShell 5.1 mocked-command regression tests: scope arguments,
  overlapping Storage permissions, deduplication, failed request/no report and
  existing-report preservation. No live credentials or cloud writes in these tests.
- Prior AST-only CI did not catch this semantic error. Corrected-head CI pending.
- Report collection and state-isolation review remain pending. No apply, deployment,
  live IAM change, merge or change to the Owner's Windows worktrees.


## 2026-10-09 — #74 full IAM inventory narrows state proposal

- Verified collector code head `d899176e8eb7b4b377fbfec8f509b82927d3c697`:
  CI 37870790611 SUCCESS (including Windows mocked-command regressions), infra-ci
  37870790765 SUCCESS. Owner's live collection succeeded; capture time
  `2026-10-09T01:45:34.8278659Z`.
- Full metadata confirms project `965959469996`, direct organization `280975227603`,
  and four unconditional overlapping Storage roles on staging runtime.
- Subsequent returned organization IAM grants only admin@guardentra.com; runtime
  account Token Creator is a self-grant. SDK account has no account-level bindings;
  project-level SDK Token Creator/Storage Admin grants still exist.
- No dedicated state project found in returned active direct-child project metadata;
  no exhaustive folder/indirect-access or live denial assertion is made.
- Recommended preparation route: separate state-only project proposal. Same-project
  bootstrap remains blocked; new root/plan waits for billing/policy/name metadata.
- Added proposal and narrow release/task/ledger reconciliation. No cloud mutation,
  API enablement, token generation, plan/apply, merge or deployment in this review.


## 2026-10-09 — #74 guarded isolated state root prepared, not applied

- Starting preparation head `7b83f357eaff7995a3c4cb16b18b3d3dbe623212`; exact-head
  CI 37872539201 and infra-ci 37872539214 verified SUCCESS before new edits.
- Owner reauthenticated. Billing metadata confirms staging account
  `019203-E57CB3-666105`; Resource Manager fallback returned seven org policies after
  orgpolicy API SERVICE_DISABLED. Candidate bucket 404, candidate project 403:
  global availability is not proven. No API enablement performed.
- Added a separate fixed-project/organization/billing/human-operator root, protected
  project/bucket, required billing input and default-false technical review precondition.
  Added six mocked plan guardrails to CI; no live Google calls in routine CI.
- Corrected earlier network-free intent: provider false auto-network flag cleans up a
  transient new-project default network and enables Compute API there. These side
  effects require explicit future bootstrap scope, with no staging network modification.
- New head validation pending. No real plan, state/backend writes, apply, IAM mutation,
  project creation, rollout, merge or production action. Costs, residency, policy/name
  review, credentials/custody and empty-bucket denial tests remain gates.


### Isolated-root correction cycle 1

- New code head `4c47baed82746c777bfe8f80a6fd80dc0e230191` infra-ci
  37980315215 caught an overlength project display name before mock tests ran.
- Shortened display name to `GuardEntra Staging State` (23 characters). Project ID,
  organization, billing, IAM and privacy/recovery guards are unchanged.
- Existing three roots and PostgreSQL migration job passed on that head; corrected
  head schema/mock verification pending. No live cloud operation occurred.


## 2026-10-09 — #74 technical proposal review permits real plan preparation

- Corrected root code `1f56352a81e91c48950fea45ea572cd2140ea9b6`:
  infra-ci 37980490973 and CI 37980491095 SUCCESS; six mocked tests PASS.
- Owner Windows output on that SHA: format/init/validate PASS, six tests PASS, clean.
- Org owner customer `C02fbgmro` matches policy; billing account open USD under the
  inventoried org. ADC file present, reported credential overrides false; actual ADC
  identity remains unproven. No credential values retrieved or recorded.
- Recorded design review/cost scenario and local-plan custody assumptions; real
  local-backend plan preparation permitted. No apply approval or live-test proof.
- Real plan/hash/actions, authenticated execution identity, encrypted recovery custody,
  residency/cost acceptance and live empty-bucket tests remain gates. No cloud writes,
  API enablement, token display, project creation, merge or deployment in this review.


## 2026-10-09 — #74 exact real bootstrap plan received, not applied

- Owner real plan at code `1f56352a81e91c48950fea45ea572cd2140ea9b6`:
  4 additions, zero changes/deletions, fixed state-only scope.
- Saved artifact SHA-256
  `CB250BF233AF001005BAE761A534A94B3DDE98B5B2715625935B896D1D3B778C`.
- Confirmed operator-command defect: PowerShell passed literal `$gePlanPath` as output
  filename. Preserved and renamed the successful plan, then hashed it; no plan rerun
  or cloud mutation. Future native argument must be quoted as `"-out=$gePlanPath"`.
- Added concrete state-only approval packet and narrow ledger/source reconciliation.
  Actual ADC identity and encrypted durable local-state custody remain prerequisites
  to exact apply approval. No live access test, resource creation, merge or deployment.


## 2026-10-09 — #74 cloud custody selected; Windows changes excluded

- Owner ADC identity output: admin@guardentra.com, verified email true. No credential
  value is recorded. Existing C: encryption status was a read-only observation.
- Owner explicitly requests cloud custody and no enabling/changing Windows BitLocker.
- Updated exact-plan packet with default cloud encryption, temporary local bootstrap
  interval, isolation gate, separate bootstrap/audit prefixes and reviewed migration
  plus version-specific recovery verification. This is a proposal, not live proof.
- Prior documentation head ec4b03d1ceeafc09ae574f2601f2e214e0f39b03 passed both
  workflows. Saved plan/code/hash unchanged. No apply, cloud write, merge or deployment.


## 2026-10-09 — #74 state bootstrap applied; metadata reviewed

- Owner continued with exact-hash execution after the concrete scope review; guarded
  Windows apply reports 4 added / 0 changed / 0 destroyed. Saved plan must not be rerun.
- Uploaded readback confirms state project 748382914138, correct org/billing and bucket
  privacy/versioning/soft delete. Project convenience grants on bucket are explicitly
  recorded, not treated as public access or an exact-human-only policy.
- Expected new-project Compute/OS Login/Storage APIs and empty network list returned.
- Prior head 6a78c6be839a1880bee1ab4a4a497efba89f3fdd: CI 37983970422 and
  infra-ci 37983970717 PASS. Remote state/access denial/recovery checks still pending.
- State-only bootstrap is applied; no audit DB, secret operation, app deployment,
  merge or production change. No Windows encryption setting was changed.


## 2026-10-09 — #74 policy evaluation and operator storage test

- Diagnostic API activated only in new state project; initial propagation errors
  resolved. Seven runtime permissions have no allow grant across returned policies.
  ERROR_IAM_DENY remains explicit; no real runtime denial/PAB/impersonation proof.
- Owner synthetic 75-byte upload/exact-generation read/hash/cleanup PASS, generation
  1791577394388974. No state or secret payload inspected or committed.
- Prepare interactive bootstrap state migration with unique local backup, lineage,
  serial and exact-resource checks; separate prefix from audit DB. Migration pending.
- No application deployment, merge, SQL operation or production change.


## 2026-10-09 — #74 bootstrap state migrated to GCS

- Owner interactive migration found empty destination and copied local bootstrap
  state to separate GCS bootstrap prefix. Provider stayed Google 6.50.0.
- Owner verification PASS: lineage, four addresses; remote serial 6. Unique local
  pre-migration backup retained; backend.tf generated only in Owner worktree.
- Actual state-version recovery remains pending; synthetic file download is not
  sufficient evidence for that claim. Audit/database state prefix remains separate.
- No SQL creation, DB migration, app deployment, merge or production mutation.


## 2026-10-09 — #74 database network planning checkpoint

- Owner fresh staging inventory: 42 subnets / 43 routes; no listed global addresses,
  default-VPC peerings or SQL instances. 10.20.0.0/16 primary-subnet/specific-route
  overlap check PASS against returned snapshot; default Internet route excluded.
- Prepare only separate audit-prefix database plan in a new pinned worktree, after
  empty-prefix metadata check. Never overwrite Owner dirty audit/bootstrap worktrees.
- No DB creation approval, secure credentials/TLS/runtime attachment proof, migration,
  deployment, merge or production operation granted by this planning checkpoint.


## 2026-10-09 — #74 database plan security correction prepared, not published

- Real plan received: 8 additions, zero changes/deletions, hash recorded in packet.
- Missing explicit SSL mode/API deletion flag found. Prepared ENCRYPTED_ONLY and
  deletion_protection_enabled true; retained existing protections. Added negative
  scope tests and security assertions, plus cloud-neutral CI root execution.
- Original saved plan superseded, not applied. New-code schema/CI/mocks and a fresh
  real plan are pending. Local fmt/diff PASS; provider startup validation BLOCKED.
- GitHub auto-review rejected publishing sensitive inventory metadata; Owner disclosure
  approval requested. No workaround/publish attempt, merge, SQL apply or rollout.


## 2026-10-09 — #74 publication authorization reconciled

- Owner directed continuation after the explicit request to publish the prepared
  security corrections and reviewed infrastructure notes to existing draft PR #183.
- Narrow publication scope recorded; no database apply, merge, secret payload or
  application deployment authorization added. Superseded saved plan stays blocked.


## 2026-10-09 — #74 replacement database plan reviewed for exact approval

- Executable 89637c01768808ecd203f89102c2dabe4707ee3a passed CI/infra-ci; five new
  named-staging mock tests and existing PostgreSQL privilege contract PASS.
- Owner real plan confirms 8 additions and both explicit protections; exact hash
  AA15806393F1872EFE907F5A295CFDC94C91914CB37EA977A81C2A9AEC9D08E9.
- Prepared infrastructure-only packet with exact resources, HA cost scenario, residency,
  managed-service side effects, limits, post-apply checks and preserve-on-failure handling.
- No database apply, DB credentials/schema migration, rollout, merge or production action.


## 2026-10-09 — #74 database infrastructure applied; integration pending

Owner explicitly approved the replacement plan and supplied successful Terraform
apply output: 8 added / 0 changed / 0 destroyed, lock released. Executable SHA
89637c01768808ecd203f89102c2dabe4707ee3a; exact approved plan hash
AA15806393F1872EFE907F5A295CFDC94C91914CB37EA977A81C2A9AEC9D08E9.
Reported PostgreSQL instance guardentra-staging-audit has private IP 10.20.0.2,
connection guardentra-staging:us-central1:guardentra-staging-audit and database
guardentra_audit. State lists eight managed resources and one network data source.
See docs/release/AUDIT_STAGING_DATABASE_APPLY_PACKET_74.md for scope and limitations.
This is an Owner-terminal infrastructure checkpoint; independent metadata readback,
scanner health, state recovery, credentials, migrations and runtime integration
remain pending. No application rollout, audit activation, merge or production action.
Never rerun the applied plan; preserve infrastructure and unrelated Owner work.


## 2026-10-09 — #74 post-apply Owner API metadata checkpoint

Owner attachment Pasted text(5).txt reports SQL RUNNABLE, POSTGRES_16, REGIONAL,
db-custom-2-8192; only PRIVATE address 10.20.0.2; ipv4Enabled false;
sslMode ENCRYPTED_ONLY; API deletionProtectionEnabled true. Legacy requireSsl false
is not evidence of plaintext admission with this SSL mode. Server CA mode is
GOOGLE_MANAGED_INTERNAL_CA; client certificate/server-identity verification remains
unproven. Backups and PITR enabled, seven retained backups and seven log days.
Automated backup 1791581139351 is SUCCESSFUL, location us (not a pinned single-region
backup or successful restore proof). PSA servicenetworking-googleapis-com is ACTIVE.

Cloud Run reports Direct VPC network interfaces on staging default network and
us-central1 default subnet, private-ranges-only egress. This establishes configured
network access, not successful database TCP/TLS/authentication. No cloudsql-instances
annotation appears in the returned template; the documented /cloudsql socket path
is not established by these settings. Existing revision
guardentra-staging-build-2026-09-14-001 still receives 100 percent traffic.
Scanner VM guardentra-staging-clamav-01 is RUNNING in us-central1-a, but nested IP
projection returned no network address; no scanner health or scan request proof.
NAT still reports auto-allocated 34.46.14.242, two mapped endpoints and zero extra
IPs needed. These are metadata observations, not application connectivity tests.

Next: inspect active revision audit flag and secret-version reference without values,
SQL user metadata and database existence; prepare a separate encrypted private
migration execution path and least-privilege identities. Preserve current secret
versions and disabled audit state. No migration, credential rotation, runtime change,
merge or production action executed. Actual state recovery and live SQL privilege
tests remain pending; #74 is not complete.
