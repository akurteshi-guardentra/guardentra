# GuardEntra Project State

Current verified snapshot: 2026-09-08
Repository: `akurteshi-guardentra/guardentra`
Owner and merge/deployment authority: `@akurteshi-guardentra`

This is a navigation ledger, not independent proof. Verify claims using the issue, PR, commit, CI, or live platform evidence defined in `SOURCE_OF_TRUTH.md`. Update it through a PR after a material verified transition.

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
| Default branch/current commit | `main` at `29171a64078e3943149dccf63d8caa7650ad0125` (repository; see production application release SHA below) |
| Latest merged product/governance work | PR #24 P0-1; PR #35 live probe; PR #38 P0-2 investigation ledger; PR #39 rejected-head merge `85f718de43b19fa9a8d10312d726d2bf0899aaeb`; PR #40 squash-merged `8ea4b24e1a15b03e518de8d928d56d7491bc8599`; PR #44 squash-merged `d233eaa09fa7cd0b0c9f5a4518ae2850f7d34eb9`; PR #43 squash-merged `0f07657620d853cd9228ed58cf29b7d7e9960b73`; PR #45 squash-merged `f0f085d701340747963ef28e46ecd92eb9baf579`; PR #47 squash-merged `a213981ae6f9e252fa5880f4f2a19b3d31663ca4`; **PR #46 squash/merged** into `29171a64078e3943149dccf63d8caa7650ad0125` |
| Active governance work | Issue #33 project-state/tool-routing protocol remains the governance umbrella. PR #43 and PR #46 are **MERGED**. Production application/rules live on `guardentra-prod`; public domain cutover is **COMPLETE** (see production section). Open product work: PR #50 P0 Firebase environment isolation (**NOT DEPLOYED**). |
| P0-2 investigation | Issue #11 closed: confirmed defect investigated and recovery implemented under Option B. **No malware scanner exists**; authoritative `clean` still requires a future scanner workstream. |
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
| App Hosting | backend `guardentra-staging`, `us-central1`, branch `test` | Release commit `a213981ae6f9e252fa5880f4f2a19b3d31663ca4`; build `build-2026-08-21-002` **READY**; rollout `rollout-2026-08-21-001` **SUCCEEDED** at **100%** |
| Staging URL | `https://guardentra-staging--guardentra-staging.us-central1.hosted.app` | Homepage **200**; `/api/health` **200** |
| Active Cloud Run revision | `guardentra-staging-00002-lrg` at **100%** traffic | Runtime env includes `GCLOUD_PROJECT=guardentra-staging`, `FIREBASE_STORAGE_BUCKET=guardentra-staging.firebasestorage.app`, `AUDIT_SPINE_ENABLED=false`, `APP_ENV=production` (shared `apphosting.yaml` semantics) |
| Firestore rules | `projects/guardentra-staging/releases/cloud.firestore` → `projects/guardentra-staging/rulesets/ca5b4258-18e2-4d79-880b-b1a4e9129585` | Emulator **42/42 PASS**; live unauthenticated/anonymous denial checks **PASS** |
| Storage rules | `projects/guardentra-staging/releases/firebase.storage/guardentra-staging.firebasestorage.app` → `projects/guardentra-staging/rulesets/6a4560f0-deac-4dd7-be16-a274e4bb8b56` | Emulator **19/19 PASS**; live unauthenticated/anonymous denial checks **PASS** |
| Git `test` branch | `a213981ae6f9e252fa5880f4f2a19b3d31663ca4` | Matches `main` at release candidate |
| Staging portal E2E | **LIVE VERIFIED — PASS** | Final gate 2026-08-21 against staging Firebase client config and `PORTAL_API_BASE` above. Mode: **`[mode: scoped-token]`** — no anonymous fallback counted as pass. Synthetic fixtures tagged `STAGING_PORTAL_E2E` / `stagingTest`; **deleted after verification**. Earlier portal-session HTTP **500** during troubleshooting is **SUPERSEDED** (see transitions). |

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

