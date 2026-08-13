# GuardEntra GitHub Label Taxonomy

GitHub Issues are the operational dispatch board. Labels classify work; they do not prove implementation, review, merge, deployment, or live-system state.

## Application rules

- Apply one phase label when the delivery phase is known.
- Apply every affected area label.
- Apply exactly one highest applicable risk label.
- Apply exactly one primary writer label after the owner assigns the writer.
- Apply one independent AI review label; the reviewer must be different from the writer.
- Tool labels are per-issue assignments, not permanent ownership or authority.
- Status labels reflect readiness, not implementation completeness.
- The issue body and task packet remain authoritative for scope, acceptance criteria, branch ownership, and owner-controlled merge/deployment decisions.
- If classification is uncertain, use `status:not-ready` and resolve the ambiguity before implementation.

## Phase

| Label | Meaning |
|---|---|
| `phase:P0` | Pre-spine blocker or investigation |
| `phase:sprint-10` | Regional infrastructure and routing |
| `phase:sprint-11` | PostgreSQL audit layer and durable outbox |
| `phase:sprint-12` | Hash chain, checkpoints, and verification |
| `phase:sprint-13` | Validation, rate controls, and evidence hardening |
| `phase:sprint-14` | End-to-end verification, monitoring, and recovery |

## Area

| Label | Repository area |
|---|---|
| `area:frontend` | `src/pages/`, `src/components/`, frontend state and tests |
| `area:backend` | `server/`, API routes, middleware, services, and server tests |
| `area:firebase` | `firestore.rules`, `storage.rules`, Firebase configuration and emulator tests |
| `area:database` | PostgreSQL code, `migrations/`, schemas, grants, and recovery |
| `area:infrastructure` | `infra/`, Terraform, GCP resources, IAM, and environment topology |
| `area:security` | Authentication, authorization, tenant boundaries, keys, secrets, or security controls |
| `area:audit` | Audit events, outbox, chain, verification, and audit evidence |
| `area:ai` | AI routes, model interaction, provenance, validation, and rate controls |
| `area:evidence` | Evidence upload, scanning, review state, retention, and access |
| `area:observability` | Logs, metrics, alerts, scheduled verification, and incident response |
| `area:compliance` | Auditor exports, retention, policy mapping, and compliance evidence |
| `area:docs` | Documentation-only changes |
| `area:repo-ops` | Repository governance, templates, labels, and developer workflow |

## Risk

| Label | Meaning |
|---|---|
| `risk:critical` | Tenant isolation, audit integrity, IAM, keys, production data, or release-hard-gate impact |
| `risk:high` | Security/privacy/data-integrity impact requiring strong tests and owner-controlled merge |
| `risk:medium` | Product behavior or operational change with bounded impact |
| `risk:low` | Trivial documentation or repository metadata with no behavior/control change |

## Primary writer

| Label | Meaning |
|---|---|
| `writer:codex` | Codex is the assigned single writer for this issue |
| `writer:claude-code` | Claude Code is the assigned single writer |
| `writer:cursor` | Cursor is the assigned single writer |
| `writer:antigravity` | Antigravity is the assigned single writer or investigator |
| `writer:cloud-code` | Google Cloud Code supports the assigned GCP operational task |

Only one primary writing tool owns a branch at a time. Changing this label requires updating the task packet and recording the handoff.

## Independent AI review

| Label | Meaning |
|---|---|
| `reviewer:codex` | Codex independently reviews another tool's committed diff |
| `reviewer:claude-code` | Claude Code independently reviews another tool's committed diff |
| `reviewer:copilot` | GitHub Copilot provides automated PR review |
| `reviewer:cursor` | Cursor reviews implementation or test behavior it did not author |
| `reviewer:antigravity` | Antigravity performs independent UI/browser/accessibility review |

The repository currently requires no additional human-reviewer label or approval count. The owner, `@akurteshi-guardentra`, controls merge and deployment decisions. For security-sensitive work, the owner must inspect the PR evidence and explicitly authorize merge; this is an owner gate, not a separate reviewer assignment.

## Type and readiness

| Label | Meaning |
|---|---|
| `type:investigation` | Read-only investigation; implementation needs a separate issue if confirmed |
| `status:not-ready` | Requirements, authority, acceptance criteria, dependencies, or owner decision are missing |
| `status:ready` | Task packet, writer, independent AI reviewer, and acceptance evidence are defined |
| `status:blocked` | Work started or was ready but an external dependency prevents progress |

## Initial backlog mapping

| Issue | Phase | Areas | Risk | Writer | Independent AI review |
|---|---|---|---|---|---|
| #10 P0-1 | `phase:P0` | backend, Firebase, security | high | Cursor | Codex or Claude Code |
| #11 P0-2 | `phase:P0` | frontend, backend, evidence | investigation | Antigravity | Codex |
| #12 F1 | `phase:sprint-10` | infrastructure, backend, security | critical | Codex | Claude Code |
| #13 F2 | `phase:sprint-11` | backend, database, audit | critical | Claude Code | Codex |
| #14 F3 | `phase:sprint-12` | backend, database, audit, security | critical | Claude Code | Codex |
| #15 F4 | `phase:sprint-14` | backend, observability, security | critical | Codex | Claude Code |
| #16 F5 | determined by task packet | backend, database, compliance, security | high | Codex | Claude Code |
| #17 F6 | `phase:sprint-13` | backend, AI, audit, security | high | Claude Code | Codex |

Repository administrators create these labels in GitHub and apply them to the mapped issues. Until then, the issue body's classification fields remain the durable assignment record.
