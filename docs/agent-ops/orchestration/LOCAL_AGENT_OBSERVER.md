# GuardEntra Local Agent Observer and Persistent Runner

Issues: #95 (original observer), #106 (live #90 integration)

The local observer is a **read-only workstation view** over GuardEntra's persisted
agent/supervisor state. The persistent runner repeatedly invokes the existing #90
`night-run` command; it does not create a second scheduler, mint authority, or turn a
visible terminal into a writer.

GitHub remains the source of truth. The #88/#90 supervisor remains the execution
authority.

## What changed in #106

The original #95 observer was intentionally merged before the final #90 supervisor
state format existed. It watched `supervisor_state.json`. The merged #90 supervisor
writes `supervisor.json`.

#106 upgrades the existing observer instead of creating another control plane:

- prefers the real `supervisor.json`
- retains `supervisor_state.json` and `agent_state.json` as compatibility fallbacks
- shows the nested snapshot branch and exact head SHA
- resolves the isolated worktree from `contract.json`
- validates the persisted worker PID and process start time
- classifies heartbeat freshness
- displays a bounded, redacted provider telemetry tail
- adds a persistent runner that repeatedly calls the existing `night-run` command
- publishes idempotent, redacted terminal checkpoints to the bound GitHub issue
- adds dedicated VS Code/Cursor panes for Codex, Cursor, Gemini/Cloud, and Grok/xAI

## Start the visible local factory from VS Code or Cursor

Use **Terminal -> Run Task** and choose:

`GuardEntra: Local factory (runner + agent panes)`

That launches these panes in parallel:

- GuardEntra local supervisor runner
- Codex observer
- Cursor observer
- Gemini / Cloud observer
- Grok / xAI observer

The provider processes themselves remain exact-path, bounded, headless children of the
GuardEntra supervisor. The terminals are observers only.

You can also launch panes individually:

- `GuardEntra: Local supervisor runner`
- `GuardEntra: Observe all agents`
- `GuardEntra: Observe Codex`
- `GuardEntra: Observe Cursor`
- `GuardEntra: Observe Gemini / Cloud`
- `GuardEntra: Observe Grok / xAI`
- `GuardEntra: Provider doctor snapshot`

## Public CLI

From the repository root:

```powershell
.\scripts\guardentra.ps1 observe
.\scripts\guardentra.ps1 observe codex
.\scripts\guardentra.ps1 observe cursor
.\scripts\guardentra.ps1 observe gemini,cloud
.\scripts\guardentra.ps1 observe grok,xai
.\scripts\guardentra.ps1 observe -Once
```

Start the persistent local supervisor:

```powershell
.\scripts\guardentra.ps1 runner
```

The default cycle is 30 seconds. A one-cycle validation is:

```powershell
.\scripts\guardentra.ps1 runner -Once
```

Checkpoint publishing is enabled by default. To validate the runner without publishing:

```powershell
.\scripts\guardentra.ps1 runner -Once -NoPublish
```

## Start automatically when the Owner signs in

#106 includes a least-privilege Scheduled Task helper. It uses the current interactive
Windows user, `RunLevel=Limited`, and stores no password.

Check status:

```powershell
.\scripts\guardentra.ps1 runner-task status
```

Install or refresh the logon task:

```powershell
.\scripts\guardentra.ps1 runner-task install -IntervalSeconds 30
```

Remove it:

```powershell
.\scripts\guardentra.ps1 runner-task remove
```

The equivalent VS Code/Cursor task is:

`GuardEntra: Install runner at sign-in`

Installation is an explicit local workstation action. Repository merge does **not**
silently change Windows Task Scheduler.

## What the observer displays

For a live #90 supervisor state, the observer can show:

- issue
- provider and reviewer
- phase
- exact worker PID
- PID state: `alive`, `not_running`, `pid_reused`, or `idle`
- heartbeat age and `fresh` / `stale` classification
- local verification stage
- attempt count
- handoff count
- feature branch
- exact candidate HEAD
- isolated worktree when present in the issue contract
- redacted blocker and Owner gate
- bounded redacted provider stdout/stderr tail

The display is derived from persisted state; it does not infer provider activity from a
terminal title or process name.

## Provider panes versus provider authority

Provider labels correspond to #90's provider pool:

- Codex
- Cursor
- Gemini / Cloud
- Grok / xAI

A pane can be empty or show a blocked/auth state. That does **not** mean a provider was
successfully invoked. Provider runtime state is reported only when #90 actually
observes it.

The observer never:

- selects a provider
- modifies a provider policy
- writes a worktree
- acquires a writer lease
- grants commit/push/merge/deploy authority
- authenticates a provider
- changes IAM, secrets, DNS, or cloud configuration

## Redacted provider telemetry

#90 continues to capture stdout/stderr in memory for bounded provider execution.
#106 adds a separate telemetry tail for local observation.

The telemetry tail:

- is redacted before persistence
- is capped at 2 KiB
- strips secret-like bearer/token/API-key/password values
- does not replace the full provider response used internally by the adapter
- does not grant authority
- is cleared at the beginning of the next provider execution

Raw prompts, credentials, raw authentication output, and unredacted provider output
must never be persisted for the observer.

## Local completion checkpoint publishing

The persistent runner scans registered worktrees after each bounded `night-run`
cycle. It publishes only terminal supervisor states:

- `owner_gate`
- `blocked`

Published checkpoint schema:

`guardentra.local_checkpoint.v1`

It contains only redacted operational metadata:

- issue
- phase
- provider
- reviewer
- branch
- exact head
- verification stage
- test count
- attempt count
- handoff count
- blocker
- Owner gate
- observation time

The provider telemetry tail and raw test output are deliberately excluded.

Publication is idempotent. A SHA-256 digest excludes only `observed_utc`; an unchanged
checkpoint is not posted again. The local dedupe ledger is written only after GitHub
confirms publication. A failed publish is retried on a later runner cycle.

This is the bridge that lets remote GitHub/ChatGPT automation see a local agent finish
without waiting for the Owner to paste a status block manually.

## Security boundary

Visible terminals remain observers.

Provider execution still uses the #90 exact executable bindings, process watchdog,
exclusive writer lease, persisted heartbeat, task packet, scope validator, deterministic
tests, independent reviewer, correction budget, and Owner gates.

A visible terminal must never become an alternate interactive writer because doing so
would bypass the controls the supervisor is designed to enforce.

## Verification

Windows CI validates:

- live `supervisor.json` parsing
- backward compatibility with the old #95 state filename
- PID/start-time liveness
- heartbeat freshness
- branch/head/worktree extraction
- malformed-state isolation
- telemetry redaction
- runner checkpoint idempotency
- retry after checkpoint publication failure
- no provider-tail leakage into GitHub checkpoints
- terminal-state-only publishing
- least-privilege/no-password Scheduled Task specification

The full GuardEntra dispatcher suite separately validates the #90 process transport,
leases, failover, watchdog, correction loop, and provider telemetry integration.
