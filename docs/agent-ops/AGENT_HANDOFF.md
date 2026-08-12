# GuardEntra Agent Handoff

1. Writer stops editing and commits a coherent checkpoint.
2. Writer records the issue/task packet, behavior, exact changed files, exact test results, impacts, limitations, and rollback.
3. Writer completes `COMPLETION_EVIDENCE_TEMPLATE.md`, including truthful negative states.
4. Writer records the exact working-tree state and separates unrelated user work.
5. Human carries the branch/PR to the reviewer; tools do not automatically control one another.
6. Reviewer checks out or reads the recorded SHA and independently reads the governing sources.
7. Reviewer records findings as blocking, non-blocking, or unverified with file/test evidence.
8. Security-sensitive work also receives named human approval in the PR.
9. Corrections return to the assigned writer. After three failed cycles, stop and escalate with evidence and options.
10. Human verifies CI, approvals, and scope before merge. Deployment is a separate authorized action.

Any missing mandatory field makes the handoff an unverified checkpoint. Never transfer secrets, raw customer evidence, production tokens, or undocumented local state through Markdown.