Resolution note: later staging runtime env/traffic fixes (`GCLOUD_PROJECT`, Storage rules agent Firestore viewer IAM, traffic to revision `guardentra-staging-00002-lrg`) resolved the earlier portal-session **500**. Persist these env vars in App Hosting config before the next staging rollout so portal mint does not regress.

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
| Malware scanner | **NOT IMPLEMENTED** | MIME/size/type validation is **not** malware scanning; do not fabricate `clean` |

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
| P0-2 scan/review | #11 and #37 closed/completed | PR #44 merged/deployed on `guardentra-7f582`; live matrix PASS; PR #43 ledger close-out merged. **No malware scanner exists.** | Future scanner workstream if authorized; do not fabricate `clean` |
| Framework inventory | #25 | **COMPLETED / MERGED** via PR #45 | Preserve inventory as source evidence |
| Framework claims / safe wording | #26 | **COMPLETED / MERGED** via PR #47 | Hardening (#27–#28) not ready |
| Framework hardening | #27–#28 | Not ready | Requires approved design |
| Framework engine | #29–#31 | Not ready | Requires hardening and OSCAL-first authorization |
| Licensed adapters | #32 | Blocked | Requires executed permission and technical gates |
| Security spine | #12–#17 | Planned | Continue in dependency order after P0 gates |
| Staging verification | Infrastructure + portal E2E | **LIVE VERIFIED** on `guardentra-staging` | Persist staging Admin env in App Hosting config |
| Production (`guardentra-prod`) | App + rules + scoped portal E2E + public domain | **LIVE VERIFIED**; domain cutover **COMPLETE** (deployed application SHA `29171a6…` / `build-2026-08-27-001`) | Synthetic Auth cleanup (owner-authorized); keep DNS/domain/rollback resources unchanged |

## Current blockers and risks

1. Production domain cutover is **complete**. Do not modify production DNS, custom-domain resources, or legacy rollback resources without separate owner authorization.
2. Dev project `guardentra-dev` may still be absent / not verified.
3. Production end-to-end customer submission evidence on the public domain is not fully recorded as a separate gate (prod portal security gate **PASS**; domain cutover **COMPLETE**).
4. PR #7 is stale.
5. Framework rights/provenance remain `unknown` or escalated for inventoried claim rows unless owner/publisher/counsel evidence is attached; product wording must stay conservative.
6. There is no malware scanner. MIME/size/extension is not a scan. Authoritative `clean` still requires real scanner state plus matching path and generation.
7. Staging portal mint depends on runtime Admin project env (`GCLOUD_PROJECT`, `FIREBASE_STORAGE_BUCKET`); these are live on revision `guardentra-staging-00002-lrg` and are being codified via PR #50 env-specific App Hosting yaml (still **NOT DEPLOYED**).
8. Residual synthetic Auth user on `guardentra-prod`: `gate-noclaim-*@guardentra-test.invalid` — owner authorized deletion 2026-09-01; verify count **0** after cleanup completes.
9. **P0 Firebase client environment isolation (2026-09-07 audit):** staging App Hosting BUILD env supplied only `VITE_FIREBASE_API_KEY` while `src/firebase.ts` field-by-field fell back to demo `guardentra-7f582` identifiers → classification **MIXED**. Staging backend Environment name was **unset** (so `apphosting.staging.yaml` cannot apply until set to `staging`). Production BUILD overrideEnv includes the full `VITE_FIREBASE_*` name set → classification **SAFE** (secret *values* not re-printed; console overrides still take precedence over yaml). Fix lands in PR #50 — **NOT DEPLOYED**; do not claim staging remediations until a post-fix staging rollout is verified.

**Removed stale blockers:** permanent production project absent; public-domain cutover pending — **`guardentra-prod` is provisioned, application LIVE, rules LIVE, portal E2E PASS, and domain cutover COMPLETE**. Legacy `guardentra-7f582` retained for rollback only.

## Next authorized actions

1. Merge the P0 Firebase environment-isolation PR (#50) when CI is green (**no deploy** from merge alone).
2. Operator: set App Hosting Environment name `guardentra-staging` → `staging` (required for `apphosting.staging.yaml`). Optional preferred rename: `guardentra-prod` Environment `prod` → `production`.
3. Separate owner command required to **deploy staging** (PR #50 head) and verify onboarding against `guardentra-staging` only.
4. Persist staging Admin env in App Hosting (covered by env-specific yaml once Environment name is set).
5. Production domain cutover is complete. Do not modify production DNS, custom-domain resources, or legacy rollback resources without separate owner authorization.
6. Do not merge PR #36. Do not delete `fix/p0-2-evidence-before-scan`. Do not reopen PR #39.

## Daily reporting

`GuardEntra Daily Brief` runs daily at 22:30 `Europe/Vienna`. It must separate repository and live state and must not mutate GitHub or deploy.
