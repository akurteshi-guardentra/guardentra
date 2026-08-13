# GuardEntra Repository Map

Verified against GitHub `main` at `c2e9d33bb1787e11b8d294377f44e506b73f74a2` on 2026-08-13. This is a navigation map, not a complete file listing or proof that a feature works.

## When to use this map

Read this map after selecting a GitHub issue and before completing its task packet. Use the issue's area labels to locate the likely code, tests, documentation, infrastructure, and operational evidence.

Reverify and update this map when a pull request adds, removes, renames, or materially repurposes a top-level path or a major domain directory. Ordinary component additions do not require a map update.

## Application and platform paths

| Path | Purpose |
|---|---|
| `src/` | React application, shared libraries, hooks, pages, components, and browser-side domain logic |
| `src/tests/` | Frontend/domain, Firestore, Storage, portal, audit, rule, and regression tests |
| `server.ts` | Express application entry point and runtime composition |
| `server/` | API routes, middleware, Firebase/region access, audit code, and server-side libraries |
| `infra/` | Terraform environments and Cloud SQL, Secret Manager, networking, monitoring, and related modules |
| `migrations/audit/` | Audit database schemas, grants, roles, and migrations |
| `scripts/` | Migration, Phase 2, proof, authentication, verification, and operational helpers |
| `.github/workflows/` | Application and infrastructure CI workflows |
| `firestore.rules` / `storage.rules` | Repository source for Firebase security rules; deployed state must be checked separately |
| `firebase.json` / `.firebaserc` | Firebase targets, emulators, and local/deployment configuration |
| `apphosting.yaml` / `Dockerfile` | Hosting/runtime build and deployment configuration |
| `package.json` | Scripts, dependencies, and executable project checks |

## Product and operational documentation

| Path | Purpose |
|---|---|
| `docs/PRODUCT_FOCUS.md` | Current product focus and boundaries |
| `docs/ARCHITECTURE_FOUNDATION.md` | Approved architecture foundation and deferred designs |
| `docs/PRODUCT_ROADMAP_2026.md` | Product delivery history and roadmap |
| `docs/KNOWN_ISSUES.md` | Known defect/risk history and verification notes |
| `docs/ENVIRONMENTS.md` | Environment descriptions and operational boundaries |
| `docs/SECRETS.md` | Secret-handling guidance; never contains live secret values |
| `docs/` | Additional migration, UX, release, testing, architecture, and operational documentation |

## Agent operations

| Path | Purpose |
|---|---|
| `AGENTS.md` | Root authority, mandatory start procedure, execution rules, evidence gate, and review rules |
| `.github/pull_request_template.md` | Mandatory PR evidence and impact fields |
| `docs/agent-ops/SOURCE_OF_TRUTH.md` | Repository-versus-live-state authority and safe evidence capture |
| `docs/agent-ops/TOOLCHAIN.md` | Per-issue tool candidates, access tiers, and human controls |
| `docs/agent-ops/TOOL_DISPATCH.md` | Dispatcher sequence and routing questions |
| `docs/agent-ops/TASK_PACKET_TEMPLATE.md` | Scope, ownership, tests, approvals, and handoff for one task |
| `docs/agent-ops/AGENT_HANDOFF.md` | Writer-to-reviewer transfer procedure |
| `docs/agent-ops/COMPLETION_EVIDENCE_TEMPLATE.md` | Mandatory seven-field completion evidence |
| `docs/agent-ops/LABEL_TAXONOMY.md` | GitHub issue labels for phase, area, risk, writer, review, and readiness |
| `docs/agent-ops/REPOSITORY_TREE.md` | This navigation map |
| `docs/agent-ops/CROSS_REVIEW_LOG.md` | Reconciled governance history and deferred scope |

## Label-to-path routing

| Label | Start inspection at |
|---|---|
| `area:frontend` | `src/pages/`, `src/components/`, related hooks/libraries, and `src/tests/` |
| `area:backend` | `server.ts`, `server/`, and server/route tests |
| `area:firebase` | `firestore.rules`, `storage.rules`, `firebase.json`, and emulator tests |
| `area:database` | `migrations/`, database adapters, audit repositories, and recovery scripts |
| `area:infrastructure` | `infra/`, environment docs, Terraform checks, and live-state evidence |
| `area:security` | Auth middleware, rules, IAM/Terraform, validation, negative tests, and security docs |
| `area:audit` | Audit routes/libraries, migrations, proof scripts, and chain/outbox tests |
| `area:ai` | `server/routes/ai.ts`, rate limiting, validation, provenance, and AI tests |
| `area:evidence` | Evidence UI/domain modules, Storage rules, scan/review flow, and evidence tests |
| `area:observability` | Monitoring modules, workflows, verification jobs, alerts, and incident docs |
| `area:compliance` | Export routes, audit data, retention documentation, and authorization tests |
| `area:docs` / `area:repo-ops` | `AGENTS.md`, `.github/`, and `docs/` |

## Important boundaries

- A path in this map is not proof that its behavior is active, secure, complete, deployed, or configured correctly.
- GitHub proves repository state; the relevant live Firebase/GCP environment proves runtime state.
- The user-provided Master Delivery Plan is not currently stored in this repository. Issues must include exact source locators until an approved repository copy is added.
- Tool-specific adapters under `.claude/`, `.cursor/`, `.agents/`, or `.codex/` are not part of the merged governance package.
- Agency Agents reference material does not grant authority or replace the root rules.
