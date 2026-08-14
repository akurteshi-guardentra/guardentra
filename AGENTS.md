# GuardEntra Agent Operating Rules

Owner and merge authority: `@akurteshi-guardentra` (solo owner)  
Applies to: every AI assistant, coding agent, reviewer, automation, and contributor

## 1. Authority order

When instructions conflict, follow this order. Stop for owner resolution when the conflict changes product behavior, architecture, security, privacy, data handling, cost, or delivery scope.

1. Law, customer contracts, approved security policy, and explicit owner approval.
2. Approved product requirements and their source locators.
3. Approved architecture decision records (ADRs).
4. GitHub issue acceptance criteria and Definition of Done.
5. This file and `docs/agent-ops/` workflows.
6. Tool adapters and specialist-role prompts.
7. Ad-hoc chat instructions.

A tool or persona never overrides GuardEntra requirements, security controls, or owner authority.

## 2. Solo-owner governance

GuardEntra operates as a **solo-owner** repository:

- `@akurteshi-guardentra` is the sole owner and merge authority.
- **Independent AI review is optional**, not mandatory.
- **A separate human reviewer is optional**, not mandatory.
- Optional review may be requested by risk, uncertainty, or owner preference using live `review:*` labels; it must **not** block an ordinary PR merge after required CI passes.
- **One writing tool** (`tool:*`) owns each feature branch at a time.
- **Direct edits to `main` are prohibited.**
- **PR creation is required** for repository changes.
- **Required CI/status checks remain required.**
- **Exact changed-file validation** and the **seven-field completion evidence** remain mandatory.
- **Merge and deployment are separate actions.** Production deployment always requires a separate explicit owner instruction.

Security controls are **not** relaxed: secret handling, tenant isolation, security/negative tests, rollback evidence, and deployment restrictions remain in force. High-risk work still requires stronger evidence and may warrant optional review, but review is never a merge gate by itself.

### GitHub label convention

- `tool:*` — assigned writer for the issue/branch (per-issue assignment, not permanent ownership)
- `review:*` — optional reviewer when requested
- Do **not** introduce `writer:*` or `reviewer:*` labels

### Branch-protection target (GitHub `main`)

| Setting | Target |
|---|---|
| Required approving reviews | **0** |
| Required code-owner reviews | **off** |
| Required CI/status checks | **retained** (`verify`, etc.) |
| Conversation resolution | **retained** |
| Force pushes | **prohibited** |
| Branch deletion | **prohibited** |
| Linear history | **retained** |

Inspect live settings before merge; changing branch protection requires explicit authorization in the governing issue. Report mismatches to the owner.

### Owner command meanings

These phrases define **exactly** what an agent may do:

| Command | Permitted actions | Prohibited |
|---|---|---|
| **commit** | Stage only files for the authorized task; run relevant checks; commit on the feature branch | push, open PR, merge, deploy |
| **commit and PR** | Complete **commit**, push the feature branch, open a PR | merge, deploy |
| **commit, PR, and merge** | Complete **commit and PR**, wait for required CI, verify the exact diff, merge if checks pass | deploy |
| **deploy staging** | Separately deploy the verified merged commit to staging; report deployment evidence | production deploy |
| **deploy production** | Separately deploy the verified merged commit to production **only** after an explicit owner instruction; return deployment verification | any deploy without explicit instruction |

## 3. Mandatory start procedure

Before editing, the assigned writer must:

1. Read the complete GitHub issue and this file.
2. Read `docs/agent-ops/SOURCE_OF_TRUTH.md`, `PROJECT_STATE.md`, `TOOLCHAIN.md`, `TOOL_DISPATCH.md`, and `TOOL_PROMPT_ROUTER.md`.
3. Read the relevant requirements, ADRs, repository planning documents, security/data documents, and existing tests.
4. Record the repository, branch, starting commit SHA, issue, requirement IDs, and source locators.
5. Classify the work and risk.
6. Complete `docs/agent-ops/TASK_PACKET_TEMPLATE.md`.
7. State intended files/services, tests, evidence, documentation impact, rollback, and unresolved decisions.
8. Reconcile the issue and any pasted tool report against `PROJECT_STATE.md`; treat unverified claims as `CLAIMED`, not fact.
9. Stop if the task is ambiguous, lacks acceptance criteria, requests secrets, conflicts with an approved control, or requires authority not granted by the issue.

