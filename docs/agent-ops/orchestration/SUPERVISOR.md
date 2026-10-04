# Local supervisor (#90)

This is a local implementation checkpoint. Codex and Grok have passed the
common-adapter live milestone; this does not complete every issue #90 criterion. No commit, push, PR, merge, or deployment is performed.
The historical #88 `agent run` interface remains available with its manual-only
adapter behavior. The new supervisor uses a separate proposal adapter contract.

## Commands (Windows PowerShell 5.1)

```powershell
powershell -File scripts/guardentra.ps1 providers
powershell -NoProfile -File scripts/guardentra.ps1 provider-doctor
powershell -File scripts/guardentra.ps1 supervisor 90
powershell -File scripts/guardentra.ps1 night-run -Passes 10 -IntervalSeconds 30
powershell -File scripts/guardentra.ps1 report morning
powershell -File scripts/guardentra.ps1 report midday
powershell -File scripts/guardentra.ps1 report night
powershell -File scripts/guardentra/tests/Run-Tests.ps1
powershell -NoProfile -File scripts/guardentra/tests/Live-Adapters.ps1
```

The supervisor requires a **clean, already provisioned isolated worktree** at
the exact dispatched starting SHA on first execution. Do not run it against an
in-progress human/agent checkout: dirty first starts refuse. Subsequent passes
require exact persisted branch, HEAD, changed-file set, content digest, diff hash,
and working-tree state. Commit is always the terminal Owner gate for this slice.

Night mode discovers registered Git worktrees and their existing issue contracts.
It changes its local execution root for each task, revalidates that task against
live GitHub, and continues after a blocked/Owner-gated task. It never provisions
arbitrary model-selected paths, performs a privileged action, or assumes that
roadmap completion proves a deployment. Reports are cached, explicitly unverified
views with writer/reviewer, branch/HEAD, tests, stage, blockers, handoffs and Owner
gates. Quota is `unknown` unless an actual provider failure identifies exhaustion.
The next runnable P0 position requires live task/dependency validation; reports
do not infer it from cached titles.

## Authority and provider policy

The live accepted #9C dispatch remains scope authority. Task/contract/state files
are caches. All original grant/replay controls remain in place. Local execution
never consumes or manufactures a commit/push/merge/deployment grant.

The default execution policy is **only the assigned writer**, with no fallback.
An Owner-authored issue comment may explicitly supply the following bounded
policy; it grants provider selection only, not a wider task or access tier:

````markdown
## GUARDENTRA_SUPERVISOR_POLICY
```json
{
  "issue": 90,
  "branch": "tooling/autonomous-supervisor-90",
  "starting_sha": "13ce0d4ec4dcf85aa7a7386560f1246c9fc47a87",
  "providers": ["codex", "cursor"],
  "reviewer": ""
}
```
````

This example is not an active policy or an instruction to post it. The first
provider must equal the assigned writer. Multiple policy blocks refuse as
ambiguous. Reviewer selection is optional and must be explicit; the reviewer
cannot equal the current writer. An unavailable requested reviewer returns an
Owner gate rather than inventing approval. Optional review does not become a
repository merge gate.

## Execution and output contract

`Invoke-GuardentraProposalAdapter` is the common transport for the pinned Codex
and Grok CLIs, and explicit unavailable states for Cursor and Gemini/Cloud. Inputs are a validated task, bounded
in-scope text context, correction data, and watchdog callbacks. Output is a
normalized provider state and an **untrusted** proposal:

```json
{"files":[{"path":"scripts/guardentra/example.txt","content":"example\n"}],"findings":[]}
```

Findings have exactly `severity`, `path`, `reason`, and `fix`; severity is
BLOCKER/HIGH/MEDIUM/LOW. Only BLOCKER/HIGH requests another correction. Review
proposals must contain no files. Provider prose, commands, grant-shaped extra
fields, paths outside the allowlist, runtime/authority metadata, traversal,
Windows device names, reparse points and tier escalation are rejected. Proposed
file contents are data, never passed to a shell. No deletion transport exists.
The supervisor is the only process applying proposals to the worktree.

