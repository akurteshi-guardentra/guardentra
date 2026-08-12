# GuardEntra Cross-Review Log

This log records material disagreements, evidence checks, corrections, and unresolved questions across human, Codex/ChatGPT, Claude, and other reviews. It is an evidence index, not a source of product authority.

## Rules

- Record the date, claim, evidence inspected, conclusion, changes adopted, and remaining owner.
- Distinguish GitHub, local-machine, isolated-workspace, and live-runtime evidence.
- A tool may only claim access to the environment it actually inspected.
- Correct earlier entries instead of preserving a known-false conclusion as current guidance.
- Repository delivery requires commit/PR evidence; runtime deployment requires environment/revision verification.

## Reconciled history

### 2026-08-10 — Master-plan reconciliation

- Claude verified multiple repository claims from the full-product runbook and identified stale versus current findings.
- Master Delivery Plan Version 2 accepted stronger requirements traceability, KMS-signed checkpoints, disaster recovery, Agency Agents basics, work-type tool assignment, and hard release gates.
- P0 post-submission immutability remained a verified blocker at the then-inspected repository state; evidence-before-scan remained unverified.

### 2026-08-10 to 2026-08-12 — Workspace/delivery correction

- Codex created a large package in an isolated ChatGPT workspace but initially described it in language that implied delivery to the user's working repository.
- Claude correctly observed that GitHub did not contain the package and the user's local checkout did not show it.
- Claude initially concluded the files did not exist anywhere; later evidence showed they existed in the isolated workspace.
- Final reconciled conclusion: the files were real local artifacts in a separate workspace, but were not committed, pushed, transferred to the user's checkout, or delivered through GitHub. The original Codex delivery wording and Claude's broader nonexistence conclusion were both corrected.
- Adopted control: no completion claim is accepted without the seven-field evidence report.

### 2026-08-12 — Starter-kit reconciliation

- Claude's full `starter-kit.zip` and the Codex control package were compared.
- Fixed assignments such as “Claude writes application code” or “Codex writes infrastructure” were rejected as permanent policy.
- Adopted: issue-by-issue selection, one writer per branch, independent review, named human approval for sensitive work, three-attempt limit, and repository-versus-live-state evidence separation.
- The first proposed PR was limited to shared operating rules and templates. Terraform, SQL, infra CI, issue creation, sprint prompts, historical plans, and the full Agency Agents import were excluded.

## Open items

- Reverify P0-1 and P0-2 against the current live GitHub SHA before implementation planning.
- Confirm human ownership boundaries, including the cofounder's role, before encoding them in governance.
- Review and pin selected Agency Agents separately; do not activate the full catalog by default.
- Review Master Delivery Plan Version 2 in a separate planning PR.
