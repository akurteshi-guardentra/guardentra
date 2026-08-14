# GuardEntra Project State

Current verified snapshot: 2026-08-14  
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
| Default branch/current commit | `main` at `8d3e66e76e0e75ce7f9e64c05c985173310c2f42` |
| Latest merged product work | PR #24: P0-1 implementation; PR #35: live-verification probe |
| Active governance work | Issue #33: project-state ledger and tool-routing protocol |
| P0-2 investigation | Issue #11: **CONFIRMED DEFECT**; investigation complete; closed; **not FIXED** |
| P0-2 implementation | Issue #37: approved, **not started**; Option B |
| P0-2 rejected PR | PR #36: **closed unmerged**; branch `fix/p0-2-evidence-before-scan` retained |
| Stale PR requiring disposition | PR #7; do not merge without rebase and scope review |

## Live runtime state

| Layer | Live state | Reconciliation |
|---|---|---|
| Public domain | `https://guardentra.com` | Reachable; performance baseline still needs measured evidence |
| Firebase project serving traffic | `guardentra-7f582` | Labelled demo/local-development but operationally production-equivalent |
| App Hosting | backend `guardentra`, `us-central1`; rollout serves application commit `2aae09a237b615ecd78ec5bb6f3b67723a952c36` | Product code matches deployed application; `main` is ahead only by PR #35 probe/docs |
| Firestore rules | Live release matches the P0-1 rules on `main` | Rules and live client contain the P0-1 close/snapshot implementation |
| P0-1 outcome | **DEPLOYED; BUNDLE VERIFIED** | Live probe passes for `submittedSnapshot`, `correctionReopenedAt`, and `portalOpen:!1`; production end-to-end submission remains separate evidence |
| Named dev/staging/prod | Not established as live configured projects | Intended IDs remain placeholders |

P0-1 application/rule artifacts are live and bundle-verified. P0-2 is **not** deployed. Do not claim a malware scanner or malware protection. Do not claim a production end-to-end submission without separate evidence. Any deploy to `guardentra-7f582` is production-equivalent and needs explicit production authorization.

## Delivery position

| Track | Issues | Current position | Next gate |
|---|---|---|---|
| P0-1 vendor lock | #10, PRs #23/#24 | Code/rules/application deployed; bundle markers live verified | Safely record production end-to-end submission evidence |
| P0-2 scan/review | #11 closed; #37 open | Investigation complete: **CONFIRMED DEFECT**. Implementation approved, not started. **No malware scanner exists.** PR #36 closed unmerged. | Implement #37 on a new branch; do not merge #36; do not deploy |
| Framework inventory | #25 | Ready after P0 reconciliation | Inventory content, mappings, provenance, rights, claims |
| Framework claims | #26 | Blocked by #25 | Evidence-backed wording decisions |
| Framework hardening | #27–#28 | Not ready | Requires #25/#26 and approved design |
| Framework engine | #29–#31 | Not ready | Requires hardening and OSCAL-first authorization |
| Licensed adapters | #32 | Blocked | Requires executed permission and technical gates |
| Security spine | #12–#17 | Planned | Continue in dependency order after P0 gates |

## Current blockers and risks

1. The only live project is labelled demo but serves production traffic.
2. Separate real dev, staging, and production projects are not configured.
3. Production end-to-end P0-1 submission evidence is not recorded, although bundle verification passes.
4. PR #7 is stale.
5. Framework-labelled content lacks a completed provenance/rights inventory.
6. Live/`main` still treats uploaded portal evidence as present for review/AI; there is no malware scanner. MIME/size/extension is not a scan.

## Next authorized actions

1. Implement issue #37 (P0-2 Option B) on a **new** branch after owner start authorization; do not reuse PR #36 without a fresh security review.
2. Do not merge PR #36. Do not delete `fix/p0-2-evidence-before-scan`.
3. Do not deploy application or rules for P0-2 until explicit owner deploy authorization.
4. Execute issue #25 before #26 or framework-engine implementation.

## Daily reporting

`GuardEntra Daily Brief` runs daily at 22:30 `Europe/Vienna`. It must separate repository and live state and must not mutate GitHub or deploy.
