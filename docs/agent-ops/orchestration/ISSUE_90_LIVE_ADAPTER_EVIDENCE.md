# GuardEntra Completion Evidence

Copy this block into every completion report, handoff, and PR. Do not remove fields.

## Classification

- Status: `CHECKPOINT`
- Claim being verified: issue #90 provider doctor continuation; Codex common proposal transport re-proven locally; unavailable provider prerequisites recorded; safe failover simulation exercises the unchanged supervisor. Two real providers remain NOT_AVAILABLE. Stop before commit.

## Mandatory evidence

1. **Branch name:** `tooling/autonomous-supervisor-90`
2. **Commit SHA:** `NOT COMMITTED`; unchanged starting HEAD `13ce0d4ec4dcf85aa7a7386560f1246c9fc47a87`.
3. **GitHub PR:** `NO PR — NOT DELIVERED TO GITHUB`
4. **Exact changed files:** repository-relative Git inventory, including the pre-existing implementation:

   ```text
   docs/agent-ops/orchestration/ISSUE_90_LIVE_ADAPTER_EVIDENCE.md
   docs/agent-ops/orchestration/ISSUE_90_TASK_PACKET.md
   docs/agent-ops/orchestration/README.md
   docs/agent-ops/orchestration/SUPERVISOR.md
   scripts/guardentra.ps1
   scripts/guardentra/Commands.ps1
   scripts/guardentra/ProviderDoctor.ps1
   scripts/guardentra/ProviderProcesses.ps1
   scripts/guardentra/Supervisor.ps1
   scripts/guardentra/tests/Live-Adapters.ps1
   scripts/guardentra/tests/ProviderProcesses.Tests.ps1
   scripts/guardentra/tests/Run-Tests.ps1
   scripts/guardentra/tests/Supervisor.Tests.ps1
   ```

5. **Test results:**

   - `powershell -File scripts/guardentra/tests/Run-Tests.ps1`: **PASS**, 488 passed, 0 failed, Windows PowerShell 5.1. Preserves the prior 467 passing checks and adds ten failover lifecycle checks and eleven doctor identity/auth/secrecy checks. Includes the actual supervisor state machine, separate-process mutex probes and a harmless child emitting a simulated quota error.
   - `powershell -NoProfile -File scripts/guardentra.ps1 provider-doctor`: **PASS** machine-readable metadata. Codex, Gemini, Google Cloud SDK and Grok identities/versions observed; generic agent.exe rejected as Cursor. Status-only gcloud account query; no credential values or account identifiers emitted.
   - `powershell -NoProfile -File scripts/guardentra/tests/Live-Adapters.ps1`: **PASS** for Codex common adapter; **NOT_AVAILABLE** for Cursor, Gemini/cloud and Grok/xAI. Run from the normal owner shell with existing authentication, not automatic adapter elevation. See provider matrix below.
   - `git diff --check`: **PASS**.
   - `Get-GuardentraChangedFiles` + `Assert-GuardentraChangedFilesAllowed` against issue #90 task: **PASS**, exact tracked/untracked inventory within allowed paths.
   - `git branch --show-current`, `git rev-parse HEAD`, `git status --short`: **PASS**, exact branch/HEAD and dirty checkpoint preserved; no staged changes.
   - Live quota/rate-limit failover: **BLOCKED/NOT RUN** (`NOT_AVAILABLE`), no exhaustion observed and no live issue fallback policy; no artificial quota consumption or invented service failure.

6. **Remaining uncommitted files:** exact `git status --short`:

   ```text
    M docs/agent-ops/orchestration/README.md
    M scripts/guardentra.ps1
    M scripts/guardentra/Commands.ps1
    M scripts/guardentra/tests/Run-Tests.ps1
   ?? docs/agent-ops/orchestration/ISSUE_90_LIVE_ADAPTER_EVIDENCE.md
   ?? docs/agent-ops/orchestration/ISSUE_90_TASK_PACKET.md
   ?? docs/agent-ops/orchestration/SUPERVISOR.md
   ?? scripts/guardentra/ProviderDoctor.ps1
   ?? scripts/guardentra/ProviderProcesses.ps1
   ?? scripts/guardentra/Supervisor.ps1
   ?? scripts/guardentra/tests/Live-Adapters.ps1
   ?? scripts/guardentra/tests/ProviderProcesses.Tests.ps1
   ?? scripts/guardentra/tests/Supervisor.Tests.ps1
   ```

7. **Deployment status:** `NOT DEPLOYED`

## Supporting evidence

