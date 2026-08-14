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
| Default branch/current commit | `main` at `2aae09a237b615ecd78ec5bb6f3b67723a952c36` |
| Latest merged product work | PR #24: P0-1 review tests and correction-reopen receipt mode |
| Active governance work | Issue #33: project-state ledger and tool-routing protocol |
| Stale PR requiring disposition | PR #7; do not merge without rebase and scope review |

## Live runtime state

| Layer | Live state | Reconciliation |
|---|---|---|
| Public domain | `https://guardentra.com` | Reachable; performance baseline still needs measured evidence |
| Firebase project serving traffic | `guardentra-7f582` | Labelled demo/local-development but operationally production-equivalent |
| App Hosting | backend `guardentra`, `us-central1`; `build-2026-08-10-001` at 100% | Live commit `aa213558d6ce40d89060e96f2d72db660f1230f1` is behind `main` |
| Firestore rules | Live release matches the P0-1 rules on `main` | Rules are newer than the live application client |
| P0-1 outcome | **PARTIAL / MISMATCHED** | Old client can submit but does not perform intended `portalOpen: false` plus `submittedSnapshot` close/snapshot behavior |
| Named dev/staging/prod | Not established as live configured projects | Intended IDs remain placeholders |

Never call P0-1 fully live while application and rules are mismatched. Any deploy to `guardentra-7f582` is production-equivalent and needs explicit production authorization.

## Delivery position

| Track | Issues | Current position | Next gate |
|---|---|---|---|
| P0-1 vendor lock | #10, PRs #23/#24 | Code merged; rules live; intended client behavior not live | Production-equivalent app rollout plus live verification |
| P0-2 scan/review | #11 | Open investigation | End-to-end trace; no behavior change |
| Framework inventory | #25 | Ready after P0 reconciliation | Inventory content, mappings, provenance, rights, claims |
| Framework claims | #26 | Blocked by #25 | Evidence-backed wording decisions |
| Framework hardening | #27–#28 | Not ready | Requires #25/#26 and approved design |
| Framework engine | #29–#31 | Not ready | Requires hardening and OSCAL-first authorization |
| Licensed adapters | #32 | Blocked | Requires executed permission and technical gates |
| Security spine | #12–#17 | Planned | Continue in dependency order after P0 gates |

## Current blockers and risks

1. Public application commit is older than `main`; P0-1 client behavior is not live.
2. The only live project is labelled demo but serves production traffic.
3. Separate real dev, staging, and production projects are not configured.
4. PR #7 is stale.
5. Framework-labelled content lacks a completed provenance/rights inventory.

## Next authorized actions

1. Complete issue #33 as documentation-only PR; do not merge or deploy.
2. Prepare the production-equivalent P0-1 application rollout; do not deploy without explicit authorization.
3. Execute issue #11 as investigation-only.
4. Execute issue #25 before #26 or framework-engine implementation.

## Daily reporting

`GuardEntra Daily Brief` runs daily at 22:30 `Europe/Vienna`. It must separate repository and live state and must not mutate GitHub or deploy.