### Lightweight documentation path

A documentation-only correction may use a lightweight task packet when it changes no product behavior, requirement, architecture, security/privacy rule, operational procedure, source-of-truth claim, code, infrastructure, CI, migration, or deployment path. The PR description must still identify scope, exact changed files, validation results, optional reviewer (if any), and all seven completion-evidence fields. If classification is uncertain, use the full procedure.

## 4. Execution rules

- One primary writing tool owns a branch at a time.
- Other tools may review committed diffs when requested; they do not edit the same branch simultaneously.
- Work only within the approved issue. Record discovered scope separately.
- Use the smallest safe change and preserve unrelated owner work.
- Preserve tenant isolation, least privilege, auditability, evidence safety, and submitted-assessment immutability.
- Never expose or commit credentials, tokens, personal data, customer evidence, or production records.
- Never infer completion from a screen, roadmap, comment, generated summary, or unexecuted test.
- Never claim a file or artifact exists without giving its exact location and confirming who can access it. Distinguish an isolated workspace, the owner's checkout, GitHub, Library/Drive, and a deployed environment.
- Database, rules, IAM, encryption, retention, audit, and deployment changes require impact notes, negative tests, and rollback evidence. Optional review is recommended for T3/T4 work but is not a merge gate.
- Security-sensitive work requires explicit owner authorization before merge and must not weaken controls. Optional AI or specialist review may be requested but does not replace required tests and evidence.
- Do not merge, deploy, rotate secrets, modify production data, or weaken controls without explicit owner authorization matching the command definitions above.
- After three failed correction cycles, stop and hand off logs, diffs, hypotheses, and the safest next action.

## 5. Completion-evidence gate

No contributor may say `complete`, `done`, `finished`, `shipped`, `fixed`, or equivalent unless the report contains all seven verifiable fields:

1. Exact branch name.
2. Exact commit SHA containing the claimed work; otherwise `NOT COMMITTED`.
3. GitHub PR number and URL; otherwise `NO PR — NOT DELIVERED TO GITHUB`.
4. Exact repository-relative changed-file list from Git or the PR.
5. Exact tests/checks run and their `PASS`, `FAIL`, or `BLOCKED/NOT RUN` results.
6. Exact remaining working-tree state from `git status --short`; state `Clean` only when verified.
7. Deployment status: `NOT DEPLOYED`, or the environment, deployed commit/revision, mechanism, verification, and result.

Use `docs/agent-ops/COMPLETION_EVIDENCE_TEMPLATE.md` verbatim. A truthful negative state is permitted, but it classifies the work as a checkpoint rather than delivered, merged, or deployed.

After a verified merge, deployment, rollback, issue transition, confirmed bug, or source-of-truth correction, update `PROJECT_STATE.md` through a PR and append a dated entry to `PROJECT_TRANSITIONS.md`. Never rewrite historical transition entries to hide a correction. A ledger update records evidence; it does not grant merge or deployment authority.

Every handoff and PR must also include issue/requirement IDs, behavior changed, security/privacy/data/migration/documentation impact, known limitations, rollback steps, optional reviewer (if any), and remaining owner decisions.

## 6. Review and release

- Optional reviewers validate the recorded commit and evidence when engaged; they do not gate merge by default.
- A commit, push, PR, merge, runtime release, and verified deployment are separate states.
- GitHub is authoritative for repository history; live systems are authoritative for deployed/runtime state. Capture live-state evidence durably without committing secrets or customer data.
- Merge requires: feature branch, open PR, passing required CI, verified exact diff, and owner authorization (`commit, PR, and merge` or equivalent explicit instruction).
- Deployment requires a separate owner instruction (`deploy staging` / `deploy production`) and verification evidence.

## 7. Tool selection

Tools are selected per issue, based on task type, access, and current demonstrated results. Neither Claude Code nor Codex is permanently primary.

See `docs/agent-ops/TOOLCHAIN.md` and `docs/agent-ops/TOOL_PROMPT_ROUTER.md`. Specialist prompts grant expertise and output format only; they do not grant authority.
