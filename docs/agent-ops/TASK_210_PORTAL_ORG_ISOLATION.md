# GuardEntra Task Packet

- Packet ID: GPT-210-PORTAL-ORG-20261126
- Updated UTC: 2026-11-26
- Repository / issue: akurteshi-guardentra/guardentra #210;
  source finding 7159635417, ownership checkpoint 7195240919.
- Requirement/source: docs/CURRENT_ARCHITECTURE.md section 1 assessment-scoped
  custom token, #210 portal authority boundary, existing founder/tenant rules.
- Relevant ADRs: existing scoped-token architecture; no new identity model.
- Base branch / verified SHA: fix/210-portal-ai-authority,
  c957ad1758f9484ff1a9c264e61c69c4fe4e5db9.
- Feature branch / PR: same remote task branch, existing draft #290.
  Local preparation: fix/210-portal-bootstrap-source at that exact base.
- Writer: tool:codex; L2 Security / L3 Backend, Firebase and QA; T3 source rules.
- Optional reviewer: independent security review pending; author does not self-accept.
- Owner / merge authority: @akurteshi-guardentra.

## Scope and authority

User requested fixing remaining blockers or deploying. This packet prepares a
source-only correction under the existing development authority, not a live
security/configuration exception. Cursor's integration branch is untouched.

Allowed paths: firestore.rules, storage.rules, server/lib/vendorMutation.ts,
server/routes/notify.ts, src/tests/firestore.rules.test.mjs,
src/tests/storage.rules.test.mjs, src/tests/portalOrgAuthority.test.ts, this
packet, PROJECT_STATE.md and PROJECT_TRANSITIONS.md.

No live rules release, IAM/secrets, database migration, tenant data access,
provider/email/model call, new resource/spending, merge or deployment.

## Impact analysis

- Firestore: organization authority explicitly excludes a token carrying the
  portalAssessmentId claim, even with a historical admin-shaped user profile.
  Apply to founder/profile/invite creation and organization/profile/invite
  authority. Keep portal-scoped assessment access separate and unchanged.
- Storage: the organization membership helpers enforce the same separation;
  preserve uploads/reads under the token's own open assessment.
- API: vendor create/archive reject portal claims before profile/product work;
  notification intents reject before Admin initialization/database/queue work.
- Privacy: historical portal-shaped profiles cannot confer organization access.
  Existing public assessment copies of reviewer fields are a separate #124 gap;
  this patch does not migrate or delete any profile or reviewer record.
- UI: no redesign; an invalid org request gets an explicit 403.
- Audit: durable vendor/notification operations remain unchanged for valid org
  principals; no journal or schema modification.
- Rollback: source revert to c957ad1. A future live rules release needs its own
  verified current ruleset baseline and scoped approval; the source base is not
  assumed to be the deployed rollback ruleset.
- Documentation: dated source checkpoint only; no production readiness points.

## Acceptance and observed verification

1. Synthetic actual API handlers, before correction: five failed / one passed.
   Vendor create/archive accepted an admin-shaped portal identity; notification
   intents reached a forbidden database boundary. No real queue/provider used.
2. Unchanged Firestore rules with initial regression probes: 175 passed / four
   failed. Portal founder batch and legacy-profile org/reviewer reads and org
   mutation succeeded where denial was required. No hosted write occurred.
3. Corrected Firestore suite: 182 passed / zero failed. Includes denied founder
   batch with no partial documents, denied verified-invite join, historical
   profile denial, ordinary-org positive control and scoped portal read retained.
4. Storage local run initially blocked downloading its runtime after the test
   wrapper cleared proxies. Downloaded the public jar through the existing proxy
   and verified its size and SHA256 against the installed Firebase CLI manifest;
   the unchanged wrapper then ran with local cross-service lookup preflight.
5. Unchanged Storage rules with new probes: 20 passed / three failed (org evidence
   read/write and attachment write through a portal profile). After correction:
   23 passed / zero failed, including retained own-assessment upload.
6. Focused Vitest: 121 passed across portalOrgAuthority, vendorMutationAudit,
   notificationIntent, notifications, vendorWelcomeInviteAudit, evidenceAccess
   and aiPortalAuthority. TypeScript and client/server build passed.
7. Exact published SHA/full CI and git status are recorded in #290 completion
   evidence; unchanged suites are not repeatedly rerun for reporting.

## Source rule hashes (not deployment receipts)

- Firestore SHA256: fdbd53b2436275c96ecf90cba5c4f92840c6d131f49b065953bf06ccf9d7c7e0
- Storage SHA256: 7855dcb8ba9dd6f6a85d9896f1651b800d610b85fcde1982b04aea0e7a8e76c3

## Handoff

Source CHECKPOINT only. Branch/head/PR, exact changed files, checks and clean
working tree are bound to #290's published completion evidence. NOT DEPLOYED.
Independent review/current CI and governed source integration come next. Actual
rules releases, all 16 hosted #124 steps, inbox/scanner/audit/billing/runtime,
legacy reviewer privacy and recovery/preservation gates remain open. No numeric
readiness or launch date is inferred from emulator success.
