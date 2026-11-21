# Task packet — #124 terminal assessment immutability

- Packet: LIFECYCLE-124-TERMINAL-20261118. Updated UTC 2026-11-18.
- Issue: #124 comment 6973876255. Owner fix/continue instruction, source only.
- Base: published candidate 018ced4c8c602fb815897a5fa3b99d1061d96c98
  (`fix/144-checkout-current-status`). Not the audit parser branch.
- Ownership: `server/lib/evidenceAccess.ts` at that SHA matches the security
  candidate. The latest file history is already in that tree. No open Claude
  branch is editing it. This task branch is the only writer for the new edit.
- Terminal semantics: `isTerminalDecisionOutcome` / `hasTerminalOrgDecision`.
  approved, conditional, and rejected are terminal. remediate is not.
  `decidedAt` alone is not terminal. No decision-clear policy.

## Behavior

- Portal resubmit returns 409 when the stored decision is terminal, including
  when lifecycle fields look reopened. A nonterminal duplicate submit stays a
  no-op. remediate and a bare `decidedAt` can still submit.
- Rules deny same-state answer, comment, and evidence rewrites, and deny a
  client correction reopen, for approved, conditional, and rejected.
- Rules still allow those edits and a correction reopen for remediate, and
  still allow answer edits when only `decidedAt` is present.

## Limits

Source and emulator tests only. No Firestore rules deployment, data rewrite,
migration, merge, or production change. Hosted #124 remains open.
Rollback: revert this commit before release. No live mutation to reverse.
