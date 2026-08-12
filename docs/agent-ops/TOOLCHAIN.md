# GuardEntra Toolchain

GitHub is the coordination layer. No desktop AI application is a universal controller. Each task starts as an approved issue, receives one writing tool, and ends with evidence, independent review, and human approval.

| Work type | Candidate writer | Required support/review | Never sufficient as |
|---|---|---|---|
| Requirements/repository audit | Codex or another read-only analyst | Human product/technical lead | Product approval |
| React/UI | Cursor, Codex, or Claude Code; one writer | Accessibility and behavior tests; independent review as risk requires | Deployment proof |
| Backend/API/worker | Codex, Claude Code, or Cursor; one writer | Different tool plus human review for sensitive paths | Self-approved security work |
| Firebase Auth/Firestore/Storage/Functions | Assigned engineer/tool | Emulator/negative tests and named human security review | Console-only proof |
| Terraform/CI/repository automation | Codex, Claude Code, or Cursor; one writer | Human DevOps/security review | Unreviewed production change |
| Database/migration/audit chain/KMS | Assigned engineer/tool | Independent specialist/tool review plus named human approval | Self-approval |
| Browser/UI evidence | Browser-capable QA tool | Human QA verification | Proof of backend side effects |
| Firebase console assistance | Gemini in Firebase | Repository and live-state evidence | Code author/reviewer |
| GCP editor integration | Google Cloud Code | DevOps approval and CLI/Terraform evidence | AI author or source of intent |
| Documentation | Assigned writer | Document owner/factual reviewer | Substitute for implementation |
| Release/deployment | Approved CI/CD or human operator | Required human gates and post-deploy verification | Autonomous AI action |

## Access tiers

| Tier | Capability | Default |
|---|---|---|
| T0 | Read and report | All assigned reviewers |
| T1 | Edit docs/tests on a feature branch | Assigned writer |
| T2 | Edit application code on a feature branch | Explicit issue authorization |
| T3 | Change rules, IAM, schema, migrations, audit, infrastructure | Explicit issue + impact plan + independent review |
| T4 | Merge, deploy, production mutation, secret/key operation | Human-controlled only |

## Selection rule

The dispatcher recommends a writer, but the human owner assigns it. Selection is based on the issue, required access, relevant skill, recent verified performance, and reviewer independence—not vendor benchmarks or an assistant recommending itself.
