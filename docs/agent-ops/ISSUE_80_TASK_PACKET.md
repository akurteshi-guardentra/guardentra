# GuardEntra Task Packet

- Packet ID: ISSUE-80
- Updated UTC: 2026-09-27
- Repository: https://github.com/akurteshi-guardentra/guardentra
- GitHub issue: #80 https://github.com/akurteshi-guardentra/guardentra/issues/80
- Requirement/source IDs and locators: #80 target outcome and acceptance criteria; #72 queue contract; owner task in this session (local implementation, stop before commit).
- Relevant ADRs: docs/adr/0080-self-managed-mail.md (local design decision); docs/ARCHITECTURE_FOUNDATION.md sections 1–3; docs/SECRETS.md.
- Base branch and verified SHA: owner-specified base a355ea70271c511d2985ba068dd2c40fbeb86dff
- Feature branch: feat/self-managed-email-worker-80
- Primary writing tool (`tool:*`): tool:codex, sole L4 writer
- Optional reviewer (`review:*`, if any): NONE
- Owner / merge authority: `@akurteshi-guardentra`

Optional review does not block merge after required CI passes unless the owner explicitly makes it blocking for this task.

## Scope and authority

- User-visible outcome: unchanged server queue contract with a prepared self-managed delivery path.
- In scope: queue validation, provider interface/adapter, transaction-based delivery state, retries/recovery, tests, migration/runbook.
- Out of scope: #66 dispatcher, deployment wiring, cloud configuration, credentials, production, unrelated UX/security redesign.
- Allowed files/services: server/lib/mailQueue.ts, server/routes/notify.ts, new server/lib/mailWorker/* and server/mailWorkerFunctions.ts, package files, mail and rules tests, docs/STAGING_EMAIL_DELIVERY.md, new mail design/runbook/evidence docs.
- Prohibited actions: commit, push, PR, merge, deploy, runtime/secret/IAM/provider configuration; changes to dispatcher files or client queue rules.
- Dependencies/blockers: live staging send/failure/retry acceptance remains NOT RUN. PROJECT_STATE.md snapshot predates #72; no live delivery inferred. #72 is present at the supplied base. Issue #80 original no-implementation restriction is superseded by explicit owner authorization in this session. Pasted labels are CLAIMED; GitHub #80 currently has no labels. Do not introduce writer:* labels.
- Owner command authorized (commit / commit and PR / commit, PR, and merge / deploy staging / deploy production): local edits/tests only; STOP BEFORE COMMIT.
- Classification/routing: T2 backend application implementation; L2 Engineering with Security concerns, L3 Backend/Firebase design, L4 Codex execution. No other writing agents. Additive delivery metadata is local design only; deploying it requires a separately authorized schema/operational impact review.

## Impact analysis

- UI: no delivery-success claim added; existing queue-only contract preserved.
- API/backend: reject malformed mail; no raw queue errors logged; independently packaged worker.
- Firebase/database: unchanged to/message/source/createdAt; worker-owned delivery metadata only after cutover; rules and deployment config unchanged.
- IAM/security/privacy: deny-all clients retained; no client-selected provider, sender, credentials or tenant lookup; provider sees only current mail payload. Secret Manager and dedicated runtime identity required later.
- Audit/evidence: allowlisted status codes only, no recipient/body/provider error in logs.
- Migration/rollback/recovery: exclusive consumer, cutoff, extension-owned documents skipped; ambiguous sends held for reconciliation, never blindly retried.
- Documentation: ADR before implementation, migration runbook, #72 cross-reference, local evidence.

## Acceptance and verification

- Acceptance criteria: owner's eight test categories; replaceable provider; disabled-by-default self-managed function source; documented cutover/rollback/config.
- Unit tests: valid and malformed queue input, provider outcomes, retries, duplicate/concurrent calls, lease expiry, redaction.
- Integration/emulator tests: actual Firestore transactions and client queue deny-all.
- End-to-end tests: staging NOT RUN (no runtime authorization).
- Security/negative tests: secret-bearing provider failures, unknown outcomes, extension ownership/cutoff, authenticated and unauthenticated client denials.
- Build/lint/typecheck: npm run lint; focused/full Vitest; Jest; build and worker bundle.
- Required screenshots/logs/live-state evidence: test output only, no live secrets/data.
- Exact changed-file scope validation: git diff --name-only plus git ls-files --others --exclude-standard; git diff --check; no staged changes.

## Handoff

- Classification: CHECKPOINT
- Branch: feat/self-managed-email-worker-80
- Commit SHA: NOT COMMITTED
- PR number/URL: NO PR — NOT DELIVERED TO GITHUB
- Exact changed files: see ISSUE_80_COMPLETION_EVIDENCE.md after verification.
- Exact tests/checks and results: see completion evidence after verification.
- Remaining `git status --short` state: see completion evidence after verification.
- Deployment status and verification: NOT DEPLOYED
- Known limitations: staging E2E, production release, monitoring/IAM/config approvals remain separate.
- Rollback procedure: do not activate; after authorized cutover, stop worker, reconcile in-flight outcomes and isolate worker-owned records before restoring legacy consumer.
- Optional reviewer findings (if engaged): NONE
- Remaining owner decisions: accept local design/diff; later commit/PR, deploy and runtime authorization.

Attach the completed `COMPLETION_EVIDENCE_TEMPLATE.md`. Missing evidence prohibits a completion claim.
