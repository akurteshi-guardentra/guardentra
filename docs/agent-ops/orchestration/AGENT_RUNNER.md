# GuardEntra Agent Result / Runner / Adapters — #88 Phases B–D, F (first slice, continued)

Continuation of the #88 "Agent Control Plane" first implementation slice,
covering the Chief Dispatcher review's remaining required items beyond
Phase A (`docs/agent-ops/orchestration/TASK_V1_SCHEMA.md`): the
`guardentra.agent_result.v1` schema, the tool adapter interface, a local
runner/state-machine skeleton, evidence normalization, and reuse of the
existing bounded correction loop. Still headless; still no UI, no
dashboard (Phase H), no automatic GitHub evidence posting (Phase D's
posting half), no reviewer routing (Phase E), and no Owner-gate CLI beyond
what already exists (Phase G) — those remain separately authorized
follow-up work.

## Commands

```powershell
.\scripts\guardentra.ps1 agent run <issue>
.\scripts\guardentra.ps1 agent status <issue>
.\scripts\guardentra.ps1 agent watch
```

All read-mostly: `agent run` may write `agent_state.json` and run the
issue's own required tests, but never commits, pushes, merges, or deploys,
and mints no authorization. `agent status` / `agent watch` are pure reads.

## `guardentra.agent_result.v1`

Normalized, tool-agnostic evidence built from **real** git/test state
(`New-GuardentraAgentResultV1` in `Commands.ps1`) — never from an adapter's
own claims:

| Field | Notes |
|---|---|
| `schema` | `guardentra.agent_result.v1` |
| `issue` / `writer` | From the local contract |
| `status` | One of: `manual_handoff_required`, `tests_failed`, `review_ready`, `blocked` |
| `branch` / `starting_sha` / `head_sha` | Real `git` state; branch must not be `main` |
| `changed_files` | Real `git diff`/`status`-derived list, sorted-unique |
| `tests` | Output of the issue's own required-tests command |
| `worktree_clean` | Informational snapshot, not a gate (mirrors the seven-field evidence gate's "exact remaining working-tree state") |
| `deployment` | Always the literal `none` in this slice |
| `blockers` | Human-readable reasons, e.g. adapter capability detail |

`Assert-GuardentraAgentResultV1Valid` is strict and fail-closed, and is the
mechanism that satisfies "malicious/untrusted agent result cannot mint
authority": **only** the fixed field list above is ever accepted — a
result carrying an extra `nonce`, `content_digest`, `auth_commit`, or any
other grant-shaped key is refused outright, before it is ever treated as
trustworthy. Nothing in this dispatcher reads `agent_result` fields as
authorization input in the first place; `contract.auth_*` is only ever set
by the existing `sync-grants`/live-dispatch-revalidation path.
`Assert-GuardentraAgentResultV1WithinScope` additionally refuses a result
whose `changed_files` fall outside the contract's own allowlist (scope
widening).

## Tool adapters (`Adapters.ps1`)

One common contract (`CanRun`, `StartTask`, `ResumeTask`, `CollectResult`,
`Cancel`) that every writer tool would implement. This slice:

- **Capability-detects, never fakes.** `Test-GuardentraAdapterCanRun`
  checks for a real, locally-resolvable non-interactive CLI binary
  (`claude` for `claude`/`claude-code`, `codex` for `codex`). `cursor` has
  no verified reliable non-interactive CLI in `docs/agent-ops/TOOLCHAIN.md`,
  so it is intentionally absent from the mapping rather than guessed at.
- **Never autonomously drives another AI tool's session.** Doing so would
  be an unsupervised, unbounded action outside every access-tier and
  Owner-gate control this dispatcher otherwise enforces. `StartTask` /
  `ResumeTask` / `Cancel` therefore always report `manual_handoff_required`
  in this slice, whether or not a CLI was detected — honest per #88's own
  "do not fake support for a tool that lacks a reliable CLI/API".
- `CollectResult` is interface-completeness only; real evidence collection
  is tool-agnostic (git/tests) and lives in `New-GuardentraAgentResultV1`,
  not in a per-adapter stub.

## Runner / state machine (`Invoke-GuardentraAgentRun`)

Restart-safe: persists `scripts/guardentra/state/issues/<n>/agent_state.json`
(`guardentra.agent_state.v1`: `schema`, `issue`, `writer`, `state`,
`adapter_can_run`, `last_result`, `updated_utc`) and reads it back on every
invocation instead of starting over — including after a real process
restart, since state lives on disk, not in memory.

Per run:

1. `#66` worktree binding (`Assert-GuardentraWorktreeMatchesContract`) and
   branch match, reused as-is — a wrong-worktree invocation refuses before
   any evaluation.
2. If nothing has been committed or is pending since `starting_main_sha`:
   `manual_handoff_required` (a genuinely fresh task is always a hand-off
   in this slice — see Adapters above).
3. Otherwise: the pending/committed changed-files set is checked against
   the contract's allowlist (scope widening refused before anything else),
   then the issue's own required-tests command runs
   (`Invoke-GuardentraRequiredTestsSafe`, a non-throwing wrapper around the
   existing `Invoke-GuardentraRequiredTests`) and the **same**
   `contract.attempt_count` / `retry_limit` counter `commit` /
   `push-and-pr` already use is incremented on failure
   (`tests_failed`) or reset on success (`review_ready`) via the existing
   `Register-GuardentraAttempt` / `Test-GuardentraRetryGate`. There is
   exactly one correction-loop counter and one scope-allowlist check in the
   whole dispatcher; the runner does not duplicate either.
4. The resulting `agent_result.v1` is strictly validated and scope-checked
   before being persisted or printed.

The runner never calls `commit`, `push-and-pr`, `merge`, or `deploy-*` —
those remain separately Owner-gated commands, unchanged by this slice.

`agent watch` is a bounded, single-pass, read-only listing across every
issue with a persisted `agent_state.json` — not a background daemon and not
the #88 Phase H dashboard (separate, out of scope here).
