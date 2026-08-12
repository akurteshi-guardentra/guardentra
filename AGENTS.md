# GuardEntra Agent Operating Rules

Owner: GuardEntra human product/technical lead  
Applies to: every AI assistant, coding agent, reviewer, automation, and contributor

## 1. Authority order

When instructions conflict, follow this order. Stop for human resolution when the conflict changes product behavior, architecture, security, privacy, data handling, cost, or delivery scope.

1. Law, customer contracts, approved security policy, and explicit human approval.
2. Approved product requirements and their source locators.
3. Approved architecture decision records (ADRs).
4. GitHub issue acceptance criteria and Definition of Done.
5. This file and `docs/agent-ops/` workflows.
6. Tool adapters and specialist-role prompts.
7. Ad-hoc chat instructions.

A tool or persona never overrides GuardEntra requirements, security controls, or human authority.

## 2. Mandatory start procedure

Before editing, the assigned writer must:

1. Read the complete GitHub issue and this file.
2. Read `docs/agent-ops/SOURCE_OF_TRUTH.md`, `TOOLCHAIN.md`, and `TOOL_DISPATCH.md`.
3. Read the relevant requirements, ADRs, repository planning documents, security/data documents, and existing tests.
4. Record the repository, branch, starting commit SHA, issue, requirement IDs, and source locators.
5. Classify the work and risk.
6. Complete `docs/agent-ops/TASK_PACKET_TEMPLATE.md`.
7. State intended files/services, tests, evidence, documentation impact, rollback, and unresolved decisions.
8. Stop if the task is ambiguous, lacks acceptance criteria, requests secrets, conflicts with an approved control, or requires authority not granted by the issue.

### Lightweight documentation path

A documentation-only correction may use a lightweight task packet when it changes no product behavior, requirement, architecture, security/privacy rule, operational procedure, source-of-truth claim, code, infrastructure, CI, migration, or deployment path. The PR description must still identify scope, exact changed files, validation results, reviewer, and all seven completion-evidence fields. If classification is uncertain, use the full procedure.

## 3. Execution rules

- One primary writing tool owns a branch at a time.
- Other tools review committed diffs; they do not edit the same branch simultaneously.
- Work only within the approved issue. Record discovered scope separately.
- Use the smallest safe change and preserve unrelated user work.
- Preserve tenant isolation, least privilege, auditability, evidence safety, and submitted-assessment immutability.
- Never expose or commit credentials, tokens, personal data, customer evidence, or production records.
- Never infer completion from a screen, roadmap, comment, generated summary, or unexecuted test.
- Never claim a file or artifact exists without giving its exact location and confirming who can access it. Distinguish an isolated workspace, the user's checkout, GitHub, Library/Drive, and a deployed environment.
- Database, rules, IAM, encryption, retention, audit, and deployment changes require impact notes, negative tests, and independent review.
- Security-sensitive work requires a named human approval before merge; AI review is supplementary.
- Before security-sensitive implementation begins, the task packet must identify each required human approver by GitHub username or approved team. If no qualified approver is assigned, the task is `NOT READY`. `CODEOWNERS` may automate routing later, but it does not replace explicit assignment or recorded approval.
- Do not merge, deploy, rotate secrets, modify production data, or weaken controls without explicit human authorization.
- After three failed correction cycles, stop and hand off logs, diffs, hypotheses, and the safest next action.

## 4. Completion-evidence gate

No contributor may say `complete`, `done`, `finished`, `shipped`, `fixed`, or equivalent unless the report contains all seven verifiable fields:

1. Exact branch name.
2. Exact commit SHA containing the claimed work; otherwise `NOT COMMITTED`.
3. GitHub PR number and URL; otherwise `NO PR — NOT DELIVERED TO GITHUB`.
4. Exact repository-relative changed-file list from Git or the PR.
5. Exact tests/checks run and their `PASS`, `FAIL`, or `BLOCKED/NOT RUN` results.
6. Exact remaining working-tree state from `git status --short`; state `Clean` only when verified.
7. Deployment status: `NOT DEPLOYED`, or the environment, deployed commit/revision, mechanism, verification, and result.

Use `docs/agent-ops/COMPLETION_EVIDENCE_TEMPLATE.md` verbatim. A truthful negative state is permitted, but it classifies the work as a checkpoint rather than delivered, merged, or deployed.

Every handoff and PR must also include issue/requirement IDs, behavior changed, security/privacy/data/migration/documentation impact, known limitations, rollback steps, independent reviewer, and remaining human decisions.

## 5. Review and release

- No author approves their own security-sensitive work.
- Reviewers validate the recorded commit and evidence, not a pasted confidence statement.
- A commit, push, PR, merge, runtime release, and verified deployment are separate states.
- GitHub is authoritative for repository history; live systems are authoritative for deployed/runtime state. Capture live-state evidence durably without committing secrets or customer data.
- Human approval is required to merge or deploy.

## 6. Tool selection

Tools are selected per issue, based on task type, access, current demonstrated results, and independent-review availability. Neither Claude Code nor Codex is permanently primary.

See `docs/agent-ops/TOOLCHAIN.md`. Specialist prompts grant expertise and output format only; they do not grant authority.
