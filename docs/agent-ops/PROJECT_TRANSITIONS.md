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
