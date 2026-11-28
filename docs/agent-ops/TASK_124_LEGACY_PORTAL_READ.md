# GuardEntra Task Packet

- Packet ID: GPT-124-LEGACY-PORTAL-READ-20261126
- Updated UTC: 2026-11-26
- Repository / issue: akurteshi-guardentra/guardentra #124; source findings
  7131595484 and 7132252820; ownership checkpoint 7199408449.
- Requirement/source: reviewer notes/identity/residual risk/remediation owner
  are private; vendor receipts, editable answers and scan trust must remain
  usable. Existing scoped-link model in CURRENT_ARCHITECTURE.md section 1.
- Decision: docs/adr/portal-legacy-review-read-boundary.md, prepared before
  implementation; source proposal, security review/release acceptance pending.
- Base branch / verified SHA: fix/210-portal-ai-authority,
  07717b4df895dc4fe73b04272cb1e73865fb0a04.
- Feature branch / PR: existing remote branch and draft #290. Local preparation
  on fix/124-legacy-review-read-boundary from that exact published source.
- Writer: tool:codex; L2 Security / L3 Backend, Firebase, Frontend and QA; T3.
- Owner / merge authority: @akurteshi-guardentra; independent review pending.

## Scope and authority

Owner instructed continuing fixes. Prepare source correction, tests, commit and
publication in existing #290. No live record inventory, migration/copy/deletion,
provider/model/payment call, secrets/IAM, new service/agent/controller or spend.
No live rules rollout, merge or deployment. Cursor's branch is unchanged.

Allowed paths: firestore.rules; server/routes/portal.ts;
server/lib/portalAssessmentView.ts; src/pages/VendorPortal.tsx;
src/lib/vendor/projectedTrustRefresh.ts; src/tests/firestore.rules.test.mjs;
src/tests/portalAssessmentView.test.ts; src/tests/portalProjectedRoute.test.ts;
src/tests/projectedTrustRefresh.test.ts; src/tests/vendorPortalProjection.test.tsx;
the decision above, this packet, TASK_124_LEGACY_REVIEW_FIELDS.md,
PROJECT_STATE.md and PROJECT_TRANSITIONS.md.

## Impact and acceptance

- Firestore cannot redact full-document reads. Deny portal direct reads when
  any of the five private keys exists, including historical null-valued keys.
  Org reviewer access and permitted vendor update fields stay unchanged.
- The existing session response includes a finite vendor field projection from
  its existing Admin read. No extra initial database read/token is introduced.
  Unknown/internal fields, reviewer fields, raw snapshots and stored download
  URLs are not spread into that projection; nested public structures are selected.
- The portal consumes the session projection and fails closed if absent. Old
  receipts work without a raw Firestore get. Missing submission timestamps show
  Unknown instead of an invented current timestamp in the downloaded receipt.
  Fresh submissions consume the server acknowledgement timestamp; a malformed
  successful HTTP response does not claim a submission receipt.
- Safe documents retain the scoped scan listener. Historical projected records
  use authenticated POST /api/portal/assessment-view; the verified portal claim
  must match the requested id before lookup. Closed never-submitted records,
  org tokens, other-assessment tokens and persistence failures are refused.
- Only trust maps refresh. Requests do not overlap; stop on cleanup, resolution
  or error; max 60 attempts at ten-second spacing per active effect. Expiry/error
  keeps evidence untrusted and asks the user to refresh. No background scheduler
  or paid model/API operation is introduced.
- No data is migrated or deleted. Org review/export can still read original
  historical values. Existing terminal immutability and evidence gates remain.

## Observed tests

- Before the rule correction: 184 passed / five failed; each private field
  independently leaked through a permitted full-document portal read.
- After correction: 189 Firestore checks PASS, including org historical-read
  and legacy editable-answer positive controls. Local demo emulator only.
- Focused Vitest: 104 PASS across portalAssessmentView, portalProjectedRoute,
  projectedTrustRefresh, vendorPortalProjection and evidenceAccess. Actual
  registered handlers and actual React consumer with mocked external boundaries.
  Nine consumer cases cover receipt/reload, missing projection, scoped refresh,
  modern listener, unavailable scanner, fresh submit acknowledgement and disposal; pure refresh tests cover
  max requests, no overlap, errors and immediate resolution stop.
- Initial component fixture imports needed complete Firebase boundary stubs;
  corrected before publication. No product failure is claimed from fixture errors.
- Storage: 23 PASS after caching the public runtime with installed-manifest
  size/SHA256 verification. Initial download prerequisite failure was not a pass.
- TypeScript, client/server build and diff check PASS. Exact final SHA/full CI,
  scope and git status are bound in #290; prior source CI is not this head's proof.
- New Firestore source SHA256:
  2ce5693e1a2a7e20d0627dbaaca06dfa2c64e916c8540cb75db741b93fe6ee74.

## Rollout and rollback limits

Deploy a separately authorized app/API first, verify session projection and
legacy receipt/edit/refresh. Then release the exact reviewed Firestore rules
under its scoped authorization and capture current deployed ruleset baseline,
rollback target/hash and readback. Cached old clients may need a page reload.
App deployment is not evidence of rules release; no live exposure is closed here.

Source revert is possible. A safe live rollback must preserve the private-field
read barrier and a projection-compatible app; an older app without projection
can make legacy links unavailable. Do not weaken rules to regain access. No
rollback/runtime acceptance is claimed; resolve this before production approval.

## Handoff

Source CHECKPOINT only; NOT DEPLOYED. Exact branch/head/PR/files/checks and clean
tree are recorded on #290. Independent security review and exact-head CI remain
required before governed integration. Full 16-step hosted acceptance, scanner,
inbox, audit/billing, RC controls and recovery/preservation stay open. Historical
data cleanup is optional and separately authorized, not silently executed.
No numeric readiness gain or guaranteed deployment date.

## 2026-11-28 bounded correction — refresh request isolation

Owner handoff: Slack #all-guardentra thread1795731196.443939, November26
23:13 CET and November28 follow-ups. Codex remains the sole writer on
fix/210-portal-ai-authority / #290 from2bc2213bfa27785af99236c6ef463429ae543faf.
L2 Engineering / L3 Backend+QA, T2 bounded workflow correction.

Acceptance: give assessment-view its own30/minute allowance, keep existing
session20/minute and shared submit/validate/download30/minute policy unchanged.
Mounted Express router tests must exhaust refresh and still successfully submit
valid answers through the real handler with synthetic persistence; verify the
existing shared evidence policy still enforces429 and refresh remains available.
Also preserve scoped authorization/finite projection through existing regressions.

Allowed incremental files: server/routes/portal.ts;
src/tests/portalRateLimit.test.ts; this packet; PROJECT_STATE.md and
PROJECT_TRANSITIONS.md. No new dependency, live reads/writes, rules, credentials,
provider calls, paid workloads, merges or deployments. Publish in existing PR,
then independent review under the explicit handoff. Cursor branch stays unchanged.
Rollback: revert this incremental source commit on the owned feature branch;
never silently revert prior privacy guards. No live rollback performed.
Readiness scores: not recalculated; no runtime gate or numeric gain claimed.

Observed bounded verification: mounted-router suite before source correction
failed two tests (submission and refresh returned429 due to shared allowance),
one existing-session-limit control passed. After source correction, all three
mounted tests and100 existing focused portal/evidence regressions passed. Real
handlers/middleware execute over localhost HTTP; only Firebase/persistence
boundaries are synthetic. No real audit commit or hosted acceptance claimed.
