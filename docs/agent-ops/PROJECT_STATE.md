# GuardEntra Project State

Current verified snapshot: 2026-08-23  
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
| Default branch/current commit | `main` at `a213981ae6f9e252fa5880f4f2a19b3d31663ca4` |
| Latest merged product/governance work | PR #24 P0-1; PR #35 live probe; PR #38 P0-2 investigation ledger; PR #39 rejected-head merge `85f718de43b19fa9a8d10312d726d2bf0899aaeb`; PR #40 squash-merged `8ea4b24e1a15b03e518de8d928d56d7491bc8599`; PR #44 squash-merged `d233eaa09fa7cd0b0c9f5a4518ae2850f7d34eb9`; PR #43 squash-merged `0f07657620d853cd9228ed58cf29b7d7e9960b73`; **PR #45 squash-merged** `f0f085d701340747963ef28e46ecd92eb9baf579`; **PR #47 squash-merged** `a213981ae6f9e252fa5880f4f2a19b3d31663ca4` |
| Active governance work | Issue #33 project-state/tool-routing protocol remains the governance umbrella. PR #43 is **MERGED**. **PR #46** (`docs/p0-f1-merge-ledger-closeout`) is **OPEN / NOT MERGED** — documentation-only ledger refresh through P0-F2 merge and staging verification. |
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
| `main` | `guardentra-prod` | **Not verified / not provisioned** |

`guardentra-7f582` remains **production-equivalent live legacy** serving `https://guardentra.com`. It is **not** the intended final permanent production architecture. Cutover to `guardentra-prod` requires separate owner authorization.

## Live runtime state — production-equivalent (`guardentra-7f582`)

| Layer | Live state | Reconciliation |
|---|---|---|
| Public domain | `https://guardentra.com` | Homepage **200**; `/login` **200**. Performance baseline still needs measured evidence. |
| Firebase project serving traffic | `guardentra-7f582` | Labelled demo/local-development but operationally production-equivalent |
| App Hosting | backend `guardentra`, `us-central1`, branch `main`; **100%** `build-2026-08-18-002` | **Unchanged by staging work.** No staging operation deployed application code, rules, traffic, or data here. |
| Firestore rules | `(default)` release `cloud.firestore` → `projects/guardentra-7f582/rulesets/c12a5117-1675-4775-b25b-ca463b36e7dc` | **Unchanged by staging work.** |
| Storage rules | `firebase.storage/guardentra-7f582.firebasestorage.app` → `projects/guardentra-7f582/rulesets/7bf9df8c-474f-4100-b5cc-77d019d7b2a9` | **Unchanged by staging work.** |
| P0-1 outcome | **DEPLOYED; BUNDLE VERIFIED** | `npm run verify:live` previously passed for `submittedSnapshot`, `correctionReopenedAt`, and `portalOpen:!1`; production end-to-end submission evidence remains separate. |
| Audit spine | Not enabled on this runtime | Staging also runs with `AUDIT_SPINE_ENABLED=false`. |

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

PR #46 and this ledger refresh are **documentation-only**. **No deployment, Firebase rules change, App Hosting traffic change, or runtime transition is authorized or implied by this ledger update.**

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
| Staging verification | Infrastructure + portal E2E | **LIVE VERIFIED** on `guardentra-staging` | Persist staging Admin env in App Hosting; optional `guardentra-dev` / `guardentra-prod` provisioning requires separate authorization |

## Current blockers and risks

1. `https://guardentra.com` still runs on production-equivalent legacy project `guardentra-7f582`, not the intended permanent `guardentra-prod`.
2. Permanent production project `guardentra-prod` is **not yet verified/provisioned**.
3. Dev project `guardentra-dev` may still be absent / not verified.
4. Production end-to-end P0-1 submission evidence is not recorded, although bundle verification passes.
5. PR #7 is stale.
6. Framework rights/provenance remain `unknown` or escalated for inventoried claim rows unless owner/publisher/counsel evidence is attached; product wording must stay conservative.
7. There is no malware scanner. MIME/size/extension is not a scan. Authoritative `clean` still requires real scanner state plus matching path and generation.
8. Staging portal mint depends on runtime Admin project env (`GCLOUD_PROJECT`, `FIREBASE_STORAGE_BUCKET`); these are live on revision `guardentra-staging-00002-lrg` but are **not yet codified in committed App Hosting config**.

**Removed stale blocker:** separate staging does not exist — **staging exists and is live verified.**

## Next authorized actions

1. Review and, only with owner authorization, **merge PR #46**. Do not deploy from that PR.
2. Persist staging Admin env in App Hosting (or staging-only override) via a separate authorized PR — not part of PR #46.
3. **No production deployment** to `guardentra-7f582` or `guardentra-prod` without a separate explicit owner command (`deploy production`).
4. Migration/cutover from `guardentra-7f582` to `guardentra-prod` requires separate owner authorization.
5. Do not merge PR #36. Do not delete `fix/p0-2-evidence-before-scan`. Do not reopen PR #39.

## Daily reporting

`GuardEntra Daily Brief` runs daily at 22:30 `Europe/Vienna`. It must separate repository and live state and must not mutate GitHub or deploy.
