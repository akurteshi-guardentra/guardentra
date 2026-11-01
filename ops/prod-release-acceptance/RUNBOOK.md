# Production release acceptance runbook: promote one pinned RC release to guardentra-prod

Prepared 2026-10-31 (P0 "release acceptance"). **Status: DOCUMENT ONLY. Nothing here has been run.**

- Every phase marked **GATE** needs its own explicit owner go, recorded as an Owner comment on the release issue/PR (AGENTS.md `github-owner-grant`). Approval for one gate does not carry to the next.
- Scripts named `0x-readonly-*` only read (HTTP GET, `gcloud ... list/describe`, plus Firestore count aggregation, which is a read-only POST). Scripts named `0x-DEPLOY-*` / `0x-ROLLBACK-*` change things: they check live state first, ask you to type the project name, and read back.
- Scanner (#73) and email (#72) stay **planning-only**. This runbook never enables either on prod.
- Never release the RC/Option B rules to `guardentra-7f582`. Legacy stays on Option A, and its AI Studio DB stays deny-all.
- Keep these as separate milestones: `MERGED` != `CI VERIFIED` != `STAGING LIVE VERIFIED` != `PROD DEPLOYED` != `PROD LIVE VERIFIED` (docs/release/GO_LIVE_E2E.md).

Files in this folder:

| File | Kind | Purpose |
|---|---|---|
| `RUNBOOK.md` | doc | This runbook |
| `01-readonly-prechecks.ps1` | read-only | Section 3 pre-checks, PASS/FAIL per item, writes `out\prechecks-<sha>.json` |
| `02-readonly-post-promotion.ps1` | read-only | Section 4 readback after rollout (served SHA, headers, CORS, bundle, rules) |
| `03-ROLLBACK-app.ps1` | **changes prod** (gated) | Re-serves the existing build `build-2026-08-27-001` (29171a6). No rebuild |
| `04-DEPLOY-option-b.ps1` | **changes prod** (gated) | Releases `firestore.rules.prod-option-b` on guardentra-prod only, after promotion |
| `05-ROLLBACK-option-b.ps1` | **changes prod** (gated) | Re-releases Option A ruleset `2a30bd60…` |
| `firestore.rules.prod-option-b` | rules | Copy of `ops/prod-rules-option-b/` (sha256 LF `015062ab…`) |
| `EVIDENCE.md` | template | Fill-in evidence record |
| `chatgpt-summary.md` | summary | Paste block for ChatGPT review |

All scripts are Windows PowerShell 5.1, need `gcloud` signed in as admin@guardentra.com, and were **reviewed by reading only** (no PowerShell in the authoring container). Run `01` first and paste its output before anything else.

---

## 1. Known state (2026-10-31, with evidence labels)

| Item | Value | Label / source |
|---|---|---|
| Prod backend | `guardentra-prod` / us-central1 / backend `guardentra-prod`, Environment name `prod`, live branch `main`, **rollouts disabled** | LIVE VERIFIED 15:41Z, reports/env-consistency-2026-10-31.md |
| Prod serving | `build-2026-08-27-001` @ **29171a6**, 100% traffic, bundle `index-BU4Du5f7.js`; guardentra.com serves it | LIVE VERIFIED 15:41Z |
| Prod Firestore rules | `cloud.firestore` -> `2a30bd60-c037-45e5-ae47-6ab164e2e881` (Option A, sha LF `a0645160…`) | DEPLOYED + read back 09:03Z |
| Option B rules | `ops/prod-rules-option-b/firestore.rules.prod-option-b`, sha LF `015062ab…`; logic == RC `firestore.rules` (sha `f53bd980…`, unchanged since 93e2f01, still true at 25e273e6); 98/98 RC suite, breaks 29171a6 vendor create | SOURCE VERIFIED (emulator) |
| Prod Storage rules | `76913163…`, sha `c9629c78…` == RC/main `storage.rules` | LIVE VERIFIED 15:41Z |
| Prod indexes | **0** composite. 29171a6 needs 4; the RC needs 8 (`firestore.indexes.json` sha `f2d695c0…`, same at caf2709 and 25e273e6) | LIVE VERIFIED; fix script in draft PR #239 |
| `AUDIT_DATABASE_URL` | prod secret exists (v1), value unverified. Prod runs `AUDIT_SPINE_ENABLED=false`, so the RC server never opens the DB (`server/lib/audit/pool.ts`); the secret only has to resolve at build | LIVE VERIFIED (name only) |
| `PUBLIC_APP_URL` | `https://guardentra.com` owner-approved as config 16:12Z; **only on draft PR #239, not on the RC**. RC `notify.ts` refuses invite links without it in production; `stripe.ts` refuses checkout redirects; CORS allowlist uses it | SOURCE VERIFIED |
| Auth (prod) | email/password on, anonymous off, Google on, self sign-up open, MFA off; authorized domains list only `guardentra-prod.firebaseapp.com` / `.web.app` | LIVE VERIFIED 15:41Z |
| Backups | PITR off, delete protection off on prod `(default)` | LIVE VERIFIED 15:41Z |
| Staging | serves RC 25e273e6 (build-2026-10-31-004) via `deploy/staging`; deployment-alignment gate closed by owner 16:47Z | LIVE VERIFIED 16:45Z |
| Prod data | `(default)` was empty at the 10-30 count | OWNER REPORTED / earlier readback; `01` re-counts |

Why promote at all (ChatGPT architecture review 2026-10-31): prod 29171a6 still falls back to localStorage when Firestore fails, lacks the server-authoritative routes, and leaves W9/W11 open. Only promotion plus Option B fixes that.

## 2. Pin the release candidate (entry criteria)

Set one value and use it everywhere: `$ReleaseSha = '<full 40-char RC commit>'`.

The pinned SHA must satisfy **all** of these. `01-readonly-prechecks.ps1 -ReleaseSha <sha>` checks the machine-checkable ones (marked ✓auto).

| # | Criterion | Today (25e273e6) |
|---|---|---|
| E1 | Commit is on `release/rc-2026-10-08` (RC head or ancestor) ✓auto | yes |
| E2 | Every GitHub check run on the SHA completed `success` (verify, dispatcher, promote-staging) ✓auto | yes (run 41219911300) |
| E3 | `apphosting.prod.yaml` **and** `apphosting.production.yaml` set `PUBLIC_APP_URL=https://guardentra.com` ✓auto | **NO**: needs the yaml part of #239 merged into the RC first |
| E4 | `firestore.rules` LF sha == `f53bd980…` (so Option B still equals it) ✓auto | yes |
| E5 | `firestore.indexes.json` LF sha == `f2d695c0…` (the `-Set rc` file in #239) ✓auto | yes |
| E6 | `storage.rules` LF sha == `c9629c78…` (== live prod Storage) ✓auto | yes |
| E7 | No scanner/email/reminder switch is enabled in the prod yaml (`EVIDENCE_SCANNER_ENABLED`, `MAIL_WORKER_ENABLED`, `ASSESSMENT_REMINDER_WORKER_ENABLED`, `AUDIT_SPINE_ENABLED=true`) ✓auto | yes |
| E8 | Staging `/api/health` `sourceSha` == the SHA ✓auto | yes, until the next RC merge |
| E9 | The full #124 journey has been re-run on staging **on this exact SHA**, including the #236 retest (sign-up bootstrap, DRAFT decision packet). 16/16 or each non-pass owner-accepted | **NO**: pending "retest staging" |
| E10 | Owner has decided what else goes in: #241 (P2 journey fixes; open riskScore question), #242 (lockfile dep fixes). Each one merged changes the SHA and restarts E1-E9 | open |
| E11 | ChatGPT release-integrity review of the SHA recorded (operating agreement: ChatGPT owns release integrity) | open |
| E12 | Owner decision on `main`: deploy the RC SHA directly (recommended, exact-SHA evidence) and bring `main` tree-equal afterwards (ChatGPT-owned main merge), or merge first so `main` == SHA. Prod rollouts are disabled, so a merge to `main` alone deploys nothing | open |

Freeze: once pinned, merges to the RC may continue (staging moves on), but the prod rollout uses the pinned SHA only. If staging stops serving the pinned SHA before the rollout, that is fine as long as E8 was recorded at pin time.

## 3. Pre-checks (run `01-readonly-prechecks.ps1 -ReleaseSha <sha>`)

| ID | Check | Pass condition | If it fails |
|---|---|---|---|
| P1 | Prod rollback baseline | traffic 100% `build-2026-08-27-001`, build READY, source hash starts `29171a6`, rollouts disabled; build image still present in Artifact Registry | **Stop.** Without the old image, rollback means a rebuild of 29171a6, and that commit has only `apphosting.yaml`, so a rebuild would ship a blank /login exactly like legacy (VITE_* missing). Fix the rollback path first |
| P2 | Prod Firestore rules | `cloud.firestore` == `2a30bd60…`, live text sha LF `a0645160…` | Stop; something changed since 09:03Z |
| P3 | Indexes | all 8 RC indexes exist on prod `(default)` and are READY | **GATE G1**: `ops/env-fixes/01-create-indexes.ps1 -Project guardentra-prod -Set running`, then `-Set rc` (#239). Wait for READY, re-run `01` |
| P4 | Secrets the build resolves | `VITE_FIREBASE_API_KEY`, `GEMINI_API_KEY`, `AUDIT_DATABASE_URL` each have >=1 ENABLED version; the backend service account can access them (secret or project IAM) | Build would fail. Grant is an IAM change: owner go. Values are never read |
| P5 | Storage rules | prod `firebase.storage` ruleset text sha LF == `c9629c78…` == pinned `storage.rules` | Stop and diff |
| P6 | PUBLIC_APP_URL / config | E3 + E7 above; backend Environment name == `prod` (so `apphosting.prod.yaml` applies) | Fix in the repo first (new SHA) |
| P7 | Auth | email/password on, anonymous off. Report authorized domains | If `guardentra.com` is missing, Google popup sign-in from guardentra.com will fail (it may already fail today). Smoke uses email/password. Adding the domain is a config change: **GATE G2**, optional |
| P8 | Email/scanner stay off | no Trigger Email extension instance on prod; no scanner secret/vars | If an extension exists, stop: smoke mail docs would really send |
| P9 | Data baseline | counts of `organizations`, `users`, `vendors`, `assessments`, `mail` in prod `(default)` | If real tenants exist, the rollback data-compat note in 5.4 applies and the owner should confirm the window |
| P10 | Backups | report PITR / delete protection | Recommended **GATE G3** before promotion: turn on delete protection (free) and PITR or a one-off export (commands in `ops/env-fixes/README.md` §4) |
| P11 | Domains | guardentra.com and www attached to prod backend; health of guardentra.com reachable | Known stale attachment on legacy (D1) is not a blocker; do not touch it here |
| P12 | Staging and repo | E1, E2, E4-E8 | Re-pin |

Paste the `01` output into the release issue as SOURCE/LIVE VERIFIED evidence before asking for G4.

## 4. Promotion (owner-run)

**GATE G4: "promote <sha> to guardentra-prod".** One window, owner at the keyboard, ~30-60 min. Have `03-ROLLBACK-app.ps1` open in a second PowerShell window.

1. Re-run `01-readonly-prechecks.ps1 -ReleaseSha $ReleaseSha`. All PASS (P7/P10 may be WARN if the owner accepted them).
2. Check the CLI flag names on your installed version (they have changed between releases):
   ```powershell
   npx firebase-tools apphosting:rollouts:create --help
   ```
3. Start the rollout from the exact commit. This builds the SHA with the backend's `prod` environment and shifts traffic when the build succeeds:
   ```powershell
   npx firebase-tools apphosting:rollouts:create guardentra-prod --project guardentra-prod --git_commit $ReleaseSha
   ```
   - If your version names the flag differently (`--git-commit`), use that; never use `--git_branch main` here, because `main` is not the pinned SHA.
   - Console alternative: Firebase console > guardentra-prod > App Hosting > `guardentra-prod` > Rollouts > Create rollout, and pick the exact commit.
   - Do not change the backend's live branch or turn on automatic rollouts.
4. Wait for the build to finish (5-10 min). If the build FAILS, prod keeps serving 29171a6: nothing to roll back. Record the error (often a secret access or yaml issue: P4/P6).
5. Run `02-readonly-post-promotion.ps1 -ReleaseSha $ReleaseSha`. Pass conditions:
   - traffic 100% on the new build, build source hash == SHA;
   - `https://guardentra.com/api/health` and the hosted.app URL return `release.environment=production`, `projectId=guardentra-prod`, `sourceSha == SHA`;
   - JS bundle contains only `projectId:"guardentra-prod"` (no `guardentra-staging`, no `guardentra-7f582`): tenant/environment isolation;
   - security headers present (HSTS, nosniff, X-Frame-Options, CSP), no `X-Powered-By`; `/.well-known/security.txt` is text/plain with `Canonical: https://guardentra.com/.well-known/security.txt`;
   - CORS: `Origin: https://evil.example` is not echoed; `Origin: https://guardentra.com` is;
   - Firestore rules still `2a30bd60…` (Option A). Label: **PROD DEPLOYED**.
6. Run smoke Phase A (section 5) under Option A.
7. **GATE G5: "release Option B on guardentra-prod".** Only after Phase A passes. `04-DEPLOY-option-b.ps1 -ReleaseSha $ReleaseSha` refuses unless prod `/api/health` reports that SHA (Option B breaks 29171a6).
8. Run smoke Phase B (section 5).
9. Clean up (section 5.3), fill `EVIDENCE.md`, post it on the release issue. Label: **PROD LIVE VERIFIED (release acceptance, email + scanner deferred)**. This is not "GO LIVE": #72 and #73 production steps are still open.

Rollback triggers at any point: any `02` FAIL on identity/isolation, sign-in broken, any smoke step FAIL that loses or corrupts data, 5xx on `/api/*` sustained > 5 min, or the owner's call. Section 6.

## 5. Production smoke (mirrors #124, email and scanner deferred)

Rules: synthetic data only, real guardentra.com URL, owner's normal Chrome (or the headless Playwright setup on the PC). Identities generated at run time, passwords only in a local file on the PC:
- org admin `admin+e2eprod-<yyyymmdd>@guardentra.com`, org name `SYNTHETIC PROD SMOKE <date>`
- vendor contact `admin+e2eprodvendor-<yyyymmdd>@guardentra.com`, vendor `SYNTHETIC PROD SMOKE Vendor`

Record the uid/org/vendor/assessment ids as you go (needed for cleanup).

### 5.1 Phase A (Option A rules live)

| # | #124 step | Prod action | Pass condition |
|---|---|---|---|
| A1 | tenant_bootstrap | Sign up with email/password | exactly 1 org, `users/{uid}` role admin, typed name kept (not "New User"), no permission-denied in console (#236 fix) |
| A2 | vendor_create | Invite Vendor | `POST /api/org/vendor-create` 200, vendor doc |
| A3 | assessment_create | Build + send assessment (NIST CSF 2.0 or SOC 2) | `POST /api/org/assessment-create` 200, pack ids + question-bank version stamped |
| A4 | invitation_queue | (same send) | `POST /api/notify/mail` 200; `mail/notify_assessment_invite_<asm>` exists, its text link starts `https://guardentra.com/portal/` (proves PUBLIC_APP_URL). Delivery state stays empty: **QUEUED only, no consumer on prod (expected)** |
| A5 | provider_acceptance | none | **DEFERRED** (email planning-only) |
| A6 | inbox_receipt | none | **DEFERRED** |
| A7 | portal_open | Open the portal link copied from the mail doc in a private window | `/api/portal/session` 200, portal loads |
| A8 | answers_persist_reload | Answer, hard reload | answers + notes persist |
| A9 | evidence upload (scanner off) | Upload a generated one-line PDF | stays `scan_pending` (fail closed); vendor download not allowed. **Scanner DEFERRED**. Do not upload EICAR on prod |
| A10 | eicar_quarantine | none | **DEFERRED** (scanner planning-only) |
| A11 | assessment_submit | Submit | `POST /api/portal/submit` 200, status Under Review |
| A12 | decision | Try Approve (expect blocked: untrusted evidence), then Remediate with residual risk, owner, due date | blocked, then `POST /api/org/assessment-decision` 200, stored once, decided view read-only |
| A13 | decision_packet_export | Download decision PDF before and after the decision | before: DRAFT, "no decision recorded"; after: recorded outcome; no "Popup blocked" |
| A14 | audit_chain_verify | Settings > Audit spine | shows spine disabled (prod `AUDIT_SPINE_ENABLED=false`): **DEFERRED** (prod audit DB not provisioned/verified) |
| A15 | relogin_persistence | Sign out, sign in, reload /assessments + dashboard | same state, no false success, no localStorage-only data |
| A16 | health | `/api/health` | 200, sourceSha == SHA |
| A17 | isolation (prod only) | Sign in to prod with a **staging** test account | fails (account does not exist in guardentra-prod) |

Any FAIL in A1-A3, A7, A8, A11, A12, A15-A17 stops the run: decide fix-forward vs rollback (section 6).

### 5.2 Phase B (after G5, Option B live)

Re-run A2, A3, A4, A7, A8, A11, A12, A15 with a second synthetic vendor. All must pass (they pass on staging under the same rules text). Optional negative check: with the smoke admin's ID token, a direct Firestore REST create of a `vendors` doc must return 403 (W1 closed). Shape: `ops/rules-staging/05-rules-api-security-tests.ps1` (point it at guardentra-prod only after reading it).

Any FAIL: run `05-ROLLBACK-option-b.ps1` (back to Option A, still compatible with the RC) and keep the app.

### 5.3 Cleanup

Delete the synthetic org, users (Auth + `users/{uid}`), vendors, assessments, responses, evidence objects under `portal/<asm>/`, and the `mail/notify_*` docs created by the smoke (they must not be sent if an email consumer is ever installed on prod). Dry-run list first, then delete, then re-read. Audit events are kept. Deleting prod data is a change: the owner runs it, or approves the exact list first.

### 5.4 Rollback data note

The RC writes server-authoritative shapes that 29171a6 never wrote (for example `audit_material_intents`, triage fields). With synthetic data only, a rollback is clean once 5.3 is done. If real tenants sign up after promotion, rolling back means they meet the old client (with its localStorage fallback) against data it did not write: prefer fix-forward, and decide with ChatGPT before rolling back.

## 6. Rollback to 29171a6 + Option A

Order matters: **rules first, then app**. Option A works for both clients; Option B breaks 29171a6.

1. If Option B is live: `05-ROLLBACK-option-b.ps1` -> `cloud.firestore` = `2a30bd60-c037-45e5-ae47-6ab164e2e881`, read back sha `a0645160…`. (~1 min)
2. App: `03-ROLLBACK-app.ps1`. It refuses while Option B is live, checks `build-2026-08-27-001` (29171a6) is READY, validates the rollout (`validateOnly`), asks you to type `guardentra-prod`, creates a rollout of **the existing build** (no rebuild), waits, and reads back. (~3-5 min)
   - Console alternative: App Hosting > guardentra-prod > Rollouts > the 2026-08-27 rollout > Roll back.
   - **Never** "roll back" by building 29171a6 again from git: its repo has only `apphosting.yaml`, so a fresh build loses the VITE_* identifiers the old build got from backend config (blank /login, as on legacy).
3. Read back: `/api/health` returns the old shape (no `release` block), bundle `index-BU4Du5f7.js`, traffic 100% `build-2026-08-27-001`.
4. Leave the new indexes in place (additive, harmless, and 29171a6 needs 4 of them anyway). `PUBLIC_APP_URL` is ignored by 29171a6.
5. Clean up synthetic data (5.3). Record what happened on the release issue.

Rollback targets, for the record: app `build-2026-08-27-001` @ 29171a6; Firestore `2a30bd60-c037-45e5-ae47-6ab164e2e881` (Option A). Do **not** go back further to `2e9c308d…` (pre-emergency rules) unless the owner says so; that reopens the P0.

## 7. Gates summary

| Gate | What | Who runs | Undo |
|---|---|---|---|
| G1 | Create prod indexes (`running`, then `rc`) | owner, #239 script | `02-rollback-indexes.ps1` |
| G2 | (optional) add guardentra.com + hosted.app to prod authorized domains | owner, console | remove the domain |
| G3 | (recommended) prod delete protection + PITR or one-off export | owner, gcloud | `--no-delete-protection` / `--no-enable-pitr` |
| G4 | Roll out pinned SHA to guardentra-prod | owner, CLI/console | `03-ROLLBACK-app.ps1` |
| G5 | Release Option B on guardentra-prod | owner, `04` | `05-ROLLBACK-option-b.ps1` |
| G6 | Delete smoke data | owner | n/a (synthetic) |

Prerequisites not in this folder: #239 yaml merged into the RC (E3), staging re-run of #124 on the pinned SHA (E9), owner decisions E10/E12, ChatGPT review E11.

## 8. Not covered (stay planning-only or separate)

- Prod email (#72): no Trigger Email/SendGrid on prod; invites queue only. Separate mail-queue DB and reconcile script are prerequisites (ops/72-prod-email/plan.md).
- Prod scanner (#73): infra only after cost/IAM/network/rollback review (ops/73-prod-scanner/plan.md). Until then uploads stay `scan_pending` and decisions cannot approve with untrusted evidence.
- Prod audit spine (#74): `AUDIT_SPINE_ENABLED=false` on prod; the secret's value and a prod audit DB are unverified.
- Legacy (`guardentra-7f582`): untouched. Stale guardentra.com attachment (D1) is a separate decision.
- Self sign-up open and MFA off on prod: product decision, not a promotion blocker.
