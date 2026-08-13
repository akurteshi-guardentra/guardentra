## Scope and traceability

- Issue:
- Requirement/source IDs:
- Summary:

## Completion evidence (mandatory)

1. **Branch name:**
2. **Commit SHA:**
3. **GitHub PR:** this PR number and URL
4. **Exact changed files:** use the PR file list; identify generated/vendor files separately
5. **Test results:** exact commands/checks with `PASS`, `FAIL`, or `BLOCKED/NOT RUN`
6. **Remaining uncommitted files:** exact writer-checkout `git status --short`, or `Clean` only after verification
7. **Deployment status:** `NOT DEPLOYED`, or environment + deployed commit/revision + mechanism + verification/result

Missing or inconsistent fields fail the completion-evidence gate. Commit, push, PR, merge, and deployment are separate states.

## Impact and review

- Security/privacy/data/migration impact:
- Documentation impact:
- Known limitations:
- Rollback procedure:
- Optional reviewer (`review:*`, if engaged):
- Owner authorization required for merge/deploy: `@akurteshi-guardentra`

Solo-owner model: independent review is optional and does not block merge after required CI passes unless the owner explicitly designated review as blocking for this PR.
