# #9C Pilot Notes

Issue: [#59](https://github.com/akurteshi-guardentra/guardentra/issues/59)

## First pilot writer

- Tool: Cursor (`tool:cursor`)
- Persona: Engineering Manager / Architect
  (`docs/agent-ops/personas/engineering-manager.md`)
- Access: T1/T2 repository tooling only
- Branch: `tooling/controlled-orchestration-pilot`
- Starting SHA: `366319343fd44d4077f94169fbf4d2b874f5c1ac`

## R4 authority closure

- Grant/dispatch author allowlist + real comment provenance (`source_ref`)
- Live revalidation of GitHub dispatch + exact grant before commit/push/merge
- Strict grant fields: branch, 40-hex SHA, 64-hex digest (commit), issued_utc, explicit active status, nonce
- Durable nonce consumed/revoked ledger (replay refused on `sync-grants`)
- Task packet instructs `sync-grants` only (no local authorize mint path)
- Schema docs at R4 cache-vs-authority semantics

## R2/R3 gate hardening

- Single-use grants bound to exact HEAD (merge also binds PR number + head SHA)
- Required CI gate demands named `verify` SUCCESS; empty/missing/pending/fail refuse
- Push requires clean worktree, allowlist, required tests, HEAD-bound grant
- Commit runs staged-name validation, `git diff --cached --check`, required tests
- Retry increment persists before escalate
- `start` refuses if GitHub issue cannot be fetched
- Changed files enumerated with `git status --porcelain -uall`
- `-AllowDirtyWorktree` removed
- Repository origin restricted to accepted GitHub HTTPS/SSH forms
- Evidence refuses wrong branch
- Local authorize cannot mint; commit digest binding; `commit-and-pr` removed; T3/T4 blocked

## Retry / escalation

Failed correction cycles are counted in the local contract (`attempt_count`).
At `retry_limit` (default 3), the incremented count is saved, then commands stop
and escalate to Owner.

## Secret safety

Dispatcher and evidence output redact common secret patterns and never print
Secret Manager values. Prefer resource names and redacted metadata.
