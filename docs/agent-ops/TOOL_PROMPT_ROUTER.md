# GuardEntra Tool Prompt Router

Read `AGENTS.md`, `SOURCE_OF_TRUTH.md`, `PROJECT_STATE.md`, the issue, and relevant tests/ADRs first. Tool selection grants capability, not authority.

## Routing matrix

| Work | Primary pattern | Required output |
|---|---|---|
| React/TypeScript implementation | Cursor | Branch, diff, tests, PR, evidence |
| Read-only workflow investigation | Antigravity | Exact trace and verdict; no code |
| Firestore/lifecycle enforcement | Cursor + Firebase tooling | Rules, negative tests, release evidence |
| GCP/Firebase architecture | Cloud/Claude Code | IAM, cost, reliability, recovery, live-state distinctions |
| UI/UX | Cursor | Screenshots, accessibility/responsive and behavior tests |
| PR/repository verification | Codex | `APPROVE` or `REQUEST CHANGES` against actual SHA/diff/checks |
| Security review | Codex or Claude | Threats, boundaries, negative tests, blockers |
| Deployment | Target platform tooling | Target, revision/ruleset, smoke tests, rollback |
| Framework rights/content | Engineering + owner/publisher/counsel | Recorded authority; AI invents no legal conclusion |

Use one `tool:*` writer per branch. `review:*` is optional.

## Pasted-report reconciliation

Return:

1. Source/tool, issue, branch/SHA, claimed state.
2. Matrix: claimed / GitHub verified / tests verified / merged / deployed / live verified / unverified.
3. Previous, current, next, and blocked position.
4. Decision: `APPROVE`, `REQUEST CHANGES`, `READY TO MERGE`, `MERGED — NOT DEPLOYED`, `DEPLOYED — LIVE VERIFICATION PENDING`, `COMPLETE`, or `BLOCKED`.
5. Exact next-tool prompt.
6. Ledger effect: none, or state update plus appended transition.

## Base prompt contract

```text
Repository: https://github.com/akurteshi-guardentra/guardentra
Issue: <number and URL>
Verified base: <branch and SHA>
Assigned writer: <tool:*>
Authorized end state: <investigate / commit / commit and PR / commit, PR, and merge / deploy staging / deploy production>

Read AGENTS.md, SOURCE_OF_TRUTH.md, PROJECT_STATE.md, TOOL_DISPATCH.md,
TOOL_PROMPT_ROUTER.md, and the complete issue.

Objective:
<one bounded result>

In scope:
<exact paths/behaviors>

Out of scope:
<explicit exclusions>

Acceptance criteria:
<testable criteria>

Required checks:
<commands, negative tests, live checks where authorized>

Return:
1. Branch
2. Commit SHA
3. PR URL
4. Exact changed files
5. Exact checks/results
6. Working-tree state
7. Deployment status
8. Repository/live reconciliation
9. Next authorized action

Do not merge or deploy unless explicitly authorized.
```

## Specialist additions

- **Cursor:** smallest safe diff, feature branch, existing-pattern reuse, focused/full checks, exact scope.
- **Antigravity:** exact paths/functions/routes/rules and `NO DEFECT`, `CONFIRMED DEFECT`, or `UNVERIFIED WITH BLOCKER`; no mutations.
- **Firebase:** exact project and operational environment; emulator positives/negatives; deployed-ruleset comparison; rollback; separate rules/app state.
- **Cloud:** current main/live inspection; least privilege; regions/tenants; failure/recovery; cost; Terraform/IAM; explicit deferrals.
- **UI:** routes/components; loading/error/empty states; accessibility; responsiveness; behavior tests; screenshots are not proof alone.
- **Codex:** actual head SHA, complete diff, files, CI, criteria, boundaries, and repository/live mismatch; read-only unless separately authorized.
- **Deployment:** exact target, merged SHA, artifact/revision, secret/config readiness without values, smoke tests, rollback, and live verification; stop for placeholder/conflicting environments.