The fixed required-test command and `git diff --check` run against the exact
candidate; branch/HEAD/content must remain stable across tests. As with #88,
candidate test code is executable code, not an OS sandbox. The supported command
list never comes from provider output. Secret-like context is omitted, raw
provider stdout/stderr/HTTP errors are not persisted, and recognized secret-like
file proposals/findings refuse. Pattern checks are not a general DLP guarantee.

## Provider capability and current proof boundary

| Provider | Transport/state | Verified 2026-10-03 |
|---|---|---|
| Codex | Pinned native exec, read-only, ephemeral, no approvals, tools disabled | PASS: common proposal, strict validation, disposable application/readback |
| Grok / xAI | Pinned native headless JSON; empty extension inventory; tools removed | PASS: common proposal, strict validation, disposable application/readback |
| Cursor | Exact installed launcher and pinned Node entry point | auth_required from status JSON; no login or inference |
| Gemini / Cloud | Exact installed Gemini launcher and Node entry point; separate SDK version | owner_action_required; installed/capability-detected, auth/runtime unproven |

Bindings are centralized in Get-GuardentraProviderBinding. Every CLI uses the
owner-verified absolute installation path; no PATH lookup of agent, codex,
gemini or gcloud occurs. Inspected .cmd wrappers resolve to exact native Node or
bundled Python entry points without shell interpretation. Cursor is pinned to
2026.10.01-e373342; Codex to 0.154.0-alpha.6.2; Grok to 1.0.34 (3736acbc8658).
A missing/replaced installation requires renewed verification, not a PATH fallback.

Codex retains its prior confinement: read-only sandbox, ignored user/project
rules, ephemeral session, disabled execution/browser/apps/plugins/hooks/subagent
features, and verified per-server MCP disables with inert transport entries.
No approval or sandbox bypass is used. Existing credentials stay in the provider.
The restricted shell cannot resolve Codex home; the authorized live probe runs
in the normal owner shell without copying credentials or changing login state.

