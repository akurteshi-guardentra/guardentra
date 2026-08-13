# GuardEntra Repository Map

Verified against GitHub `main` at `f76a8cfbfe595d4d1d7265afa30828a6481eddb4` on 2026-08-12. This is a navigation map, not a complete file listing or proof that a feature works.

## Existing paths

| Path | Purpose |
|---|---|
| `src/` | React application, shared libraries, hooks, pages, and tests |
| `server/` | API routes, middleware, Firebase/region access, audit code, and server tests |
| `src/tests/` | Frontend/domain, Firestore, Storage, portal, audit, and regression tests |
| `infra/` | Terraform environments and Cloud SQL, Secret Manager, and VPC modules |
| `migrations/audit/` | Audit database schema and role migrations |
| `scripts/` | Migration, Phase 2, proof, authentication, and operational helpers |
| `.github/workflows/` | Application and infrastructure CI workflows |
| `docs/` | Architecture, roadmap, known issues, environment, Phase 2, migration, and operational documentation |
| `firestore.rules` / `storage.rules` | Repository source for Firebase security rules; deployed state must be checked separately |
| `firebase.json` / `.firebaserc` | Firebase targets and local/deploy configuration |
| `apphosting.yaml` / `Dockerfile` | Hosting/runtime build and deployment configuration |
| `package.json` | Scripts, dependencies, and executable project checks |

## Agent-operations paths added by this PR

| Path | Purpose |
|---|---|
| `AGENTS.md` | Root authority, execution, evidence, and review rules |
| `.github/pull_request_template.md` | Mandatory PR evidence/impact fields |
| `docs/agent-ops/` | Source-of-truth, tool routing, task packet, handoff, completion evidence, repository map, and cross-review log |

## Not added by this PR

- Tool-specific adapters under `.claude/`, `.cursor/`, `.agents/`, or `.codex/`
- Agency Agents source prompts or generated personas
- Master Delivery Plan or historical planning drafts
- New application, infrastructure, migration, CI, or deployment changes

Reverify this map when major top-level paths change. Never use it as proof that a listed path is deployed, active, secure, or complete.
