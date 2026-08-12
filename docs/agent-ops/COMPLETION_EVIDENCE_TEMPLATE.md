# GuardEntra Completion Evidence

Copy this block into every completion report, handoff, and PR. Do not remove fields.

## Classification

- Status: `CHECKPOINT` / `PR READY` / `MERGED` / `DEPLOYED AND VERIFIED`
- Claim being verified:

## Mandatory evidence

1. **Branch name:**
2. **Commit SHA:** `NOT COMMITTED` if no commit contains the work
3. **GitHub PR:** number + URL, or `NO PR — NOT DELIVERED TO GITHUB`
4. **Exact changed files:** repository-relative list generated from Git/PR
5. **Test results:** each exact command/check with `PASS`, `FAIL`, or `BLOCKED/NOT RUN` and reason
6. **Remaining uncommitted files:** exact `git status --short`, or `Clean` only after verification
7. **Deployment status:** `NOT DEPLOYED`, or environment + deployed commit/revision + mechanism + verification/result

## Supporting evidence

- Issue and requirement IDs:
- CI checks/URLs:
- Security/privacy/data/migration/documentation impact:
- Known limitations:
- Rollback procedure:
- Independent reviewer:
- Human approvals still required:

## Gate decision

- Evidence gate: `PASS` / `FAIL`
- Failed or unverified fields:
- Permitted wording: `local checkpoint`, `PR ready`, `merged`, or `deployed and verified`

The gate passes only when every mandatory field is populated and consistent with repository, GitHub, CI, and deployment evidence. `NOT COMMITTED`, `NO PR`, failed/unrun required tests, unexplained working-tree changes, or unverified deployment prevent a full completion claim.
