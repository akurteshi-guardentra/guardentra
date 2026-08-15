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
- Additional: reviewer downloads require matching Storage generation + path. Recovery HEAD `42ef2176158b2afb3df3cfa186d5ddff15f6c0f7`.
- Corrective PR: recorded after `gh pr create` on this branch.
- Checks (local): `npm run lint` PASS; `npm test` 1/1 PASS; `npm run test:vitest` 178/178 PASS; `npm run test:firestore-rules` 42/42 PASS (includes P0-1 correction reopen); `npm run test:storage-rules` 19/19 PASS; `npm run build` PASS.
- Deployment: **NOT DEPLOYED BY THIS TASK**. Rollout of `85f718d`: **UNKNOWN — VERIFY APP HOSTING ROLLOUT**.
- Limitations: no malware scanner; metadata validation never produces `clean`; reviewer download stays fail-closed until an authoritative scanner writes `clean`.
- Next: independent Codex security review. Do not merge. Do not deploy. Do not reopen PR #39.
