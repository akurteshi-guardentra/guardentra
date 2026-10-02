# GuardEntra Controlled Orchestration (Action #9C)

Repository-controlled local dispatcher and evidence tooling for Owner-gated work.

Runtime: `scripts/guardentra.ps1` and `scripts/guardentra/`.

## Commands

```powershell
.\scripts\guardentra.ps1 start <issue> <writer> [-Branch <name>] [-AccessTier T0|T1|T2]
.\scripts\guardentra.ps1 sync-grants <issue> [-Action <gate>]
.\scripts\guardentra.ps1 commit <issue> [-Message <msg>]
.\scripts\guardentra.ps1 push-and-pr <issue>
.\scripts\guardentra.ps1 merge <issue> -Pr <n>
.\scripts\guardentra.ps1 evidence <issue>
.\scripts\guardentra.ps1 status <issue>
.\scripts\guardentra.ps1 task <issue>
.\scripts\guardentra.ps1 agent run <issue>
.\scripts\guardentra.ps1 agent status <issue>
.\scripts\guardentra.ps1 agent watch
```

## Authorization (R4)

- Local `authorize` **cannot mint** Owner authority (command refused).
- Owner/Chief Dispatcher posts `## GUARDENTRA_OWNER_GRANT` JSON on the GitHub issue.
- Writer runs `sync-grants` to cache grants (evidence only).
- Grant/dispatch authors must be on the Owner/dispatcher allowlist; real comment id/url retained as `source_ref`.
- Author validation is identity allowlist only — **not** cryptographic provenance. Prefer read-only Issues credentials for the writer.
- Local `source=github-owner-grant` alone is never authority; commit/push/merge revalidate live GitHub dispatch + exact grant.
- Commit grants bind exact branch, HEAD, 64-hex `content_digest`, `issued_utc`, explicit `status=active`, and nonce.
- Consumed/revoked nonces are durably recorded (local ledger + optional GitHub `GUARDENTRA_GRANT_EVENT`); replay refused.
- Merge grants bind PR number + head SHA; CI requires required `verify` PASS/SUCCESS only.
- Dispatch envelope binds writer, max tier (T2), branch, paths, tests.
- Missing contract on an existing feature branch fails closed (no invented starting SHA).
- `commit-and-pr` removed for this pilot.
- T3/T4 refused.

## Related

- `docs/agent-ops/orchestration/TASK_CONTRACT_SCHEMA.md`
- `docs/agent-ops/orchestration/TASK_V1_SCHEMA.md` (`guardentra.task.v1`, #88 Phase A)
- `docs/agent-ops/orchestration/AGENT_RUNNER.md` (`guardentra.agent_result.v1`, adapters, runner, #88 Phases B-D/F)
- `docs/agent-ops/orchestration/ISSUE_88_CORRECTION_3.md` (PS 5.1 empty `gh pr list` fix + Windows CI dispatcher job)
- `docs/agent-ops/orchestration/PILOT.md`
- `AGENTS.md`
