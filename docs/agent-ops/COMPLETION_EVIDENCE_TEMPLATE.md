# GuardEntra Completion Evidence

Copy this block into every completion report, handoff, and PR. Do not remove fields.

## Classification

- Status: `CLAIMED` / `CHECKPOINT` / `PR READY` / `MERGED` / `DEPLOYED` / `LIVE VERIFIED` / `BLOCKED`
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
- Optional reviewer (`review:*`, if engaged): name/tool and result, or `NONE`
- Owner authorization still required (merge/deploy/secrets/production): yes/no and which command
- Repository/live-state reconciliation: matching / mismatched / not applicable, with evidence
- Project-state transition: none, or exact `PROJECT_STATE.md` and appended `PROJECT_TRANSITIONS.md` update required
- Next authorized issue/action:

## Gate decision

- Evidence gate: `PASS` / `FAIL`
- Failed or unverified fields:
- Permitted wording: `local checkpoint`, `PR ready`, `merged`, or `deployed and verified`

The gate passes only when every mandatory field is populated and consistent with repository, GitHub, CI, and deployment evidence. `NOT COMMITTED`, `NO PR`, failed/unrun required tests, unexplained working-tree changes, or unverified deployment prevent a full completion claim.

Merge requires required CI pass and owner authorization. Optional review is not a merge gate unless the owner explicitly designated it blocking for that task.
