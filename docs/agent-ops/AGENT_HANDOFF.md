# GuardEntra Agent Handoff

Solo-owner model: `@akurteshi-guardentra` is merge authority. Optional review does not block merge after required CI passes.

1. Writer stops editing and commits a coherent checkpoint.
2. Writer records the issue/task packet, behavior, exact changed files, exact test results, impacts, limitations, and rollback.
3. Writer completes `COMPLETION_EVIDENCE_TEMPLATE.md`, including truthful negative states.
4. Writer records the exact working-tree state and separates unrelated owner work.
5. Owner or optional reviewer reads the recorded SHA and governing sources when review is requested.
6. Optional reviewer records findings as blocking (only if owner designated review as blocking for this task), non-blocking, or unverified with file/test evidence.
7. Security-sensitive work still requires required tests, negative tests, and owner authorization before merge; optional review supplements but does not replace evidence.
8. Corrections return to the assigned writer. After three failed cycles, stop and escalate with evidence and options.
9. Owner verifies required CI and exact diff scope before merge (`commit, PR, and merge`). Deployment is a separate authorized action (`deploy staging` / `deploy production`).

Any missing mandatory field makes the handoff an unverified checkpoint. Never transfer secrets, raw customer evidence, production tokens, or undocumented local state through Markdown.
