# Production release acceptance evidence (fill in)

Release issue/PR: #____   Pinned SHA: `________________________________________`
Owner grants (comment links): G1 ____ G2 ____ G3 ____ G4 ____ G5 ____ G6 ____
ChatGPT release-integrity review: ____

## Pre-checks (`out\prechecks-<sha>.json`)
| ID | Status | Note |
|---|---|---|
| E1-E8, E12 | | |
| P1 rollback build + image | | |
| P2 Option A live | | |
| P3 8 indexes READY | | |
| P4 secrets + SA access | | |
| P5 Storage | | |
| P6 env name prod | | |
| P7 / P7b auth | | |
| P8 no mail ext / scanner | | |
| P9 data counts | | |
| P10 backups | | |
| P11 domains | | |
| E9 staging #124 re-run on SHA (link) | | |

## Promotion
- Rollout id / build id: ____  start ____Z  end ____Z
- `02` result (`out\post-promotion-<sha>.json`): R1 __ R2 __ R3 __ R4 __ R4b __ R5 __ R6 __  -> PROD DEPLOYED at ____Z

## Smoke Phase A (Option A)
| Step | Result | Evidence (ids, status codes, screenshot) |
|---|---|---|
| A1 bootstrap | | uid / org |
| A2 vendor create | | |
| A3 assessment create | | asm / packs / bank version |
| A4 invite queued (link host) | | mail doc id |
| A5 / A6 | DEFERRED (email) | |
| A7 portal open | | |
| A8 persist reload | | |
| A9 upload stays scan_pending | | |
| A10 | DEFERRED (scanner) | |
| A11 submit | | |
| A12 approve blocked + remediate | | |
| A13 packet draft + recorded | | |
| A14 | DEFERRED (spine off) | |
| A15 relogin | | |
| A16 health | | |
| A17 staging account refused | | |

## Option B (G5)
- `out\option-b-deploy.json`: previous ____ new ____ sha ____ match __
- `02 -ExpectOptionB`: R6 __

## Smoke Phase B
A2 __ A3 __ A4 __ A7 __ A8 __ A11 __ A12 __ A15 __  W1 REST 403 (optional) __

## Cleanup (G6)
Listed ____ deleted ____ re-read gone ____ (audit events kept)

## Final label
[ ] PROD LIVE VERIFIED (release acceptance; email, scanner, audit spine DEFERRED)   [ ] ROLLED BACK (why, `out\rollback-*.json`)
