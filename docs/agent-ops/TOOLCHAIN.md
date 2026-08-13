# GuardEntra Toolchain

GitHub is the coordination layer. No desktop AI application is a universal controller. Each task starts as an approved issue, receives one writing tool (`tool:*`), and ends with evidence and owner-controlled merge/deploy.

Solo-owner model: `@akurteshi-guardentra` is merge authority. **Optional** `review:*` labels may identify a reviewer when requested; review does not block merge after required CI passes.

| Work type | Candidate writer (`tool:*`) | Optional support/review (`review:*`) | Never sufficient as |
|---|---|---|---|
| Requirements/repository audit | Codex or another read-only analyst | Owner verification | Product approval |
| React/UI | Cursor, Codex, or Claude Code; one writer | Behavior/accessibility tests | Deployment proof |
| Backend/API/worker | Codex, Claude Code, or Cursor; one writer | Optional specialist review for sensitive paths | Self-approved security work without tests |
| Firebase Auth/Firestore/Storage/Functions | Assigned engineer/tool | Emulator/negative tests; optional security review | Console-only proof |
| Terraform/CI/repository automation | Codex, Claude Code, or Cursor; one writer | Optional DevOps/security review | Unreviewed production change |
| Database/migration/audit chain/KMS | Assigned engineer/tool | Optional specialist review; owner authorization for merge | Evidence-free merge |
| Browser/UI evidence | Browser-capable QA tool | Owner QA verification | Proof of backend side effects |
| Firebase console assistance | Gemini in Firebase | Repository and live-state evidence | Code author/reviewer |
| GCP editor integration | Google Cloud Code | Owner authorization and CLI/Terraform evidence | AI author or source of intent |
| Documentation | Assigned writer | Optional factual review | Substitute for implementation |
| Release/deployment | Approved CI/CD or owner operator | Post-deploy verification evidence | Autonomous AI action |

## Access tiers

| Tier | Capability | Default |
|---|---|---|
| T0 | Read and report | All tools when authorized |
| T1 | Edit docs/tests on a feature branch | Assigned writer |
| T2 | Edit application code on a feature branch | Explicit issue authorization |
| T3 | Change rules, IAM, schema, migrations, audit, infrastructure | Explicit issue + impact plan + stronger evidence; optional review recommended |
| T4 | Merge, deploy, production mutation, secret/key operation | Owner-controlled only (`commit, PR, and merge` / `deploy *` commands) |

## Selection rule

The dispatcher or owner assigns one writer per issue/branch. Selection is based on the issue, required access, relevant skill, and recent verified performance—not vendor benchmarks or an assistant recommending itself.

Do not introduce `writer:*` or `reviewer:*` GitHub labels. Use `tool:*` and optional `review:*` only.
