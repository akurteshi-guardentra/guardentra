# Phase 2 issue backlog

Stable IDs from the Drive starter-kit. Create as GitHub issues when ready
(`gh` + original `create-issues.sh` in the Drive folder).

## Functional requirements

| ID | Title |
|---|---|
| P2-F1 | Every tenant's data is stored and processed only in its assigned region |
| P2-F2 | Every material TPRM action produces an immutable, queryable audit record |
| P2-F3 | Audit record integrity is independently verifiable |
| P2-F4 | A tampered record is detected automatically |
| P2-F5 | Audit records can be exported for a customer's own auditors |
| P2-F6 | AI-assisted actions record provenance |
| P2-F7 | Assessment scope and answers are locked at defined workflow points |

## Sprint weeks

| ID | Title |
|---|---|
| P2-W0 | Foundations — Terraform for one env, Workload Identity Federation |
| P2-W1 | Regional isolation — second Firebase project, region router |
| P2-W2 | Audit persistence — Cloud SQL, guardentra_app role, durable outbox |
| P2-W3 | Hash chain — per-tenant chain_seq, verification API |
| P2-W4 | Technical hardening — Zod validation, per-tenant AI rate limits |
| P2-W5 | Validation, security review, and release |

## Definition of done (abbrev.)

P2-DOD-1 … P2-DOD-15 — see Drive `GuardEntra_Phase2_Developer_Implementation_Plan.md` §14.
Key gates: dual regions live, INSERT-only Postgres role, tamper fails verify, E2E under EU and US.
