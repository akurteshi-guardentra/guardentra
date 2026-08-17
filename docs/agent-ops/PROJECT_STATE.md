# GuardEntra Project State

Current verified snapshot: 2026-08-17  
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
| Default branch/current commit | `main` at `d233eaa09fa7cd0b0c9f5a4518ae2850f7d34eb9` |
| Latest merged product work | PR #24 P0-1; PR #35 live probe; PR #38 P0-2 investigation ledger; PR #39 rejected-head merge `85f718de43b19fa9a8d10312d726d2bf0899aaeb`; PR #40 squash-merged `8ea4b24e1a15b03e518de8d928d56d7491bc8599`; **PR #44 squash-merged** `d233eaa09fa7cd0b0c9f5a4518ae2850f7d34eb9` from head `1e90a37507b4623aba3f7f855ff28f07bc345657` |
| Active governance work | Issue #33: project-state ledger and tool-routing protocol. Ledger PR #43 records PR #44 live recovery; **OPEN / NOT MERGED**. |
| P0-2 investigation | Issue #11 closed: confirmed defect investigated and recovery implemented under Option B. **No malware scanner exists**; therefore evidence cannot become authoritative `clean` until a future scanner workstream. |
| P0-2 implementation | Issue #37: PR #44 **MERGED** and App Hosting **DEPLOYED** (`guardentra-build-2026-08-17-001` **100%**). 2026-08-17 synthetic live matrix **PASS**. GitHub auto-closed #37 on the #44 merge; it was **reopened** so this ledger can merge. **#37 remains OPEN** until PR #43 merges. |
| P0-2 rejected PR | PR #36: **closed unmerged**; branch `fix/p0-2-evidence-before-scan` retained |
| Stale PR requiring disposition | PR #7; do not merge without rebase and scope review |

## Live runtime state

| Layer | Live state | Reconciliation |
|---|---|---|
| Public domain | `https://guardentra.com` | Homepage **200**; `/login` **200**. Performance baseline still needs measured evidence. |
| Firebase project serving traffic | `guardentra-7f582` | Labelled demo/local-development but operationally production-equivalent |
| App Hosting | backend `guardentra`, `us-central1`; **100%** `guardentra-build-2026-08-17-001` | Image `sha256:9031ec3eb08516847c42e3db47f589cd37642d22f59dc405901532464e519659` serving merge `d233eaa`. Auto-roll on `main` **did not start**; manual build+rollout of that SHA succeeded. Rollback: `guardentra-build-2026-08-15-002`. |
| Firestore rules | `(default)` release `cloud.firestore` → `projects/guardentra-7f582/rulesets/c12a5117-1675-4775-b25b-ca463b36e7dc` | **Unchanged and NOT redeployed** in the PR #44 recovery. Live text still includes `orgPreservesEvidenceTrust()` and `orgDeniesClientDecisionWrites()`. |
| Storage rules | `firebase.storage/guardentra-7f582.firebasestorage.app` → `projects/guardentra-7f582/rulesets/7bf9df8c-474f-4100-b5cc-77d019d7b2a9` | **Unchanged and NOT redeployed** in the PR #44 recovery. Portal reads require matching open portal session; attachments `allow read: if false`. |
| P0-1 outcome | **DEPLOYED; BUNDLE VERIFIED** | `npm run verify:live` **PASS** (`submittedSnapshot`, `correctionReopenedAt`, `portalOpen:!1`) |
| Named dev/staging/prod | Not established as live configured projects | Intended IDs remain placeholders |

PR #44 recovery application is **DEPLOYED** and **LIVE VERIFIED**. 2026-08-17 synthetic matrix **PASS** (signed URLs, no-notes terminals, 409 lock, client denials, portal isolation, P0-1 submit lock). Reviewer download remains fail-closed without authoritative `clean` + matching path + generation. **No malware scanner exists.** Do not fabricate `clean`.

## Delivery position

| Track | Issues | Current position | Next gate |
|---|---|---|---|
| P0-1 vendor lock | #10, PRs #23/#24 | Code/rules/application deployed; bundle markers live verified | Safely record production end-to-end submission evidence |
| P0-2 scan/review | #11 closed; #37 **OPEN** (ledger close-out) | PR #44 merged/deployed; 2026-08-17 live matrix **PASS**. **No malware scanner exists.** | Merge ledger PR #43, then owner may close #37. Do **not** start #41 or #42 yet. |
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
6. There is no malware scanner. MIME/size/extension is not a scan. Authoritative `clean` still requires real scanner state plus matching path and generation.

## Next authorized actions

1. Keep #37 **OPEN** until ledger PR #43 is merged. Do not close #37 from this documentation task.
2. Do not merge PR #43 until the owner authorizes. Do not start issues #41 or #42 yet.
3. Do not deploy anything else. Do not redeploy Firestore or Storage rules. Do not change App Hosting traffic. Rollback revision remains `guardentra-build-2026-08-15-002`.
4. Do not merge PR #36. Do not delete `fix/p0-2-evidence-before-scan`. Do not reopen PR #39.
5. Execute issue #25 before #26 or framework-engine implementation.

## Daily reporting

`GuardEntra Daily Brief` runs daily at 22:30 `Europe/Vienna`. It must separate repository and live state and must not mutate GitHub or deploy.