- Issue and requirement IDs: [issue #90](https://github.com/akurteshi-guardentra/guardentra/issues/90), `issue-90`, [dispatch comment 5966629593](https://github.com/akurteshi-guardentra/guardentra/issues/90#issuecomment-5966629593), parent #88; authoritative local task `scripts/guardentra/state/issues/90/task.v1.json`.
- CI checks/URLs: `BLOCKED/NOT RUN` remotely; no push or PR authorized. Local required suite passed.
- Security/privacy/data/migration/documentation impact: provider-only local tooling; all prior Codex confinement and one-writer controls preserved. Added metadata-only doctor with status projection, fixed SDK/Node launch paths and presence-only credential checks; raw output never serialized. Deterministic normalized marker capture only. No IAM, secrets, DNS, product/data/migration or configuration changes. Existing supervisor and ProviderProcesses.ps1 implementation retained. Documentation records current proof limits.
- Known limitations: only one real provider common-adapter proof. Cursor unattended and two-provider acceptance remain unmet. Gemini CLI is detected, but no API key or OAuth cache is observed; an authenticated, confined Gemini CLI mapping is not proven. gcloud has an active local account, not verified Gemini access. xAI API key absent; Grok CLI login not inferred or reused. Codex restricted-shell home resolution unavailable; real proof uses normal owner shell. Failover simulation passes, but no live quota/fallback proof or live #90 fallback policy exists. CLI support restricted to the previously proven Codex build. No claim of general vendor-descendant recovery after timeout.
- Rollback procedure: review the exact task diff, restore only its tracked hunks and remove only its added source/docs/test files; preserve unrelated work and ignored task/contract/evidence caches. No migration or deployment rollback required.
- Optional reviewer (`review:*`, if engaged): `NONE`
- Owner authorization still required (merge/deploy/secrets/production): yes; any delivery requires the applicable explicit command. No delivery requested here. Missing provider installation/authentication or a live fallback policy requires separate owner action; none manufactured.
- Repository/live-state reconciliation: GitHub issue/body/comment re-read; branch/HEAD match dispatch. PROJECT_STATE.md is historical and provides no current #90 runtime proof. Provider outcomes below are local observations, not repository delivery or deployment.
- Project-state transition: none; no merge/deployment/issue transition. PROJECT_STATE.md and PROJECT_TRANSITIONS.md remain outside this issue's allowed paths. This document records the bounded tooling checkpoint.
- Next authorized issue/action: stop before commit; report unavailable prerequisites and retain the local checkpoint.

## Gate decision

- Evidence gate: `FAIL` for full issue completion; populated local checkpoint evidence only.
- Failed or unverified fields: `NOT COMMITTED`, `NO PR`; second real provider and Cursor unattended execution NOT_AVAILABLE; live resource failover NOT_AVAILABLE. The separately authorized failover simulation is PASS.
- Permitted wording: `local checkpoint`

The gate passes only when every mandatory field is populated and consistent with repository, GitHub, CI, and deployment evidence. `NOT COMMITTED`, `NO PR`, failed/unrun required tests, unexplained working-tree changes, or unverified deployment prevent a full completion claim.

Merge requires required CI pass and owner authorization. Optional review is not a merge gate unless the owner explicitly designated it blocking for that task.

## Provider observations (2026-10-03)

| Provider | Executable | Auth | Noninteractive | Common Adapter | Real Run | Final State |
|---|---|---|---|---|---|---|
| Codex | codex.exe 0.154.0-alpha.6.2 | Existing login, authenticated | PASS | PASS normalized deterministic proposal | PASS | available |
| Cursor | NOT_AVAILABLE; agent.exe identifies as Grok Build TUI | Unknown | NOT_AVAILABLE | PASS explicit unavailable result; execution NOT_AVAILABLE | NOT_AVAILABLE | manual_handoff_required |
| Gemini | gemini.cmd / Node, Gemini CLI 0.62.0 | No API key or OAuth cache observed | Headless JSON flags PASS; execution NOT_AVAILABLE | PASS explicit auth result; HTTPS inference NOT_AVAILABLE | NOT_AVAILABLE | auth_required |
| Google Cloud | gcloud.cmd / bundled Python, SDK 579.0.0 | Active local account; Gemini access unverified | SDK metadata PASS; inference NOT_AVAILABLE | PASS explicit auth result; Google inference first-class | NOT_AVAILABLE | auth_required |
| Grok / xAI | grok.exe, Grok Build TUI 1.0.34 | xAI API key absent; CLI login unverified | Reliable confined CLI mapping NOT_AVAILABLE | PASS explicit auth result; HTTPS inference NOT_AVAILABLE | NOT_AVAILABLE | auth_required |

The normal-owner-shell scan supersedes the earlier restricted-shell observation
that Gemini/gcloud were absent from PATH. No installation or login was performed.
`NOT_AVAILABLE` is only an evidence verdict, never a provider state. Provider
aliases do not count as independent real-provider proofs. The latest live run
validates the exact marker `GuardEntra issue 90 proposal transport proof.\n`, with
empty findings, disposable application/readback, heartbeat, worker exit and
unchanged candidate. No source file is proposed into the actual dirty worktree.

Executable locations (all observed locally, no inference from product names):

- Codex: `C:/Users/Admin/.vscode/extensions/openai.chatgpt-26.908.40401-win32-x64/bin/windows-x86_64/codex.exe`.
- Misidentified Cursor candidate: `C:/Users/Admin/.grok/bin/agent.exe`.
- Gemini: `C:/Users/Admin/AppData/Local/hermes/node/gemini.cmd`, verified package `@google/gemini-cli`; direct Node entry `node_modules/@google/gemini-cli/bundle/gemini.js`.
- Google Cloud: `C:/Users/Admin/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd`, probed through its bundled Python and `lib/gcloud.py`.
- Grok: `C:/Users/Admin/.grok/bin/grok.exe`.

Failover simulation: **PASS**, ten checks. Fixture issue 990, simulated quota
failure, real harmless child and actual supervisor/Git/state/mutex code. Events:
first lease acquired -> first child exited -> first lease released/disposed ->
separate process verified mutex available -> second lease acquired -> fallback
selected from persisted state -> second lease released/disposed. Both active
leases exclude a separate contender. Task hash, snapshot, prior tests and Owner
gate retained. This is not live Issue #90 authority or a second provider proof.
Live quota/fallback: **NOT_AVAILABLE**, no live policy or exhaustion manufactured.

Owner-accessible artifacts exist only in `C:/Users/Admin/repos/guardentra-codex-90`:

- `scripts/guardentra/state/issues/90/live-adapters.json`: safe, timestamped provider records and the snapshot at the live probe; subsequent documentation-only evidence edits are reflected in the final Git inventory above.
- `scripts/guardentra/state/issues/90/dispatcher-live-adapters.log`: final full suite output, 467/0.
- `scripts/guardentra/state/issues/90/provider-doctor.json`: standalone safe CLI metadata (the later doctor snapshot is also embedded in live-adapters.json).
- `scripts/guardentra/state/issues/90/live-adapters-doctor.log`: current live probe verdicts, one real provider PASS.
- `scripts/guardentra/state/issues/90/dispatcher-provider-doctor.log`: current full suite, 488/0.
- `scripts/guardentra/state/tests/failover-simulation.json`: persisted simulation lifecycle, checks and before/fallback/after state, PASS.

These ignored runtime artifacts and this uncommitted document have not been delivered to GitHub or a deployed environment. An initial bounded Codex attempt failed because a disabled MCP entry lacked its transport after ignoring user config; the inert disabled transport correction passed subsequent live probes. The first regression run used the earlier loaded function and failed the added empty-inventory case (466/1); the refreshed final suite is 467/0. No failures are counted as live success.

That 467/0 result is the preserved prior continuation. This continuation reports
488/0. An initial doctor entrypoint check caught a missing command ValidateSet
entry before the CLI was runnable; it was corrected. The first gcloud text status
projection was inconclusive; the JSON status-only projection verifies the active
account without exposing identifiers. Neither diagnostic was counted as live
provider success. No source supervisor redesign, commit, push, PR or deployment.

A later live rerun returned the expected provider outcomes but failed while
collecting the new alias-deduplicated summary (PowerShell switch changed `$_`).
The summary now retains the provider name before switch. The subsequent live
check at `2026-10-03T12:34:19.8111385Z` is **PASS** for Codex, with 22 heartbeats,
confirmed exit, normalized marker, disposable readback and unchanged candidate;
`real_providers=["codex"]`, `real_provider_count=1`, two-provider verdict
`NOT_AVAILABLE`. The collection failure is not counted as a successful
live-script execution. Final simulation at `2026-10-03T12:33:10.1097984Z`: **PASS**.


# Exact-path continuation evidence (2026-10-03; latest checkpoint)

This section supersedes earlier provider-availability observations while retaining
them as historical evidence. Owner-accessible local checkout:
C:\Users\Admin\repos\guardentra-codex-90. Nothing delivered to GitHub.

| Provider | Exact executable | Auth/runtime state | Common adapter | Real run |
|---|---|---|---|---|
| Codex | `C:\Users\Admin\.vscode\extensions\openai.chatgpt-26.908.40401-win32-x64\bin\windows-x86_64\codex.exe` | available; live authenticated inference | PASS proposal + apply/readback | PASS |
| Grok | `C:\Users\Admin\.grok\bin\agent.exe` | available; live authenticated inference | PASS proposal + apply/readback | PASS |
| Cursor | `C:\Users\Admin\AppData\Local\cursor-agent\agent.cmd` | auth_required; absent | PASS explicit unavailable result | NOT RUN |
| Gemini / Cloud | `C:\Users\Admin\AppData\Local\hermes\node\gemini.cmd` | owner_action_required; unproven | PASS explicit unavailable result | NOT RUN |
| Google Cloud SDK | `C:\Users\Admin\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd` | Installed 579.0.0; auth/runtime unproven | Cloud provider retained; version metadata only | NOT RUN |

Cursor's inspected launcher resolves to its pinned
`C:\Users\Admin\AppData\Local\cursor-agent\versions\2026.10.01-e373342\node.exe`
and index.js. Gemini resolves to
`C:\Users\Admin\AppData\Local\hermes\node\node.exe` plus
node_modules/@google/gemini-cli/bundle/gemini.js. Gcloud resolves to the SDK's
platform/bundledpython/python.exe plus lib/gcloud.py. No shell or PATH resolution.

Codex version 0.154.0-alpha.6.2 and Grok 1.0.34 (3736acbc8658) produced real
normalized proposals through Invoke-GuardentraProposalAdapter. Each returned the
fixed one-file proposal, passed strict schema/content checks, and passed actual
supervisor file application/readback in a disposable fixture. Worker exit and
unchanged candidate were verified. Grok/xAI aliases count as one provider.
Cursor 2026.10.01-e373342 status JSON proves auth_required, not inference.
Gemini 0.62.0 headless flags are detected; auth and inference are unproven.
Gcloud version was queried without account enumeration. No login/install occurred.

Grok confinement uses the pinned build's installed --help and bundled
.grok/docs/user-guide/14-headless-mode.md: empty temporary directory, empty
hook/plugin/MCP/LSP/project-instruction inventory, allowlist then denylist tool
removal, explicit MCP/shell/write/edit denials, no subagents/web, dontAsk, one turn,
and process-only updater/discovery suppression. This is tool confinement, not
a claim of Windows OS sandbox enforcement. References:
[official headless guide](https://docs.x.ai/build/cli/headless-scripting),
[official tool filtering contract](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/14-headless-mode.md).

FAILOVER_PROOF: PASS (SIMULATION ONLY). Actual supervisor state machine with
fixture issue 990 and isolated synthetic policy; no live Issue 90 policy created.
Both original quota_exhausted and added auth_required scenarios pass ten checks.
Lifecycle: first lease acquired -> harmless child exited -> first lease released
and disposed -> mutex observed available -> second exclusive lease acquired ->
fallback selected from persisted state -> second lease released and disposed.
Task identity, candidate HEAD/diff/digest and previous tests remain intact; worker
identity is cleared and the commit Owner gate remains. Metadata timeouts at help/auth/version/MCP discovery and execution timeouts return
owner_action_required because vendor descendant termination cannot be proven.

TEST_COUNTS: 508 passed, 0 failed (Windows PowerShell 5.1).
DIFF_CHECK: PASS.
COMMIT: NOT COMMITTED. PUSH: NOT PUSHED. MERGE: NOT MERGED. DEPLOY: NOT DEPLOYED.

Owner-local machine-readable artifacts (confirmed present):
- scripts/guardentra/state/issues/90/live-adapters.json (UTC 2026-10-03T21:27:59.4334213Z; two_provider_verdict=PASS; implementation SHA256 hashes).
- scripts/guardentra/state/issues/90/exact-path-tests.log (508 passed / 0 failed).
- scripts/guardentra/state/tests/failover-simulation.json (quota; retained).
- scripts/guardentra/state/tests/failover-auth-simulation.json (auth_required).
These are gitignored local evidence, accessible to the owner of this checkout,
not GitHub artifacts. The snapshot records the candidate at probe time; this
subsequent evidence-document update changes its aggregate digest. Runtime source
hashes in live-adapters.json still match exactly.

# GuardEntra Completion Evidence

## Classification

- Status: CHECKPOINT
- Claim being verified: Issue #90 exact provider binding, bounded invocation, two live common adapters and isolated supervisor failover proof; not delivery or all issue criteria.

## Mandatory evidence

1. **Branch name:** tooling/autonomous-supervisor-90
2. **Commit SHA:** NOT COMMITTED; unchanged starting HEAD 13ce0d4ec4dcf85aa7a7386560f1246c9fc47a87
3. **GitHub PR:** NO PR ? NOT DELIVERED TO GITHUB
4. **Exact changed files:** Git-generated list:

```text
docs/agent-ops/orchestration/ISSUE_90_LIVE_ADAPTER_EVIDENCE.md
docs/agent-ops/orchestration/ISSUE_90_TASK_PACKET.md
docs/agent-ops/orchestration/README.md
docs/agent-ops/orchestration/SUPERVISOR.md
scripts/guardentra.ps1
scripts/guardentra/Commands.ps1
scripts/guardentra/ProviderDoctor.ps1
scripts/guardentra/ProviderProcesses.ps1
scripts/guardentra/Supervisor.ps1
scripts/guardentra/tests/Live-Adapters.ps1
scripts/guardentra/tests/ProviderProcesses.Tests.ps1
scripts/guardentra/tests/Run-Tests.ps1
scripts/guardentra/tests/Supervisor.Tests.ps1
```

5. **Test results:**
   - PASS: powershell -File scripts/guardentra/tests/Run-Tests.ps1 (508 passed, 0 failed; log above).
   - PASS: powershell -NoProfile -File scripts/guardentra/tests/Live-Adapters.ps1 (Codex and Grok; Cursor auth_required; Gemini/Cloud unproven).
   - PASS: git diff --check; untracked files also checked with git diff --no-index --check -- /dev/null <path>.
   - PASS: exact changed-path allowlist/denylist validation against task.v1.json (13 files).
   - NOT RUN: GitHub CI, delivery, deployment; not authorized.
6. **Remaining uncommitted files:** exact git status --short:

```text
 M docs/agent-ops/orchestration/README.md
 M scripts/guardentra.ps1
 M scripts/guardentra/Commands.ps1
 M scripts/guardentra/tests/Run-Tests.ps1
?? docs/agent-ops/orchestration/ISSUE_90_LIVE_ADAPTER_EVIDENCE.md
?? docs/agent-ops/orchestration/ISSUE_90_TASK_PACKET.md
?? docs/agent-ops/orchestration/SUPERVISOR.md
?? scripts/guardentra/ProviderDoctor.ps1
?? scripts/guardentra/ProviderProcesses.ps1
?? scripts/guardentra/Supervisor.ps1
?? scripts/guardentra/tests/Live-Adapters.ps1
?? scripts/guardentra/tests/ProviderProcesses.Tests.ps1
?? scripts/guardentra/tests/Supervisor.Tests.ps1
```

7. **Deployment status:** NOT DEPLOYED

## Supporting evidence

- Issue and requirement IDs: issue-90; parent #88; live owner dispatch comment 5966629593; authoritative task.v1.json.
- CI checks/URLs: NOT RUN; local tests only, no GitHub mutation.
- Security/privacy/data/migration/documentation impact: T2 tooling; tighter process and tool confinement; provider output remains untrusted proposals; no credentials exposed/copied, account enumeration, product/data/IAM/DNS changes or migration. Existing dirty work preserved. Adapter/supervisor documentation updated.
- Known limitations: Cursor inference and Gemini/Cloud auth/runtime unproven; live supervisor resource failover NOT RUN, no live fallback policy; watchdog requires owner reconciliation on uncertain descendants. Existing broader Issue90 limitations remain. Exact installations are owner-machine-specific and unknown builds fail closed.
- Rollback procedure: review/remove only this continuation's hunks, preserving the prior dirty checkpoint and all task/runtime caches; no deployed rollback needed.
- Optional reviewer (review:*, if engaged): NONE
- Owner authorization still required (merge/deploy/secrets/production): yes; commit/delivery/merge require later explicit matching owner command; deployment is separate. No secrets or production action proposed.
- Repository/live-state reconciliation: matching #90 branch and starting SHA; live providers verified at recorded time. PROJECT_STATE.md is historical and does not prove this local checkpoint.
- Project-state transition: no merge/deploy/issue transition. Future source-ledger publication requires separately authorized PROJECT_STATE.md and appended PROJECT_TRANSITIONS.md work outside this issue's allowed paths.
- Next authorized issue/action: parent evidence90/status90/diff/status read-only review; stop before commit.

## Gate decision

- Evidence gate: FAIL for full delivery; local checkpoint evidence populated.
- Failed or unverified fields: NOT COMMITTED, NO PR, CI/deployment not run; remaining provider criteria listed above.
- Permitted wording: local checkpoint
