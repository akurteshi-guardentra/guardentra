# GuardEntra Project State

Current verified snapshot: 2026-08-15  
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
| Default branch/current commit | `main` at `8ea4b24e1a15b03e518de8d928d56d7491bc8599` |
| Latest merged product work | PR #24 P0-1; PR #35 live probe; PR #38 P0-2 investigation ledger; PR #39 rejected-head merge `85f718de43b19fa9a8d10312d726d2bf0899aaeb`; **PR #40 squash-merged** `8ea4b24e1a15b03e518de8d928d56d7491bc8599` from head `e54fcc2eb02c5439794d8dddc9846ee9fcaf6938` |
| Active governance work | Issue #33: project-state ledger and tool-routing protocol |
| P0-2 investigation | Issue #11: **CONFIRMED DEFECT**; investigation complete; closed; **not FIXED** |
| P0-2 implementation | Issue #37: PR #40 **MERGED** and App Hosting **DEPLOYED** (`guardentra-build-2026-08-15-002` 100%). Dedicated live matrix **ran**; several API paths returned **500**. **Issue #37 remains OPEN.** Ledger PR #43. |
| P0-2 rejected PR | PR #36: **closed unmerged**; branch `fix/p0-2-evidence-before-scan` retained |
| Stale PR requiring disposition | PR #7; do not merge without rebase and scope review |

## Live runtime state

| Layer | Live state | Reconciliation |
|---|---|---|
| Public domain | `https://guardentra.com` | Reachable; performance baseline still needs measured evidence |
| Firebase project serving traffic | `guardentra-7f582` | Labelled demo/local-development but operationally production-equivalent |
| App Hosting | backend `guardentra`, `us-central1`; **100%** `guardentra-build-2026-08-15-002` | Image `sha256:211e44bd9551d7c99966e4b74db5bead8510ca568520af57674539ebe8c01fa0`. Previous rejected-head revision `guardentra-build-2026-08-15-001`. Rollback still `guardentra-build-2026-08-14-006`. |
| Firestore rules | `(default)` release `cloud.firestore` → `projects/guardentra-7f582/rulesets/c12a5117-1675-4775-b25b-ca463b36e7dc` | Live text includes `orgPreservesEvidenceTrust()` and `orgDeniesClientDecisionWrites()`. Previous: `6a2b8292-1fc2-41da-b77b-48dd5165071b`. AI Studio DB unchanged. |
| Storage rules | `firebase.storage/guardentra-7f582.firebasestorage.app` → `projects/guardentra-7f582/rulesets/7bf9df8c-474f-4100-b5cc-77d019d7b2a9` | Portal reads require matching open portal session; attachments `allow read: if false`. Previous: `ebffb056-6adb-4522-8086-061ecf70064e`. |
| P0-1 outcome | **DEPLOYED; BUNDLE VERIFIED** | Live probe still passes `submittedSnapshot`, `correctionReopenedAt`, and `portalOpen:!1` |
| Named dev/staging/prod | Not established as live configured projects | Intended IDs remain placeholders |

PR #40 recovery application and rules are **DEPLOYED**. Dedicated live matrix: client Firestore/Storage denials and P0-1 portal lock **PASS**. Server signed-URL and some decision updates **500** (`storageBucket` unset; `decisionNotes: undefined`). Historical `clean` count **0**. **No malware scanner exists.** #37 stays OPEN.

## Delivery position

| Track | Issues | Current position | Next gate |
|---|---|---|---|
| P0-1 vendor lock | #10, PRs #23/#24 | Code/rules/application deployed; bundle markers live verified | Safely record production end-to-end submission evidence |
| P0-2 scan/review | #11 closed; #37 **OPEN** | PR #40 deployed. Live matrix mixed PASS/FAIL (server 500s). **No malware scanner exists.** | Fix `storageBucket` + undefined `decisionNotes`; re-run signed-URL and decision matrix; do not close #37 yet |
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
6. There is no malware scanner. MIME/size/extension is not a scan. Dedicated live SDK verification of reviewer download / decisions / tenant isolation is still outstanding.

## Next authorized actions

1. Keep #37 open. Follow-up (not a new recovery PR from this task): Admin Storage bucket name + omit undefined `decisionNotes`. Re-verify signed URL and terminal decisions.
2. Do not merge PR #36. Do not delete `fix/p0-2-evidence-before-scan`. Do not reopen PR #39.
3. App Hosting rollback remains `guardentra-build-2026-08-14-006`. Rules rollback: Firestore `6a2b8292-1fc2-41da-b77b-48dd5165071b`, Storage `ebffb056-6adb-4522-8086-061ecf70064e`.
4. Execute issue #25 before #26 or framework-engine implementation.

## Daily reporting

`GuardEntra Daily Brief` runs daily at 22:30 `Europe/Vienna`. It must separate repository and live state and must not mutate GitHub or deploy.