Grok runs from a new empty temporary non-repository directory. Before inference,
its bounded inspect --json must report empty hooks, plugins, MCP servers, LSP
servers and project instructions. Unknown/missing inventory fields refuse.
The headless allowlist selects read_file, then the denylist removes read_file,
search_tool, use_tool and Agent; deny rules additionally block MCPTool, Bash,
Write and Edit. Subagents and web search are disabled, permission mode is dontAsk,
and max-turns is one. Per-child environment suppresses updates, compatible
vendor hooks/MCP discovery and managed MCP discovery; no global settings change.
These constraints follow the installed CLI help and bundled headless guide:
[official headless reference](https://docs.x.ai/build/cli/headless-scripting),
[tool filtering and output contract](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/14-headless-mode.md).
Only the normalized proposal is exposed, never the raw inventory, response or
credentials. Grok may maintain its normal provider-local session metadata;
the model cannot apply the proposal. This is tool confinement, not a claim of
Windows kernel sandbox enforcement.

The doctor performs bounded help/version/status probes. Cursor status is parsed
as authentication metadata even when an unauthenticated response exits zero.
Gcloud runs version only: no account enumeration or auth query. Gemini help
proves headless JSON capability, not authentication. Both remain in the worker
pool. No inference PASS is derived from installation or a doctor verdict.
The earlier tool-free HTTP implementation is retained but is not selected by
these exact-installation CLI bindings. No API credentials are inferred from CLI
login and no quota availability is invented.

Live-Adapters.ps1 revalidates the live issue, exact HEAD and repository lease,
passes the unchanged task through the common adapter, and applies/readbacks only
one validated fixed proposal in a disposable fixture. It confirms worker exit
and unchanged task snapshot. Its normalized results and doctor metadata are
owner-local at scripts/guardentra/state/issues/90/live-adapters.json. Aliases
are deduplicated: Codex plus Grok are two providers, Grok plus xAI are one.
This is real transport proof, not a full live supervisor implementation or a
live fallback policy. Cursor unattended execution remains unproven.

Every provider invocation, including metadata, uses the same deadline covering
stdin backpressure, process execution and redirected output completion. Timeout
returns machine-readable owner_action_required and does not select fallback:
parent termination alone cannot prove all vendor descendants exited. No indefinite
login loop or automated login is attempted.

## Persistence, leases, recovery and failover

State is local and gitignored:
`scripts/guardentra/state/issues/<issue>/supervisor.json`.
Atomic same-directory replacement preserves task hash, phase, snapshot, tests,
attempts, handoffs, provider, reviewer, heartbeat and worker PID/start time.
A named Windows mutex keyed by the canonical common Git directory conservatively
serializes supervisor writers across the repository, including linked worktrees.
It does not lock unrelated human editors or legacy external tools; those must
respect the one-writer rule, and candidate drift fails closed.

The watchdog persists heartbeats while a process/HTTP request is pending and
enforces a bounded transport deadline. On process timeout the retained process
handle terminates the parent and the task blocks; the implementation does not
claim all vendor descendants were terminated. A prior live worker, unknown launch
window, abandoned mutex, interrupted application/test, or changed candidate
requires Owner reconciliation. A confirmed dead read-only worker with an unchanged
candidate can resume. Uncertain state is not silently discarded.

Recognized rate/quota, auth_required and manual_handoff_required states persist
exact candidate/test handoffs before
releasing the old lease. Only an explicitly allowed next provider may receive a
new exclusive lease. The original proposal process must have returned, and the
candidate is rechecked after reacquiring. Normal test/review corrections stay with
the same healthy writer. Failures use the existing shared `contract.attempt_count`
and `retry_limit`; the third failure persists and blocks further work. Success
does not erase previous supervisor correction failures.

Verification records recognize all requested MISSING through
PRODUCTION_LIVE_VERIFIED stages, require full SHA/evidence and matching environment
for deployment stages, and label externally supplied records unverified. The
supervisor itself only emits MISSING, IMPLEMENTED_LOCAL and TESTED_LOCAL. There is
no API here that promotes cached claims to merged or deployed truth.

## Validation and rollback

The dispatcher entry point also executes `Supervisor.Tests.ps1`, covering real
temporary Git worktrees/processes plus synthetic provider responses. The existing
Windows CI dispatcher job therefore includes this suite without a workflow change.
Runtime capability metadata and detailed test logs for this checkout are under
`scripts/guardentra/state/issues/90/` (owner-local only, not delivered to GitHub).

The owner-authorized failover simulation is part of `Supervisor.Tests.ps1` and
writes `scripts/guardentra/state/tests/failover-simulation.json` (quota) and
`failover-auth-simulation.json` (auth_required). It uses fixture
issue 990 and a synthetic fallback policy, never live #90 authority. A harmless
PowerShell child emits the simulated quota/auth failure; the actual supervisor closes
its lease and reacquires another after persisting the handoff. Separate processes
verify exclusion during both leases and mutex availability between them. The
artifact records lifecycle events, persisted task/snapshot/test data, ten checks,
and the final Owner gate. This is state-machine evidence, not a second live
provider or an observed live quota/auth failure. The existing supervisor handoff
path additionally accepts auth_required and unavailable interfaces, under the
same explicit policy and exclusive-lease checks.

Rollback is removal of this issue's added files and restoration of its exact
tracked hunks after reviewing the diff. Do not reset unrelated work or delete
runtime task/grant caches. There is no migration or deployed change to roll back.
PROJECT_STATE.md and PROJECT_TRANSITIONS.md are outside this issue's allowlist;
any later verified transition must be recorded through separately authorized work.
