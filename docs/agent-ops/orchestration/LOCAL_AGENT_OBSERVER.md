# GuardEntra Local Agent Observer

Issue: #95

The observer is a **read-only workstation view** over persisted GuardEntra agent/supervisor state. It does not select providers, acquire a writer lease, mutate a worktree, grant authority, commit, push, merge, deploy, or authenticate a provider.

## Start from VS Code / Cursor

Run the task:

`GuardEntra: Observe local agents`

or from PowerShell:

```powershell
.\scripts\guardentra\Observe-LocalAgents.ps1
```

A one-shot snapshot is available with:

```powershell
.\scripts\guardentra\Observe-LocalAgents.ps1 -Once
```

Filters:

```powershell
.\scripts\guardentra\Observe-LocalAgents.ps1 -Issue 90
.\scripts\guardentra\Observe-LocalAgents.ps1 -Provider codex
```

## What it displays

When the corresponding persisted state exists, the observer shows:

- issue
- provider and reviewer
- phase/state
- worker PID
- heartbeat age
- verification stage
- attempt count
- handoff count
- branch/worktree when persisted
- redacted blocker and owner-gate text

It prefers `supervisor_state.json` and falls back to legacy `agent_state.json`.

Malformed state is shown as `INVALID_STATE` for that issue instead of crashing the whole observer.

## Security boundary

The observer intentionally selects metadata fields instead of printing raw JSON. Secret-like values in displayed text are redacted. It never prints provider authentication output, credential values, API keys, tokens, or raw prompts.

Provider stdout/stderr tailing is **not enabled yet**. #90 currently captures provider process output in memory and has an unresolved Windows process-finalization regression. A redacted persisted tail can be added only after #90 safely defines and tests that evidence format.

## Why workers remain headless

#90 uses exact-path, bounded child processes with redirected streams. That remains the execution authority. Visible terminals are observers only; they must never become a second writer or bypass the supervisor lease.

## Windows startup

This issue intentionally does not install a Scheduled Task or alter workstation startup configuration. The persistent runner belongs to #90 after its process-lifecycle suite is green. Once #90 is accepted, a separate least-privilege installation step can launch the GuardEntra supervisor on sign-in and the observer can attach to its persisted state.
