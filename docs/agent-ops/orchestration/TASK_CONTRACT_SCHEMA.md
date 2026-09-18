# GuardEntra Task Contract Schema (#9C-1 / R4)

Machine-readable, human-reviewable **local cache** derived from a GitHub issue
plus explicit Owner/dispatcher fields. The local contract is **evidence/cache
only** — never the authority root.

Authorization that is not present on GitHub from an accepted Owner/dispatcher
identity must remain denied. Sticky local booleans and a local
`source=github-owner-grant` string alone are **not** Owner authority.

Author validation is **GitHub identity allowlist only**, not cryptographic
provenance. Prefer a read-only Issues credential for the writer so the writer
cannot forge grants as the accepted identity.

## Storage

- Schema / docs: this file (repository-backed)
- Per-issue runtime contract: `scripts/guardentra/state/issues/<n>/contract.json`
  (local only; gitignored; cache/evidence)
- Durable nonce ledger: `scripts/guardentra/state/nonce-ledger.json`
  (local only; gitignored; consumed/revoked replay protection)
- Authority channel: GitHub issue `#9C DISPATCH PACKET`,
  `## GUARDENTRA_OWNER_GRANT`, and optional `## GUARDENTRA_GRANT_EVENT`

## Authority vs cache

| Layer | Role |
|---|---|
| GitHub dispatch packet (allowlisted author) | Scope authority: writer, max tier, branch, paths, tests, starting SHA |
| GitHub `GUARDENTRA_OWNER_GRANT` (allowlisted author + real comment URL) | Action authority: single-use grant |
| GitHub `GUARDENTRA_GRANT_EVENT` consumed/revoked (allowlisted author) | Durable terminal nonce state |
| Local `contract.json` | Cache/evidence only; must match live GitHub on mutating gates |
| Local `nonce-ledger.json` | Durable consumed/revoked record keyed by issue+nonce |

Before every `commit` / `push-and-pr` / `merge`, the dispatcher **re-fetches**
the authoritative GitHub dispatch + exact grant nonce/source and refuses on
mismatch or scope widening. Local `authorize` cannot mint Owner authority;
Owner posts a grant, writer runs `sync-grants`.

## Required contract fields

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string | `guardentra.task_contract.v1` |
| `issue_number` | number | GitHub issue number |
| `title` | string | Issue title / task purpose |
| `starting_main_sha` | string | Full 40-hex SHA captured at `start` / bound by dispatch |
| `feature_branch` | string | Authorized feature branch name |
| `selected_writer_tool` | string | e.g. `cursor` (exactly one writer) |
| `persona_role` | string | GuardEntra persona / role label |
| `persona_spec_path` | string | Repo-relative persona file or `none` |
| `access_tier` | string | `T0` \| `T1` \| `T2` (T3/T4 refused for this pilot) |
| `allowed_paths` | string[] | From GitHub dispatch (local widen refused) |
| `prohibited_paths` | string[] | Explicit deny list |
| `prohibited_actions` | string[] | e.g. `autonomous_push`, `sticky_authorization` |
| `acceptance_criteria` | string[] | From issue / dispatch |
| `required_tests` | string[] | From GitHub dispatch |
| `retry_limit` | number | Default `3` |
| `evidence_requirements` | string[] | Mandatory evidence fields |
| `auth_*` | object | Cached single-use grant (see below) |
| `repository` | string | Expected `owner/repo` |
| `created_utc` / `updated_utc` | string | ISO-8601 |
| `attempt_count` | number | Failed correction cycles (persisted before escalate) |

### Auth grant object (local cache)

```json
{
  "enabled": false,
  "head_sha": "",
  "content_digest": "",
  "pr_number": 0,
  "nonce": "",
  "branch": "",
  "source": "",
  "source_ref": "",
  "author_login": "",
  "issued_utc": "",
  "status": "",
  "consumed": false
}
```

Rules:

- Missing grant => denied
- Legacy sticky booleans are ignored and never enable a grant
- `source=github-owner-grant` alone never establishes authority
- `source_ref` must be a real GitHub comment URL (or `issue-body:<n>`)
- `author_login` must be on the Owner/dispatcher allowlist
- Exact `branch`, 40-hex `head_sha`, parseable `issued_utc`, explicit `status=active`
- Commit grants also require 64-hex `content_digest`
- Merge grants also bind `pr_number` + PR head SHA
- Nonce format: `^[A-Za-z0-9_-]{8,128}$`; uniqueness enforced via durable ledger/events
- Successful use records durable `consumed` for the nonce (replay refused on `sync-grants`)
- Missing `status` is **not** defaulted to `active`

### Owner grant schema (`guardentra.owner_grant.v1`)

Posted under `## GUARDENTRA_OWNER_GRANT` by an allowlisted author:

```json
{
  "schema": "guardentra.owner_grant.v1",
  "issue": 59,
  "action": "commit",
  "nonce": "unique-nonce-token",
  "branch": "tooling/controlled-orchestration-pilot",
  "head_sha": "366319343fd44d4077f94169fbf4d2b874f5c1ac",
  "content_digest": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "pr_number": 0,
  "issued_utc": "2026-09-18T00:00:00Z",
  "status": "active"
}
```

### Grant event schema (`guardentra.grant_event.v1`)

Optional GitHub durable terminal marker under `## GUARDENTRA_GRANT_EVENT`:

```json
{
  "schema": "guardentra.grant_event.v1",
  "issue": 59,
  "nonce": "unique-nonce-token",
  "status": "consumed",
  "issued_utc": "2026-09-18T01:00:00Z"
}
```

`status` is `consumed` or `revoked`. A later terminal event/ledger entry blocks replay.

## Defaults (fail closed)

```text
all auth_*.enabled = false
retry_limit = 3
attempt_count = 0
```

Issue text that authorizes planning/implementation does **not** authorize push,
PR, merge, or deploy unless a separate Owner grant is posted on GitHub, synced,
still `active`, not consumed/revoked, and live-revalidated at the mutating gate.

## Example (abridged local cache)

```json
{
  "schema_version": "guardentra.task_contract.v1",
  "issue_number": 59,
  "title": "Build GuardEntra controlled orchestration pilot",
  "starting_main_sha": "366319343fd44d4077f94169fbf4d2b874f5c1ac",
  "feature_branch": "tooling/controlled-orchestration-pilot",
  "selected_writer_tool": "cursor",
  "access_tier": "T2",
  "allowed_paths": [
    "scripts/guardentra.ps1",
    "scripts/guardentra/*",
    "docs/agent-ops/orchestration/*"
  ],
  "required_tests": [
    "powershell -File scripts/guardentra/tests/Run-Tests.ps1"
  ],
  "auth_commit": {
    "enabled": true,
    "head_sha": "366319343fd44d4077f94169fbf4d2b874f5c1ac",
    "content_digest": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "nonce": "abc12345nonce",
    "branch": "tooling/controlled-orchestration-pilot",
    "source": "github-owner-grant",
    "source_ref": "https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-1",
    "author_login": "akurteshi-guardentra",
    "issued_utc": "2026-09-18T00:00:00Z",
    "status": "active",
    "consumed": false
  },
  "repository": "akurteshi-guardentra/guardentra",
  "attempt_count": 0
}
```
