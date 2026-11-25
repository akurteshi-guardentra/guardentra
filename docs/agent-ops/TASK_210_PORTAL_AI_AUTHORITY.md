# GuardEntra Task Packet

- Packet ID: GPT-210-PORTAL-AI-20261125
- Updated UTC: 2026-11-25
- Repository: akurteshi-guardentra/guardentra
- GitHub issue: #210; independent finding comment 7131592641
- Requirement/source IDs and locators: assessment-scoped portal authority,
  docs/CURRENT_ARCHITECTURE.md section 1; docs/ARCHITECTURE_FOUNDATION.md
  sections 2 and 3; server/routes/portal.ts custom-token minting;
  server/lib/evidenceAccess.ts authorizePortalAi.
- Relevant ADRs: existing scoped-token architecture retained; no new ADR.
- Base branch and verified SHA: cursor/terminal-assessment-immutable-c439,
  93a89482aa35b03c14233ebdb6e07d283efdd662
- Feature branch: fix/210-portal-ai-authority
- Primary writing tool (`tool:*`): tool:codex; scoped takeover recorded on #210.
- Optional reviewer (`review:*`, if any): independent review requested, not run.
- Owner / merge authority: @akurteshi-guardentra
- Management: L2 Security / L3 Backend and QA; T2 application authorization.

## Scope and authority

- User-visible outcome: portal tokens cannot use general organization AI.
- In scope: AI router's existing seat/authority middleware and synthetic tests.
- Out of scope: portal founder bootstrap, billing #144, live model calls,
  rules/IAM/secrets, data migrations, merging and deployment.
- Allowed files/services: server/middleware/requireClaimedInviteSeat.ts;
  src/tests/aiInviteSeat.test.ts; src/tests/aiPortalAuthority.test.ts;
  this packet, PROJECT_STATE.md and PROJECT_TRANSITIONS.md.
- Prohibited actions: modifying Cursor's branch or any unpublished worktree;
  real Firebase/model requests; new paid resources or bypassing release gates.
- Dependencies/blockers: new draft PR stacks on the published integration
  branch; the existing writer must review/integrate it before RC landing.
- Owner command authorized: source correction, commit and draft PR under the
  owner's development autonomy and instruction to take work into this chat.
  No release/configuration exception inferred.

## Impact analysis

- UI: unchanged; portal /propose-answers still supported.
- API/backend: reject portal principals with HTTP 403 before profile/model
  work unless POST /propose-answers; malformed portal claims fail closed.
- Firebase/database: no schema, rules, data or credential changes.
- IAM/security/privacy: assessment-scoped identity cannot acquire general AI
  authority even if a legacy/forged organization profile exists.
- Audit/evidence: existing proposal claim matching and trusted-evidence
  selection stay in the handler unchanged.
- Migration/rollback/recovery: no migration; feature-branch revert reverses
  this source patch. A live revert would need separate authorization.
- Documentation: record bounded source checkpoint; no hosted PASS claim.

## Acceptance and verification

- All registered general AI POST endpoints refuse portal identity before any
  model/profile work; route enumeration covers future handlers too.
- Valid organization identity can still call /generate.
- Same-assessment proposals keep the authoritative trusted-evidence gate;
  cross-assessment proposals fail before assessment evidence lookup.
- Explicit/unclaimed, missing, malformed, and failed membership behavior
  retained; malformed portal claims and wrong proposal method refused.
- Before correction: actual-router synthetic test observed /analyze HTTP 200
  instead of required 403; three other integration controls passed.
- After correction: 99 focused cases passed across aiPortalAuthority,
  aiInviteSeat and evidenceAccess. Initial typecheck found two new test-harness
  typing errors; those were corrected before publication.
- Exact current typecheck/build/CI results, commit/PR, changed files and
  working-tree state are bound in the PR completion evidence. No runtime
  acceptance, deployed rules, real model activity or numeric readiness gain.

## Handoff

- Classification: source CHECKPOINT pending published SHA/CI/review.
- Branch: fix/210-portal-ai-authority.
- Commit SHA / PR: use the exact published PR head and linked completion
  evidence; this document does not assign a self-referential commit hash.
- Exact changed files: six allowed paths listed above, checked against Git.
- Checks and working-tree state: see timestamped PR completion evidence.
- Deployment: NOT DEPLOYED.
- Limitations: fixes general AI authority only; portal founder-bootstrap,
  billing mapping, legacy reviewer-field exposure and all hosted gates remain.
- Remaining owner decisions: release/protection/rules/configuration decisions
  stay governed by existing issues; no additional spend is authorized.
- Engineering/production readiness: N/A, no scorecard recalculated.
- Maximum evidence stage: published-source checkpoint; no staging/prod points.
