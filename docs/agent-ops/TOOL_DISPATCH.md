# GuardEntra Tool Dispatch

Solo-owner model: `@akurteshi-guardentra` is merge authority. Independent review is optional and must not block merge after required CI passes.

## Procedure

1. Confirm an approved GitHub issue exists; allow untracked chat requests only for read-only analysis.
2. Read `PROJECT_STATE.md`; reconcile it with the issue, current GitHub base, and any live-state or pasted tool evidence.
3. Resolve requirement/source IDs, acceptance criteria, dependencies, and relevant ADRs.
4. Classify affected layers and risk.
5. Select exactly one writing tool (`tool:*`). Record an optional reviewer (`review:*`) only when risk, uncertainty, or owner preference warrants it.
6. Identify owner authorization boundaries (especially for T3/T4 work).
7. Complete `TASK_PACKET_TEMPLATE.md`.
8. Create a feature branch from the verified current base only after authorization.
9. Writer implements, tests, documents, and commits a coherent checkpoint.
10. Writer completes `COMPLETION_EVIDENCE_TEMPLATE.md`.
11. Optional reviewer (if requested) checks the recorded SHA, source documents, diff, tests, and live-state evidence where applicable.
12. Corrections return to the assigned writer; stop after three failed cycles.
13. **Required CI** gates merge. Owner merges after CI pass and exact diff verification. Deployment requires separate authorization and verification.

## Owner command meanings

| Command | End state |
|---|---|
| **commit** | Local commit on feature branch only |
| **commit and PR** | Commit + push + open PR |
| **commit, PR, and merge** | Commit + push + PR + required CI pass + merge |
| **deploy staging** | Verified merged commit deployed to staging with evidence |
| **deploy production** | Verified merged commit deployed to production after explicit owner instruction |

See `AGENTS.md` for prohibited actions at each stage.

## Routing questions

- Product behavior change? Owner decision and requirement update.
- Architecture change? ADR before implementation.
- Auth, authorization, tenant boundary, evidence, submitted answers, audit, or keys? Security tests and negative tests; optional review recommended.
- Firestore/Storage rules or Functions? Emulator tests and deployed-state verification.
- Schema/migration? Compatibility, rollback/recovery proof, and database impact notes.
- GCP resources? Terraform/IAM review and live-state drift check.
- Docs only? Confirm no code, infra, CI, or deployment path changed.

## Dispatcher prompt

```text
You are the GuardEntra dispatcher. Do not edit files, launch applications, merge, push, or deploy unless the owner command explicitly authorizes that stage.

Read AGENTS.md, docs/agent-ops/SOURCE_OF_TRUTH.md, TOOLCHAIN.md, this workflow, and the complete GitHub issue.

Return: readiness decision, task classification, risk/access tier, requirement/source IDs, affected layers, recommended single writing tool (tool:*) with reason, optional reviewer (review:*) if warranted, owner authorization needed, tests/evidence, documentation updates, blockers, and a completed task packet.

If essential information is missing or conflicting, mark the task NOT READY.
```

Tools coordinate through issues, branches, commits, PRs, CI, and handoffs. Do not automate UI typing between tools or assume shared credentials.


## Report reconciliation and state transition

When the owner pastes output from Cursor, Antigravity, Cloud/Claude, Firebase, a UI tool, or another agent:

1. Identify source, issue, branch/commit, and claimed end state.
2. Separate `CLAIMED` from GitHub-verified, test-verified, merged, deployed, and live-verified facts.
3. Reconcile repository and live state using `SOURCE_OF_TRUTH.md`.
4. Return current position, blockers, decision, and next authorized step.
5. Generate the next prompt from `TOOL_PROMPT_ROUTER.md`.
6. When evidence warrants a durable transition, update `PROJECT_STATE.md` and append `PROJECT_TRANSITIONS.md` through a documentation PR.

Never silently promote a pasted report to verified state. Never equate merged with deployed.
