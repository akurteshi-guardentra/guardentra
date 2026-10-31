# Paste-ready summary for ChatGPT: prod release acceptance runbook (2026-10-31)

```
GuardEntra P0 release acceptance: runbook for promoting ONE pinned RC SHA to guardentra-prod. PREPARED ONLY, NOTHING RUN.
Files: ops/prod-release-acceptance/ (RUNBOOK.md, 01/02 read-only PS checks, 03/04/05 gated change scripts, EVIDENCE.md).

ENTRY (pinned SHA): on RC; all check runs green; PUBLIC_APP_URL=https://guardentra.com in prod+production yaml
(NOT on RC 25e273e6 yet: needs #239 yaml merged); firestore.rules LF f53bd980 (== Option B logic); indexes LF f2d695c0;
storage.rules c9629c78 (== live prod); no scanner/mail/reminder/spine switch on; staging serves SHA;
FULL #124 re-run on that exact SHA incl. #236 retest (pending); owner decides #241/#242; main alignment decision.

PRE-CHECKS (01, read-only): P1 prod serves build-2026-08-27-001 @29171a6 + image still in Artifact Registry (rollback);
P2 rules = Option A 2a30bd60/a0645160; P3 8 RC indexes READY (prod has 0 -> #239 script, gated); P4 VITE_FIREBASE_API_KEY,
GEMINI_API_KEY, AUDIT_DATABASE_URL have ENABLED versions + backend SA access (spine=false so the DB is never opened);
P5 Storage sha; P6 env name prod; P7 auth (guardentra.com not an authorized domain -> Google popup WARN);
P8 no Trigger Email ext / scanner secret; P9 data counts; P10 PITR/delete protection (recommended gate); P11 domains.

PROMOTION (G4): firebase apphosting:rollouts:create guardentra-prod --git_commit <SHA> (check --help for flag name).
02 readback: traffic 100% build of SHA; /api/health production/guardentra-prod/sourceSha==SHA on guardentra.com + hosted.app;
bundle only projectId guardentra-prod; security headers + security.txt Canonical; CORS evil not echoed; rules still Option A.

SMOKE A (Option A) mirrors #124: sign-up, vendor, assessment, invite QUEUED only (link host guardentra.com), portal via
mail-doc link, persist, upload stays scan_pending (no EICAR on prod), submit, approve blocked + remediate, draft/recorded
packet, relogin, health, staging account refused. DEFERRED: inbox/provider (email), EICAR (scanner), audit chain (spine off).
G5 Option B (04: refuses unless prod serves SHA) -> smoke B subset (+ optional REST vendor create 403). G6 cleanup incl. mail docs.

ROLLBACK: rules first (05 -> 2a30bd60), then app (03: rollout of EXISTING build-2026-08-27-001, validateOnly first; refuses
while Option B live). Never rebuild 29171a6 from git (only apphosting.yaml -> blank /login like legacy). Indexes stay.
Result label: PROD LIVE VERIFIED (release acceptance) != GO LIVE; #72 email, #73 scanner, #74 prod spine remain.

Review asks: (1) deploy RC SHA directly vs merge to main first; (2) is EICAR/clean-scan deferral acceptable for acceptance;
(3) rollback data note if real tenants sign up after promotion; (4) App Hosting rollout API body {build} for 03.
PowerShell reviewed by reading only (not executed).
```
