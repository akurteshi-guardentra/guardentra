# GuardEntra Repository Map

Verified against GitHub `main` at `c2e9d33bb1787e11b8d294377f44e506b73f74a2` on 2026-08-13. This is a navigation map, not a complete file listing or proof that a feature works, is deployed, secure, or complete.

## When to read this map

Read it before classifying an issue (`area:` labels map to these paths), before choosing a writer, and before editing so work stays in the intended layer.

## When to update this map

Update it after a merge that adds, removes, or renames a top-level path, agent-ops contract, or hosting/CI entry point. Reverify against the current GitHub `main` SHA and date; do not describe paths as “added by this PR” after they already exist on `main`.

## Current paths

| Path | Purpose |
|---|---|
| `src/` | React application, shared libraries, hooks, pages, and tests |
| `src/tests/` | Frontend/domain, Firestore, Storage, portal, audit, and regression tests |
| `server/` | API routes, middleware, Firebase/region access, audit code, and server tests |
| `server.ts` | Process entrypoint (bind `0.0.0.0` and `process.env.PORT` or `8080`) |
| `infra/` | Terraform environments and Cloud SQL, Secret Manager, and VPC modules |
| `migrations/audit/` | Audit database schema and role migrations |
| `scripts/` | Migration, Phase 2, proof, authentication, and operational helpers |
| `.github/workflows/` | Application and infrastructure CI workflows |
| `.github/pull_request_template.md` | Mandatory PR evidence and impact fields |
| `AGENTS.md` | Root authority, execution, evidence, and review rules |
| `docs/` | Architecture, roadmap, known issues, environment, Phase 2, migration, and operational documentation |
| `docs/agent-ops/` | Source-of-truth, tool routing, task packet, handoff, completion evidence, repository map, and cross-review log |
| `firestore.rules` / `storage.rules` | Repository source for Firebase security rules; deployed state must be checked separately |
| `firebase.json` / `.firebaserc` | Firebase targets and local/deploy configuration |
| `apphosting.yaml` / `Dockerfile` | Hosting/runtime build and deployment configuration |
| `package.json` | Scripts, dependencies, and executable project checks |

## Present locally, not GitHub sources of truth

These exist in a typical checkout and must not be treated as merged product contracts:

- Tool adapters under `.claude/`, `.cursor/` (and `.agents/` / `.codex/` if added later)
- Local-only trees: `.local-secrets/`, `.tools/`, `node_modules/`, `dist/`
- Environment files: `.env.local` (gitignored)

## Not in this repository

- Agency Agents source prompts or generated personas
- Master Delivery Plan or historical planning drafts as a repository source of truth
- GitHub issue labels (live on GitHub; taxonomy owned by issue #18, not a repo file)

Never use this map as proof that a listed path is deployed, active, secure, or complete. Live systems remain authoritative for runtime state (`docs/agent-ops/SOURCE_OF_TRUTH.md`).
