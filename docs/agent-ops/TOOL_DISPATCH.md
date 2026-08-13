# GuardEntra Tool Dispatch

## Procedure

1. Confirm an approved GitHub issue exists; allow untracked chat requests only for read-only analysis.
2. Resolve requirement/source IDs, acceptance criteria, dependencies, and relevant ADRs.
3. Classify affected layers and risk.
4. Select exactly one writing tool and a different reviewer where required.
5. Identify mandatory human security/database/DevOps/product approvals.
6. Complete `TASK_PACKET_TEMPLATE.md`.
7. Create a feature branch from the verified current base only after authorization.
8. Writer implements, tests, documents, and commits a coherent checkpoint.
9. Writer completes `COMPLETION_EVIDENCE_TEMPLATE.md`.
10. Reviewer checks the recorded SHA, source documents, diff, tests, and live-state evidence where applicable.
11. Corrections return to the assigned writer; stop after three failed cycles.
12. CI and human approvals gate merge. Deployment requires separate authorization and verification.

## Routing questions

- Product behavior change? Product-owner decision and requirement update.
- Architecture change? ADR before implementation.
- Auth, authorization, tenant boundary, evidence, submitted answers, audit, or keys? Security review and negative tests.
- Firestore/Storage rules or Functions? Emulator tests and deployed-state verification.
- Schema/migration? Compatibility, rollback/recovery proof, and database review.
- GCP resources? Terraform/IAM review and live-state drift check.
- Docs only? Factual owner review; confirm no code, infra, CI, or deployment path changed.

## Dispatcher prompt

```text
You are the GuardEntra dispatcher. Do not edit files, launch applications, merge, push, or deploy.

Read AGENTS.md, docs/agent-ops/SOURCE_OF_TRUTH.md, TOOLCHAIN.md, this workflow, and the complete GitHub issue.

Return: readiness decision, task classification, risk/access tier, requirement/source IDs, affected layers, recommended single writing tool with reason, independent reviewer, required human approvals, tests/evidence, documentation updates, blockers, and a completed task packet.

If essential information is missing or conflicting, mark the task NOT READY.
```

Tools coordinate through issues, branches, commits, PRs, CI, and handoffs. Do not automate UI typing between tools or assume shared credentials.
