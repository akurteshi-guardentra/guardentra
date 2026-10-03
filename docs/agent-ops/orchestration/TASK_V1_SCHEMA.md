# GuardEntra Task Schema (`guardentra.task.v1`) — #88 Phase A

Versioned, machine-readable task contract derived from the authoritative
GitHub issue and its `#9C DISPATCH PACKET`. This is the **first slice** of
the Agent Control Plane described in #88: a headless, strictly-validated
schema and generator. The runner/adapters are documented in AGENT_RUNNER.md;
neither schema grants autonomous execution or Owner authority.

This is **not** the same artifact as
[`TASK_CONTRACT_SCHEMA.md`](./TASK_CONTRACT_SCHEMA.md)
(`guardentra.task_contract.v1`, i.e. `contract.json`). That file is the
dispatcher's own local authorization **cache** — it embeds live single-use
grant state (nonces, digests, head SHAs) and must never leave the local
worktree unredacted. `guardentra.task.v1` is the opposite: a routing/adapter
-facing task description, deliberately stripped of any live grant/nonce
data, safe to pass to a future runner or tool adapter (#88 Phase B/C).

## Command

```powershell
.\scripts\guardentra.ps1 task <issue>
```

Read-only with respect to git/GitHub: mints no authorization, performs no
commit/push/merge/deploy. Requires `start` to have already provisioned the
issue's contract (`contract.json`) and must be run from that issue's own
isolated worktree (`#66` binding, enforced by
`Assert-GuardentraWorktreeMatchesContract`).

Writes `scripts/guardentra/state/issues/<n>/task.v1.json` (local, gitignored
— same storage tier as `contract.json`).

## Generation and validation pipeline

1. Read the local `contract.json` (already bound to the authoritative
   dispatch at `start` time), then revalidate against live GitHub dispatch
   and the independently derived isolated-worktree identity.
2. Build the `guardentra.task.v1` object from the contract + GitHub issue
   record (`New-GuardentraTaskV1`).
3. **Strict validation, fail closed** (`Assert-GuardentraTaskV1Valid`):
   checks every required key/type and fixed Owner-boundary policy; refuses
   T3/T4, extra grant-shaped fields, noncanonical/traversing paths,
   a missing objective, an unrecognized writer, a missing or
   `main` feature branch, a malformed starting SHA, or empty/ambiguous
   `allowed_paths` / `prohibited_paths` / `required_tests` (including an
   unbounded entry such as `*`, `/`, or `**` in `allowed_paths`).
4. **Live dispatch match** (`Assert-GuardentraTaskV1MatchesDispatch`):
   re-fetches the authoritative GitHub dispatch envelope and refuses if the
   generated task's issue, `feature_branch`, `writer_tool`, `starting_sha`,
   `allowed_paths`, or `required_tests` diverge, its access tier exceeds the
   dispatch ceiling, or the pilot deny/stop policy has been weakened
   from it — the generated task must exactly match GitHub, never a stale or
   locally-widened copy.
5. Write the object deterministically to `task.v1.json` and print it.

## Fields

| Field | Type | Notes |
|---|---|---|
| `schema` | string | `guardentra.task.v1` |
| `issue` | number | GitHub issue number |
| `objective` | string | Issue title |
| `source_requirement_ids` | string[] | `["issue-<n>"]` |
| `reviewer_tool` | string | Reserved; empty until a dispatch packet encodes one |
| `writer_tool` | string | Exactly one writer (`cursor`\|`codex`\|`claude`\|`claude-code`) |
| `persona_role` / `persona_spec_path` | string | From the contract (advisory only — grants no authority; see `docs/agent-ops/personas/`) |
| `access_tier` | string | `T0`\|`T1`\|`T2` (T3/T4 refused by this pilot) |
| `starting_sha` | string | 40-hex, must match live dispatch when dispatch specifies one |
| `feature_branch` | string | Must not be `main` |
| `isolated_worktree_path` | string | `#66` isolated worktree, never the shared primary checkout |
| `allowed_paths` / `prohibited_paths` | string[] | Sorted-unique; must be non-empty; no unbounded entry |
| `required_tests` | string[] | Sorted-unique; must be non-empty |
| `acceptance_criteria` | string[] | From the GitHub issue's own checkbox list, in source order (may be empty — `(see GitHub issue)` prose is not fabricated into criteria) |
| `dependencies` | string[] | `#NN` references parsed from a `## Dependency`/`## Dependencies` issue section; empty if none |
| `stop_conditions` | string[] | `contract.prohibited_actions` plus `scope_expansion`, `ambiguous_authority`, `retry_limit_exceeded` |
| `authorization_boundaries` | object | Fixed policy statement (`requires_owner_grant_for`, `autonomous_merge`/`push`/`deploy` = `false`) — **not** a live echo of `contract.auth_*`; live grant state stays in `contract.json`/`status` only |
| `generated_utc` | string | ISO-8601 generation timestamp (not part of the determinism guarantee — see below) |

## Determinism

Regenerating a task from the same authoritative contract + dispatch state
always yields the same field set, key order, and scope-array content
(arrays are sorted-unique). `generated_utc` is a real timestamp and is
expected to differ between generations, exactly like `contract.json`'s own
`updated_utc` — this is not treated as a determinism violation.

## Non-goals of this slice

The runner and manual adapter interface are described in AGENT_RUNNER.md.
This schema adds no automatic evidence posting to GitHub, reviewer routing,
autonomous tool execution, or Owner-gate CLI beyond the existing
`sync-grants`/`commit`/`push-and-pr`/`merge`/`deploy-*` (Phase G), and no
dashboard (Phase H). Those remain separately authorized follow-up work.
