# Issue #88 correction cycle 2 task packet

- Packet ID: issue-88-correction-2
- Updated UTC: 2026-09-27
- Repository: akurteshi-guardentra/guardentra
- GitHub issue: https://github.com/akurteshi-guardentra/guardentra/issues/88
- Requirement/source IDs and locators: #88 security requirements and first-slice dispatch; independent review BLOCKER/HIGH findings in the owner session; TASK_CONTRACT_SCHEMA.md, TASK_V1_SCHEMA.md, AGENT_RUNNER.md.
- Relevant ADRs: existing PowerShell dispatch/grant architecture; no new architecture.
- Base branch and verified SHA: tooling/agent-control-plane-88 at ce74baab01d2ee2162263f9026363171a0e650e6 (preserve unchanged).
- Feature branch: tooling/agent-control-plane-88
- Primary writing tool: this owner-directed correction session only; preserve dispatch writer identity, do not reassign any runtime contract or start another writer.
- Management: L3 AppSec lead / L4 execution; T2 repository tooling, no cloud IAM/security-rule mutation.
- Optional reviewer: none newly engaged; prior independent review is the correction input.
- Owner / merge authority: @akurteshi-guardentra

## Scope and authority

- Outcome: fail closed on forged local contracts, task/result authority, cached evidence, retry widening, and unproven adapter capability.
- In scope / allowed paths: scripts/guardentra.ps1, scripts/guardentra/*, docs/agent-ops/orchestration/*; edits limited to the reviewed functions, regression tests, and their documentation.
- Out of scope / prohibited: product code, Firebase, IAM/secrets, infrastructure; commit/amend/reset/rebase/squash/stash/branch switch/push/PR/merge/deploy.
- Dependencies/blockers: #66 baseline present. Local checkpoint independently verified; historical PROJECT_STATE.md predates this work and is not live-state evidence.
- Authorized end state: tested uncommitted correction; STOP BEFORE COMMIT.

## Impact analysis

- UI/API/backend/Firebase: none.
- Security/privacy: local orchestration validates live scope before tests; data objects never grant authority; cached evidence is unverified.
- Audit/evidence: stricter schema and live git/test binding, no new grant mechanism.
- Migration/rollback/recovery: old malformed state refuses or loses cached evidence rather than gaining trust; no production migration. Preserve checkpoint; rollback only this uncommitted patch under owner direction, never rewrite checkpoint history.
- Documentation: update schema/runner limitations and this packet, within allowed paths. Global project ledger is outside #88 scope and unchanged.

## Acceptance and verification

- Acceptance: address each prior BLOCKER/HIGH, preserving valid task/result flows subject to fail-closed tightening.
- Unit/integration/security tests: powershell -File scripts/guardentra/tests/Run-Tests.ps1, including negative contract/task/result/cache/capability/retry cases and temporary git fixtures.
- E2E/live tests: no cloud or live agent execution; adapters remain manual.
- Build/lint: PowerShell parser and full dispatcher suite; git diff --check.
- Evidence: exact diff/status, unchanged HEAD/branch, per-finding regression map in final handoff; no GitHub writes.

## Handoff

- Classification: CHECKPOINT; corrections NOT COMMITTED, NO PR — NOT DELIVERED TO GITHUB.
- Exact changes/results/working-tree state: reported from final Git/check output.
- Deployment: NONE.
- Known limitations: local test code is executable code reviewed with the candidate; no OS sandbox or autonomous tool execution is introduced. Cached test outcomes never prove a current run.
- Rollback: owner-directed reversal of correction diff only; checkpoint remains intact.
- Remaining owner decisions: independent review and any subsequent commit/delivery authorization.

## Security findings addressed

| Finding | Root correction | Regression evidence |
|---|---|---|
| Runner trusts local authority/test commands | Commands.ps1: Assert-GuardentraAgentContractLive and Invoke-GuardentraAgentRun revalidate dispatch and independent worktree/HEAD identity. Common.ps1: Invoke-GuardentraRequiredTests uses the fixed supported command and literal argument vector. | Missing/changed dispatch, T3/T4, blank/forged worktree, widened paths, wrong writer/issue/base, empty/injected tests refuse before execution. Candidate edits during tests invalidate evidence. |
| Task objects widen authority | Commands.ps1: Assert-GuardentraTaskV1Valid / Assert-GuardentraTaskV1MatchesDispatch enforce exact shape, fixed false autonomous flags, every Owner gate, tier ceiling, canonical paths, and deny/stop policy. | T3/T4, true autonomous flags, grant-shaped fields, path traversal, lowered dispatch ceiling, weakened deny list refuse. |
| Malformed results and cached evidence | Commands.ps1: Assert-GuardentraAgentResultV1Valid / Assert-GuardentraAgentResultMatchesLocalEvidence separate strict schema from current git/test provenance. Common.ps1: Read-GuardentraAgentState validates cache and discards cached result evidence; status/watch label cache UNVERIFIED. | Missing/mistyped fields; forged HEAD/branch/base/writer/issue/files/tests/clean flag; grant/path/tier/retry cache fields; nonscalar schema/state; forged cached results do not become verified evidence. |
| Retry limit widening | Common.ps1: Test-GuardentraRetryGate and Register-GuardentraAttempt retain one shared counter, validate integer bounds, refuse limits above 3 and exhausted-budget resets. | Invalid counts/limits; real runner third failure persists count 3 and blocked restart status; fourth attempt and success-reset refuse. |
| Installed CLI misreported as execution support | Adapters.ps1: Test-GuardentraAdapterCanRun remains false for all unproven implementations. | Installed/function CLI names and provider hints cannot enable capability; start/resume remain manual_handoff_required. |

# GuardEntra Completion Evidence

## Classification

- Status: CHECKPOINT
- Claim being verified: local correction of the reviewed #88 BLOCKER/HIGH findings, preserving checkpoint history and Owner gates.

## Mandatory evidence

1. **Branch name:** tooling/agent-control-plane-88
2. **Commit SHA:** NOT COMMITTED for corrections. Preserved HEAD: ce74baab01d2ee2162263f9026363171a0e650e6.
3. **GitHub PR:** NO PR — NOT DELIVERED TO GITHUB
4. **Exact changed files:**
   - docs/agent-ops/orchestration/AGENT_RUNNER.md
   - docs/agent-ops/orchestration/TASK_V1_SCHEMA.md
   - docs/agent-ops/orchestration/ISSUE_88_CORRECTION_2.md (new)
   - scripts/guardentra/Adapters.ps1
   - scripts/guardentra/Commands.ps1
   - scripts/guardentra/Common.ps1
   - scripts/guardentra/tests/Run-Tests.ps1
5. **Test results:** powershell -File scripts/guardentra/tests/Run-Tests.ps1: PASS, 360 passed / 0 failed. PowerShell parser: PASS for the four changed scripts. git diff --check: PASS. Branch/HEAD verification: PASS. git diff --cached --name-only: empty.
6. **Remaining uncommitted files:** six modified tracked files and this untracked packet; all unstaged, within #88 allowed paths.
7. **Deployment status:** NOT DEPLOYED.

## Supporting evidence

- Issue and requirement IDs: #88 first-slice security requirements; correction-cycle-2 owner instruction and independent review.
- CI checks/URLs: no CI run or GitHub mutation; local dispatcher suite above.
- Security/privacy/data/migration/documentation impact: tooling trust boundaries and local schemas tightened; no product, cloud IAM, secrets, or database changes. Malformed/unproven cached evidence refuses or is discarded, not promoted.
- Known limitations: adapters remain manual; tests are reviewed executable code, not an OS sandbox. Local caches cannot provide fresh test evidence. Global project-state ledger is historical and outside this issue's allowed paths.
- Rollback procedure: preserve the uncommitted patch and reverse only these correction edits if the owner directs; never amend/reset/rebase the checkpoint.
- Optional reviewer (`review:*`, if engaged): prior independent security review drove this correction; no new reviewer engaged or approval claimed.
- Owner authorization still required (merge/deploy/secrets/production): yes, separate explicit commands for any commit/push/PR/merge/deploy; none performed.
- Repository/live-state reconciliation: isolated local HEAD verified; no runtime inspection or deployment claim.
- Project-state transition: none on GitHub/live systems. Correction evidence recorded here within allowed orchestration paths; global ledger unchanged.
- Next authorized issue/action: owner review of uncommitted correction; STOP BEFORE COMMIT.

## Gate decision

- Evidence gate: PASS for local checkpoint; delivery gate not passed.
- Failed or unverified fields: corrections are uncommitted and have no PR/CI; no deployment.
- Permitted wording: local checkpoint.
