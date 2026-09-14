# GuardEntra Project State

Current verified snapshot: 2026-09-15
Repository: `akurteshi-guardentra/guardentra`
Owner and merge/deployment authority: `@akurteshi-guardentra`

This is a navigation ledger, not independent proof. Verify claims using the issue, PR, commit, CI, or live platform evidence defined in `docs/agent-ops/SOURCE_OF_TRUTH.md`. Update it through a PR after a material verified transition.

Management hierarchy: `docs/agent-ops/AGENTIC_MANAGEMENT_MODEL.md` (L0 Owner → L1 Chief Dispatcher → L2 Managers → L3 Leads → L4 Execution → L5 Assurance). Hierarchy does not grant AI merge/deploy authority.

## State vocabulary

| State | Meaning |
|---|---|
| `CLAIMED` | Reported but not reconciled |
| `VERIFIED` | Supported by the authoritative source |
| `COMMITTED` | Present in a named branch commit |
| `PR READY` | Pushed and represented by an open PR |
| `MERGED` | Present in protected `main` history |
| `DEPLOYED` | Released to a named environment with an identifier |
| `LIVE VERIFIED` | Deployed behavior checked in the target runtime |
| `BLOCKED` | Waiting on a named dependency/decision |

## Repository state

| Item | Verified state |
|---|---|
| Default branch/current commit | `main` at `a322f96146976a98a2b2ee800fdac7cce1af0380` (merge of PR #52; repository tip) |
| Latest merged product/governance work | Prior: PR #24/#35/#38/#39/#40/#43/#44/#45/#46/#47. **PR #50 MERGED** (`de6ae269814b53250daf9a4ffb955d8788a02b17`) — coherent Firebase client / env-specific App Hosting config fix in repository history. **PR #52 MERGED** (authoritative evidence malware scanner + durable Cloud Tasks delivery) — feature tip `39fde456312586b1fff36a9cd68c13656ca6fa39`; merge commit `a322f96146976a98a2b2ee800fdac7cce1af0380`; post-merge CI run **#170** / `34902620059` **SUCCESS**. |
| Active governance work | Issue #33 remains the governance umbrella. Issue #53 / Action #9A: agentic management baseline + post-P0 ledger reconciliation (docs). Production application release SHA remains separate from repository tip (see production section). |
| P0 Firebase client environment isolation | **PR #50 MERGED** at `de6ae269814b53250daf9a4ffb955d8788a02b17`. Repository fix present. Staging App Hosting yaml includes persisted Admin/project and coherent `VITE_FIREBASE_*` config; that baseline was subsequently included in the **#8H-D** staging release of tip `39fde45…`. Dedicated post-PR-50 onboarding regression E2E: **UNVERIFIED**. |
| P0 authoritative evidence scanner | **CLOSED** as a workstream. Code **MERGED** into `main`. **Staging: LIVE VERIFIED** (`cloud_tasks`). **Production: NOT DEPLOYED** (no scanner production deployment authorized). |
| P0-2 investigation | Issue #11 closed: Option B trust states. Scanner workstream completed via PR #52 (environment-specific deployment status below). |
| P0-2 implementation | Issue #37 is **CLOSED / COMPLETED**. PR #44 merged and previously live-verified on `guardentra-7f582`; PR #43 ledger close-out merged. |
| Framework inventory | Issue #25 is **CLOSED / COMPLETED**. PR #45 merged docs-only inventory: 54 controlKeys, 8 packs, 3 mapping subsystems, 112 claim rows; rights/provenance remain `unknown` or escalated unless stronger owner/publisher/counsel evidence is attached. |
| Framework claims / safe wording | Issue #26 is **CLOSED / COMPLETED**. PR #47 merged at `a213981ae6f9e252fa5880f4f2a19b3d31663ca4`. Product wording uses GuardEntra-authored assessment packs aligned to selected security domains; **no claim** of official certification, partnership, or publisher endorsement where unsupported. Disposition matrix: `docs/compliance/FRAMEWORK_CLAIM_DISPOSITION.md`. |
| P0-2 rejected PR | PR #36: **closed unmerged**; branch `fix/p0-2-evidence-before-scan` retained |
| Stale PR requiring disposition | PR #7; do not merge without rebase and scope review |

## Environment architecture (target vs live)

| Branch (Git) | Intended Firebase project | Live status |
|---|---|---|
| `dev` | `guardentra-dev` | **Not verified / not provisioned** |
| `test` | `guardentra-staging` | **LIVE VERIFIED** — see staging section |
| `main` | `guardentra-prod` | **LIVE VERIFIED** — public domain cutover **COMPLETE**; see production section |

Production public domain is **`guardentra-prod`**: apex `https://guardentra.com` cutover is **COMPLETE**; `www` canonical **301** redirect is **COMPLETE**; SSL/ownership are **ACTIVE**. DNS and custom-domain resources must **remain unchanged**. Legacy project `guardentra-7f582` is retained **only for rollback** — it is not the live production domain.

## Live runtime state — legacy rollback (`guardentra-7f582`)

| Layer | Live state | Reconciliation |
|---|---|---|
| Role | **Rollback / historical only** | Not the live production domain after cutover |
| Public domain | **Does not serve** `guardentra.com` | Apex + www traffic is on `guardentra-prod` |
| App Hosting | backend `guardentra`, `us-central1` | Retained for rollback; do not modify without separate owner authorization |
| Firestore rules | `(default)` release `cloud.firestore` → `projects/guardentra-7f582/rulesets/c12a5117-1675-4775-b25b-ca463b36e7dc` | Historical; unchanged by staging work |
| Storage rules | `firebase.storage/guardentra-7f582.firebasestorage.app` → `projects/guardentra-7f582/rulesets/7bf9df8c-474f-4100-b5cc-77d019d7b2a9` | Historical; unchanged by staging work |
| P0-1 outcome (historical) | Previously **DEPLOYED; BUNDLE VERIFIED** on this project | Production traffic now on `guardentra-prod` |
| Audit spine | Not enabled on this runtime | Staging also runs with `AUDIT_SPINE_ENABLED=false` |

## Live runtime state — staging (`guardentra-staging`)

| Layer | Live state | Reconciliation |
|---|---|---|
| Firebase project | `guardentra-staging` (project number `965959469996`) | Established and owner-accessible; billing linked |
| App Hosting | backend `guardentra-staging`, `us-central1` | Exact-SHA rollout of scanner tip: build `build-2026-09-14-001` **READY**; rollout `rollout-2026-09-14-001` **SUCCEEDED**; traffic **100%** on revision `guardentra-staging-build-2026-09-14-001` |
| Deployed source SHA | `39fde456312586b1fff36a9cd68c13656ca6fa39` | Matches PR #52 feature tip (pre-merge deploy; later merge commit `a322f96…` is repository tip) |
| Staging URL | `https://guardentra-staging--guardentra-staging.us-central1.hosted.app` | Homepage **200**; `/api/health` **200** |
| Runtime | `google-22` / Node.js (`nodejs_20260901_RC00`) | Compatible with `@google-cloud/tasks` Node ≥22 requirement |
| Authoritative evidence scanner | **LIVE VERIFIED** | `EVIDENCE_SCANNER_ENABLED=true`; delivery **`cloud_tasks`**; ClamAV `10.128.0.2:3310` **REACHABLE**; secret ref **PRESENT/REFERENCED** (value never logged) |
| Cloud Tasks | queue `evidence-malware-scan` / `us-central1` / **RUNNING** | Task OIDC SA `evidence-scan-task@guardentra-staging.iam.gserviceaccount.com`; **no user-managed service-account key created during #8H-C/#8H-D** (not a complete SA key inventory); durability **LIVE VERIFIED** (queue pause → `scan_pending` + task exists → resume → terminal) |
| Durable proof (#8H-E) | **PASS** | Clean → `clean` / clamav / clean; EICAR → `quarantined` / clamav / infected (`Eicar-Test-Signature`); generation binding **PASS**; idempotent deterministic task id **PASS**. Informational: live G1 stale task dispatch was not directly observed via `describe`; automated `stale_generation` ACK remains PASS |
| Firestore rules | `projects/guardentra-staging/releases/cloud.firestore` → `projects/guardentra-staging/rulesets/ca5b4258-18e2-4d79-880b-b1a4e9129585` | Emulator rules tests **PASS**; live unauthenticated/anonymous denial checks **PASS** (historical matrix) |
| Storage rules | `projects/guardentra-staging/releases/firebase.storage/guardentra-staging.firebasestorage.app` → `projects/guardentra-staging/rulesets/6a4560f0-deac-4dd7-be16-a274e4bb8b56` | Emulator **19/19 PASS**; live unauthenticated/anonymous denial checks **PASS** |
| Staging portal E2E (historical) | **LIVE VERIFIED — PASS** (2026-08-21) | Mode **`[mode: scoped-token]`**. Synthetic fixtures deleted. Superseded for scanner path by #8G/#8H-E proofs |

### Final staging portal E2E (verified behavior)

| Check | Result |
|---|---|
| Authenticated org login (staging Firebase Auth / client project) | **PASS** |
| Portal token mint | **PASS** |
| Scoped-token mode (`portalAssessmentId` claim) | **PASS** |
| Assessment A access | **PASS** |
| Assessment B isolation | **PASS** |
| Firestore cross-assessment denial (read/write) | **PASS** |
| Storage cross-assessment denial | **PASS** |
| Correctly scoped Assessment A Storage operation | **PASS** |
| Submission | **PASS** |
| Post-submit lock | **PASS** |
| Invalid/missing assessment fail-closed | **PASS** (HTTP 500 on missing assessment at time of final verification) |

Resolution note: later staging runtime env/traffic fixes (`GCLOUD_PROJECT`, Storage rules agent Firestore viewer IAM) resolved the earlier portal-session **500**. **Repository config:** `apphosting.staging.yaml` now persists `GCLOUD_PROJECT=guardentra-staging`, `GOOGLE_CLOUD_PROJECT=guardentra-staging`, `FIREBASE_STORAGE_BUCKET=guardentra-staging.firebasestorage.app`, and coherent staging `VITE_FIREBASE_*` settings. **#8H-D staging rollout** deployed exact PR #52 feature tip `39fde45…` (includes that staging config baseline). **Dedicated post-PR-50 onboarding regression E2E:** **UNVERIFIED** unless separately evidenced — do not claim it from config presence or scanner deploy alone.

## Live runtime state — production (`guardentra-prod`)

**Production application release SHA:** `29171a64078e3943149dccf63d8caa7650ad0125`. This is the deployed application SHA.

Documentation-only repository commits may advance `main` without changing the deployed production application while automatic production rollouts remain **DISABLED**.

| Layer | Live state | Reconciliation |
|---|---|---|
| Firebase project | `guardentra-prod` (project number `191663365586`) | **Provisioned** and owner-accessible; billing linked; org `280975227603` |
| App Hosting | backend `guardentra-prod`, `us-central1`, GitHub `main` | Deployed application SHA `29171a64078e3943149dccf63d8caa7650ad0125`; build `build-2026-08-27-001` **READY**; rollout **SUCCEEDED** at **100%**; Cloud Run revision `guardentra-prod-build-2026-08-27-001` |
| Automatic rollouts | **DISABLED** (`codebaseBranch=main`) | Manual first rollout only; auto-roll remains off |
| Production hosted URL | `https://guardentra-prod--guardentra-prod.us-central1.hosted.app` | Homepage **200**; `/api/health` **200** |
| Custom domain | `guardentra.com` (apex) + `www` → apex **301** | Cutover **COMPLETE**; SSL/ownership **ACTIVE**; DNS must remain unchanged |
| Runtime env | `APP_ENV=production`; `GCLOUD_PROJECT=guardentra-prod`; `GOOGLE_CLOUD_PROJECT=guardentra-prod`; `FIREBASE_STORAGE_BUCKET=guardentra-prod.firebasestorage.app`; `AUDIT_SPINE_ENABLED=false` | Set via App Hosting `overrideEnv` (no spine / no Cloud SQL) |
| Auth providers | Email/password **ENABLED**; Google **ENABLED**; Anonymous **DISABLED** | Portal uses scoped custom tokens (`portalAssessmentId`), not anonymous |
| Firestore rules | `projects/guardentra-prod/releases/cloud.firestore` → `projects/guardentra-prod/rulesets/2e9c308d-9889-4b16-8d55-63b4c77e5ce4` | Deployed 2026-08-27 from approved SHA rules |
| Storage rules | `projects/guardentra-prod/releases/firebase.storage/guardentra-prod.firebasestorage.app` → `projects/guardentra-prod/rulesets/76913163-f67e-44d6-b262-6362447d8726` | Deployed 2026-08-27; Storage SA granted `roles/datastore.viewer` for `firestore.get()` |
| Portal security gate | **LIVE VERIFIED — PASS** | Mode **`[mode: scoped-token]`**; A→A read/write **PASS**; A→B isolation **PASS**; submit/lock **PASS**; Storage A→A **PASS** / A→B **DENIED**; unauthenticated denials **PASS**; synthetic fixtures deleted |
| Malware scanner | **NOT DEPLOYED** on production | Scanner code is **MERGED** on `main` (PR #52) but **not** rolled out to `guardentra-prod`. Production remains MIME/size trust path until a separate owner-authorized production scanner deploy. Do not fabricate `clean` on production. Do not describe production as scanner-enabled. |

### Production portal E2E (verified 2026-08-27)

| Check | Result |
|---|---|
| Scoped-token mint (`portalAssessmentId`) | **PASS** |
| Mode | **`scoped-token`** (anonymous disabled / not used) |
| A→A Firestore read/write | **PASS** |
| A→B Firestore read/write | **PASS** (denied) |
| Submit + lock | **PASS** |
| Storage A→A / A→B / unauth / invalid path | **PASS** |
| Synthetic fixture cleanup | **PASS** (assessments/orgs + portal object deleted) |
| Synthetic Auth cleanup | **PENDING** (owner-authorized deletion in progress) |
| Synthetic gate users remaining | verify after cleanup |

**Domain cutover:** **COMPLETE.** Production domain is `guardentra-prod`. Apex cutover, `www` canonical 301, and SSL/ownership are active. **Do not modify production DNS, custom-domain resources, or legacy rollback resources without separate owner authorization.** No new domain cutover is pending.

Ledger updates in this PR remain documentation of verified state. They do **not** authorize DNS edits, domain remapping, or production deploys.

## Delivery position

| Track | Issues | Current position | Next gate |
|---|---|---|---|
| P0-1 vendor lock | #10, PRs #23/#24 | Code/rules/application deployed on `guardentra-7f582`; bundle markers live verified | Safely record production end-to-end submission evidence |
| P0-2 scan/review | #11 and #37 closed/completed; **PR #52 MERGED** | Code on `main`. **Staging scanner LIVE VERIFIED** (`cloud_tasks`, revision `guardentra-staging-build-2026-09-14-001`). **Production scanner NOT DEPLOYED**. | Separate owner authorization required for any production scanner infrastructure/config/deploy |
| Framework inventory | #25 | **COMPLETED / MERGED** via PR #45 | Preserve inventory as source evidence |
| Framework claims / safe wording | #26 | **COMPLETED / MERGED** via PR #47 | Hardening (#27–#28) not ready |
| Framework hardening | #27–#28 | Not ready | Requires approved design |
| Framework engine | #29–#31 | Not ready | Requires hardening and OSCAL-first authorization |
| Licensed adapters | #32 | Blocked | Requires executed permission and technical gates |
| Security spine | #12–#17 | Planned | Continue in dependency order after P0 gates |
| Staging verification | Infrastructure + portal E2E + scanner | **LIVE VERIFIED** on `guardentra-staging` (`cloud_tasks`; revision `guardentra-staging-build-2026-09-14-001`) | Keep production scanner **NOT DEPLOYED** until separately authorized; dedicated post-PR-50 onboarding regression remains **UNVERIFIED** |
| Production (`guardentra-prod`) | App + rules + scoped portal E2E + public domain | **LIVE VERIFIED**; domain cutover **COMPLETE** (deployed application SHA `29171a6…` / `build-2026-08-27-001`) | Synthetic Auth cleanup (owner-authorized); keep DNS/domain/rollback resources unchanged |

## Current blockers and risks

1. Production domain cutover is **complete**. Do not modify production DNS, custom-domain resources, or legacy rollback resources without separate owner authorization.
2. Dev project `guardentra-dev` may still be absent / not verified.
3. Production end-to-end customer submission evidence on the public domain is not fully recorded as a separate gate (prod portal security gate **PASS**; domain cutover **COMPLETE**).
4. PR #7 is stale.
5. Framework rights/provenance remain `unknown` or escalated for inventoried claim rows unless owner/publisher/counsel evidence is attached; product wording must stay conservative.
6. **Production malware scanner is NOT DEPLOYED.** Staging is LIVE VERIFIED. Authoritative `clean` on production still requires a separate owner-authorized scanner rollout; do not fabricate `clean` from MIME/size alone.
7. Staging Admin/project env is **persisted** in `apphosting.staging.yaml` and was part of the #8H-D staging release baseline. Dedicated post-PR-50 onboarding regression E2E remains **UNVERIFIED**.
8. Residual synthetic Auth user on `guardentra-prod`: `gate-noclaim-*@guardentra-test.invalid` — owner authorized deletion 2026-09-01; verify count **0** after cleanup completes.
9. **P0 Firebase client environment isolation:** repository fix **MERGED** via PR #50 (`de6ae269814b53250daf9a4ffb955d8788a02b17`). Do not equate merge or staging scanner deploy with a dedicated onboarding E2E proof.
10. **Local shell hygiene:** staging `GCLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT` leftover in a developer shell can contaminate Vitest region-router expectations. Clear overrides before local verification (see `docs/agent-ops/TOOLCHAIN.md`).

**Removed stale blockers:** permanent production project absent; public-domain cutover pending; global “no malware scanner exists” (replaced by environment-specific staging LIVE / production NOT DEPLOYED).

## Next authorized actions

1. Complete Issue #53 / Action #9A docs PR when owner authorizes commit/PR/merge (**docs only**; no deploy).
2. Separate owner command required for any **production** scanner infrastructure, App Hosting scanner enablement, or production deploy.
3. Production domain cutover is complete. Do not modify production DNS, custom-domain resources, or legacy rollback resources without separate owner authorization.
4. Do not merge PR #36. Do not delete `fix/p0-2-evidence-before-scan`. Do not reopen PR #39.
5. Do not install Agency Agents until separately authorized.

## Daily reporting

`GuardEntra Daily Brief` runs daily at 22:30 `Europe/Vienna`. It must separate repository and live state and must not mutate GitHub or deploy.
