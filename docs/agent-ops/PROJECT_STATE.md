# GuardEntra Project State

Current verified snapshot: 2026-08-19  
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
| Default branch/current commit | `main` at `f0f085d701340747963ef28e46ecd92eb9baf579` |
| Latest merged product/governance work | PR #24 P0-1; PR #35 live probe; PR #38 P0-2 investigation ledger; PR #39 rejected-head merge `85f718de43b19fa9a8d10312d726d2bf0899aaeb`; PR #40 squash-merged `8ea4b24e1a15b03e518de8d928d56d7491bc8599`; PR #44 squash-merged `d233eaa09fa7cd0b0c9f5a4518ae2850f7d34eb9`; PR #43 squash-merged `0f07657620d853cd9228ed58cf29b7d7e9960b73`; **PR #45 squash-merged** `f0f085d701340747963ef28e46ecd92eb9baf579` from head `0455ac9e385e26b8087076823dbf2570d1de6880` |
| Active governance work | Issue #33 project-state/tool-routing protocol remains the governance umbrella. PR #43 is **MERGED**. Current ledger close-out is a separate docs-only PR from `docs/p0-f1-merge-ledger-closeout`; no deployment. |
| P0-2 investigation | Issue #11 closed: confirmed defect investigated and recovery implemented under Option B. **No malware scanner exists**; authoritative `clean` still requires a future scanner workstream. |
| P0-2 implementation | Issue #37 is **CLOSED / COMPLETED**. PR #44 is merged and App Hosting `guardentra-build-2026-08-17-001` was previously deployed/live-verified with the 2026-08-17 synthetic matrix PASS. PR #43 then merged the ledger close-out. |
| Framework inventory | Issue #25 is **CLOSED / COMPLETED**. PR #45 merged docs-only inventory: 54 controlKeys, 8 packs, 3 mapping subsystems, 112 claim rows; rights/provenance state remains `unknown` unless stronger evidence is recorded. |
| Framework claims | Issue #26 is **OPEN / READY** after #25 completion. Writer remains to be assigned per issue/branch; no implementation has started from this ledger task. |
| P0-2 rejected PR | PR #36: **closed unmerged**; branch `fix/p0-2-evidence-before-scan` retained |
| Stale PR requiring disposition | PR #7; do not merge without rebase and scope review |

## Live runtime state

| Layer | Live state | Reconciliation |
|---|---|---|
| Public domain | `https://guardentra.com` | Last verified homepage **200**; `/login` **200**. Performance baseline still needs measured evidence. |
| Firebase project serving traffic | `guardentra-7f582` | Labelled demo/local-development but operationally production-equivalent |
| App Hosting | backend `guardentra`, `us-central1`; last verified **100%** `guardentra-build-2026-08-17-001` | Image `sha256:9031ec3eb08516847c42e3db47f589cd37642d22f59dc405901532464e519659` serving merge `d233eaa09fa7cd0b0c9f5a4518ae2850f7d34eb9`; rollback `guardentra-build-2026-08-15-002`. PR #45 and this ledger work are documentation-only and do not establish a newer deployed application revision. |
| Firestore rules | `(default)` release `cloud.firestore` → `projects/guardentra-7f582/rulesets/c12a5117-1675-4775-b25b-ca463b36e7dc` | Last verified unchanged since PR #44 recovery. |
| Storage rules | `firebase.storage/guardentra-7f582.firebasestorage.app` → `projects/guardentra-7f582/rulesets/7bf9df8c-474f-4100-b5cc-77d019d7b2a9` | Last verified unchanged since PR #44 recovery. |
| P0-1 outcome | **DEPLOYED; BUNDLE VERIFIED** | `npm run verify:live` previously passed for `submittedSnapshot`, `correctionReopenedAt`, and `portalOpen:!1`; production end-to-end submission evidence remains separate. |
| Named dev/staging/prod | Not established as live configured projects | Intended IDs remain placeholders |

PR #44 recovery application is the last explicitly live-verified application state in this ledger. PR #45 and the current ledger close-out are documentation-only. **No deployment, Firebase rules change, App Hosting traffic change, or runtime transition is authorized or implied by this ledger update.**

## Delivery position

| Track | Issues | Current position | Next gate |
|---|---|---|---|
| P0-1 vendor lock | #10, PRs #23/#24 | Code/rules/application deployed; bundle markers live verified | Safely record production end-to-end submission evidence |
| P0-2 scan/review | #11 and #37 closed/completed | PR #44 merged/deployed; live matrix PASS; PR #43 ledger close-out merged. **No malware scanner exists.** | Future scanner workstream if authorized; do not fabricate `clean` |
| Framework inventory | #25 | **COMPLETED / MERGED** via PR #45 | Preserve inventory as source evidence for #26 |
| Framework claims | #26 | **READY**; dependency on #25 satisfied | Start a fresh implementation branch with one writer; correct/qualify unsupported wording; no deploy without separate owner command |
| Framework hardening | #27–#28 | Not ready | Requires #26 and approved design |
| Framework engine | #29–#31 | Not ready | Requires hardening and OSCAL-first authorization |
| Licensed adapters | #32 | Blocked | Requires executed permission and technical gates |
| Security spine | #12–#17 | Planned | Continue in dependency order after P0 gates |

## Current blockers and risks

1. The only live project is labelled demo but serves production traffic.
2. Separate real dev, staging, and production projects are not configured.
3. Production end-to-end P0-1 submission evidence is not recorded, although bundle verification passes.
4. PR #7 is stale.
5. Framework rights/provenance remain `unknown` for the 112 inventoried claim rows unless owner/publisher/counsel evidence is attached; #26 must therefore use conservative product wording.
6. There is no malware scanner. MIME/size/extension is not a scan. Authoritative `clean` still requires real scanner state plus matching path and generation.

## Next authorized actions

1. Review and, only with owner authorization, merge the docs-only P0-F1 ledger close-out PR. Do not deploy from that PR.
2. Issue #26 is now ready. Start it on a fresh feature branch with one writer (`tool:cursor` recommended from the current workflow), optional `review:codex`, and optional read-only Agency Agents specialist checks.
3. For #26, use the merged P0-F1 inventory as the claim/path source of truth; do not silently mutate existing assessment snapshots and do not copy new publisher wording.
4. No production deployment, Firebase/rules redeploy, or App Hosting traffic change without a separate explicit owner command.
5. Do not merge PR #36. Do not delete `fix/p0-2-evidence-before-scan`. Do not reopen PR #39.

## Daily reporting

`GuardEntra Daily Brief` runs daily at 22:30 `Europe/Vienna`. It must separate repository and live state and must not mutate GitHub or deploy.
