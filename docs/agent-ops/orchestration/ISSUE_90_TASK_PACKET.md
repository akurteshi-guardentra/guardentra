# GuardEntra Task Packet

- Packet ID: issue-90-local
- Updated UTC: 2026-10-03
- Repository: akurteshi-guardentra/guardentra; owner-accessible isolated checkout `C:\Users\Admin\repos\guardentra-codex-90`
- GitHub issue: https://github.com/akurteshi-guardentra/guardentra/issues/90
- Requirement/source IDs and locators: issue-90; task.v1.json under scripts/guardentra/state/issues/90; issue #90 body and owner dispatch comment 5966629593; parent #88 body.
- Relevant ADRs: no separate orchestration ADR found; implementation follows the supervisor architecture specified by #90. No product architecture change.
- Base branch and verified SHA: main baseline 13ce0d4ec4dcf85aa7a7386560f1246c9fc47a87; local HEAD verified equal.
- Feature branch: tooling/autonomous-supervisor-90
- Primary writing tool (`tool:*`): tool:codex
- Optional reviewer (`review:*`, if any): NONE
- Owner / merge authority: `@akurteshi-guardentra`

Optional review does not block merge after required CI passes unless the owner explicitly makes it blocking for this task.

## Scope and authority

- User-visible outcome: resumable local supervisor, explicit provider capabilities, leases/watchdog, controlled failover, verification and scheduled report views.
- In scope: T2 repository tooling. L2 Engineering Manager / Architect; L3 architecture/QA responsibilities performed by the single L4 Codex writer.
- Out of scope: product, infrastructure, IAM, secrets, DNS, migrations, deployment, GitHub mutations.
- Allowed files/services: scripts/guardentra.ps1; scripts/guardentra/*; docs/agent-ops/orchestration/*; .github/workflows/ci.yml only if needed for tests.
- Prohibited actions: commit, push, create/update PR, merge, deploy, T3/T4, protected-path edits, concurrent writers.
- Dependencies/blockers: real provider proof depends on installed supported unattended CLIs and existing authentication. Missing capability/auth is reported, never simulated as live proof.
- Owner command authorized (commit / commit and PR / commit, PR, and merge / deploy staging / deploy production): NONE; implement/test locally and stop before commit.

## Impact analysis

- UI: none.
- API/backend: local PowerShell tooling only.
- Firebase/database: none.
- IAM/security/privacy: preserve owner gates; provider output is data, not commands or authority; bound writes to validated paths. No credential reads in reports.
- Audit/evidence: atomic local state, exact Git snapshots, provider statuses, tests, explicit unverified live states.
- Migration/rollback/recovery: no migration; retain legacy runner. Revert only the issue-90 diff to roll back. Interrupted uncertain worker/application state stops for owner reconciliation.
- Documentation: new supervisor contract/setup/limitations and this packet. Existing PROJECT_STATE.md is historical and outside allowed paths; it does not evidence #89/#90 or a current deployment.

## Acceptance and verification

- Acceptance criteria: all 17 criteria in authoritative task.v1.json / issue #90; unmet live milestones must remain explicit.
- Unit tests: extend dispatcher entry point with supervisor regression suite.
- Integration/emulator tests: actual local Git fixtures and PowerShell 5.1; no Firebase tests needed.
- End-to-end tests: bounded real provider probes where available; never equate fixtures with two-provider live proof.
- Security/negative tests: leases, stale recovery, scope/tier/authority rejection, output validation, no concurrent failover, retry exhaustion, forbidden night actions, exact verification evidence.
- Build/lint/typecheck: powershell -File scripts/guardentra/tests/Run-Tests.ps1; git diff --check.
- Required screenshots/logs/live-state evidence: test results and safe capability metadata; no screenshots or secret/raw provider logs.
- Exact changed-file scope validation: Git tracked/untracked file enumeration against authoritative allow/deny paths.

## Handoff

### Provider doctor continuation (2026-10-03)

Live issue #90 and owner comment 5966629593 revalidated; same branch, HEAD,
writer and T2 scope. Preserve all existing supervisor behavior. Add a read-only
machine-readable provider doctor, separate Gemini/gcloud detection and sanitized
auth metadata, and consume that metadata in the existing live probe. Extend the
existing real-supervisor failover fixture with lease lifecycle, persisted-state
and task-preservation evidence. The owner explicitly authorized this simulation;
its fixture issue/policy is not a live #90 grant. No installed second supported
CLI has yet been observed. No installation, login or permission/config changes
are authorized. Cursor project configuration is also a prohibited task path.
Intended edits: scripts/guardentra.ps1, scripts/guardentra/ProviderDoctor.ps1,
scripts/guardentra/Commands.ps1, scripts/guardentra/tests/{Live-Adapters,
ProviderProcesses.Tests,Supervisor.Tests}.ps1 and orchestration docs. Validation:
real doctor/live adapter probes, full Run-Tests.ps1, git diff --check and exact
scope inventory. Rollback: only continuation hunks, preserving the earlier dirty
checkpoint. No product, migration, deployment or live fallback policy changes.

### LIVE-ADAPTER continuation (2026-10-03)

Continue the existing dirty checkpoint at the same branch/HEAD; do not restart the
supervisor against it or replace its state. Live issue #90 and dispatch comment
5966629593 re-read through GitHub. Codex remains the only writer. Scope is provider
capability/confinement, bounded common-contract live probes, provider regression
tests and evidence documentation. No fallback policy is present on the live issue;
do not invent one or induce quota exhaustion. Exercise actual unavailable states
and retain synthetic failover tests separately from live evidence. Read-only CLI
auth probes may need the normal owner shell because the restricted shell cannot
resolve the Codex home. No credentials/configuration are changed. Required checks
remain the full PowerShell 5.1 suite, exact path validation and git diff --check.
Risk/access and rollback remain T2/local tooling and removal of only this issue's
reviewed diff. Record unavailable provider prerequisites rather than install tools
or widen authority.

- Classification: CHECKPOINT (488 regression checks pass; Codex common adapter re-proven; machine-readable doctor and safe failover simulation verified; two-provider milestone remains unmet).
- Branch: tooling/autonomous-supervisor-90
- Commit SHA: NOT COMMITTED
- PR number/URL: NO PR — NOT DELIVERED TO GITHUB
- Exact changed files: see the Git-generated list in `ISSUE_90_LIVE_ADAPTER_EVIDENCE.md`, including this packet and the existing checkpoint files.
- Exact tests/checks and results: `powershell -File scripts/guardentra/tests/Run-Tests.ps1` PASS (488/488), Windows PowerShell 5.1; `powershell -NoProfile -File scripts/guardentra.ps1 provider-doctor` PASS metadata; `powershell -NoProfile -File scripts/guardentra/tests/Live-Adapters.ps1` PASS for Codex and explicit NOT_AVAILABLE for Cursor, Gemini/cloud, Grok/xAI; `git diff --check` PASS. Owner-local logs: `scripts/guardentra/state/issues/90/dispatcher-provider-doctor.log`, `live-adapters-doctor.log` and `live-adapters.json`; simulation evidence at `scripts/guardentra/state/tests/failover-simulation.json`. Full path/status validation is recorded in the completion evidence. Earlier 467/0 proof is retained as historical evidence.
- Remaining `git status --short` state: four modified tracked files and nine untracked files; exact status is included in the completion evidence.
- Deployment status and verification: NOT DEPLOYED.
- Known limitations: two real provider end-to-end proofs remain unmet. Codex passes the common proposal contract on the pinned CLI build in the normal owner shell; restricted-shell home resolution remains unavailable. Native Cursor interface absent; Gemini/xAI API credentials absent. No live quota/rate-limit or authorized fallback policy was observed, so live failover is NOT_AVAILABLE. Next-runnable-P0 reporting remains explicitly unverified pending live dispatch/dependency validation. See SUPERVISOR.md for proof/recovery limits.
- Rollback procedure: remove added issue-90 files and restore only its changed hunks after reviewing the exact diff; preserve local runtime task/contract and unrelated work.
- Optional reviewer findings (if engaged): NONE.
- Remaining owner decisions: installation/auth remediation if required, later delivery authorization; no delivery action in this task.

Attach the completed `COMPLETION_EVIDENCE_TEMPLATE.md`. Missing evidence prohibits a completion claim.

### Exact-path provider continuation (2026-10-03)

Live #90, owner dispatch 5966629593 and parent #88 re-read. Same repository,
branch and starting SHA recorded above; preserve the 488-check dirty checkpoint.
T2 / L2 engineering and L4 single Codex writer. Scope: exact provider bindings,
bounded stdin/output watchdog, Grok confined proposal transport, honest Cursor
auth and Gemini/Cloud unproven state, auth-required failover fixture, necessary
regressions and evidence. Existing passing supervisor and task state retained.
No gcloud credential enumeration, login, install, global permission edits or
GitHub mutations. Native launcher entry points are pinned alongside exact owner
paths. Validation: full required suite, common-adapter Codex/Grok live proofs,
controlled actual-supervisor simulation and Git diff/scope checks. Rollback only
these continuation hunks after review, preserving all earlier dirty work.

Latest continuation result: CHECKPOINT; 508 passed / 0 failed. Codex and Grok
common-adapter live proofs PASS, Cursor auth_required, Gemini/Cloud installed
with auth/runtime unproven. Quota and auth-required actual-supervisor simulations
PASS, each with ten lease/persistence checks. See the latest exact-path section
in ISSUE_90_LIVE_ADAPTER_EVIDENCE.md for all seven evidence fields and limitations.
No commit, push, PR, merge, deploy or live fallback policy mutation.
