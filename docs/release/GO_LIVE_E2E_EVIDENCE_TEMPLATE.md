# GuardEntra current-source staging -> production E2E evidence template

> Issue: #124
>
> This is an evidence contract, not runtime proof. Do not mark any runtime field PASS
> until it is observed against the exact release SHA in the named environment.
> `MERGED != STAGING_LIVE_VERIFIED != PRODUCTION_LIVE_VERIFIED`.

## Dependency gate

Before the staging journey starts, record all of the following as PASS with exact evidence:

- #72 invitation email delivery is live accepted.
- #73 production scanner parity/proof is ready for promotion.
- #74 staging audit spine is live accepted.
- #126 legacy `guardentra-7f582` automatic main-rollout integrity is resolved and read back live.
- protected `main` / release SHA is exact and required CI is green.
- release/config drift check is PASS.
- rollback baseline is recorded.

If any dependency is not evidenced, set the overall result to `BLOCKED` and stop
only this release lane. Do not infer runtime absence from denied access.

## Result vocabulary

Use only:

- `PASS` - directly observed and bound to exact SHA/environment.
- `PARTIAL` - some required evidence exists but acceptance is incomplete.
- `BLOCKED` - required authority/dependency is unavailable; absence is unproven.
- `FAIL` - the required behavior was directly observed to fail.

## Canonical machine-readable evidence

The only machine-readable `guardentra.go_live_e2e.v1` schema is:

`docs/release/GO_LIVE_E2E_EVIDENCE_TEMPLATE.json`

Do not define or infer an alternate v1 structure from this Markdown file. This document is
narrative guidance for operating the canonical JSON contract. During execution, copy the JSON
template, preserve its field names and lifecycle semantics, and populate only directly observed,
redacted evidence for the exact repository SHA and named environment.

## Staging journey

Use controlled test data only. Record one evidence row per step.

| # | Required observation | Result | Evidence/source |
|---|---|---|---|
| 1 | Controlled pilot org admin can create/sign in | BLOCKED | |
| 2 | Tenant bootstrap is server-authoritative | BLOCKED | |
| 3 | Test vendor persists and reloads | BLOCKED | |
| 4 | Assessment is created with stamped pack IDs/version | BLOCKED | |
| 5 | Invitation is sent through the real release path | BLOCKED | |
| 6 | `QUEUED -> PROVIDER_ACCEPTED -> INBOX_RECEIVED` is independently evidenced | BLOCKED | |
| 7 | Vendor portal opens through the real invitation path | BLOCKED | |
| 8 | Questionnaire answer persists across reload | BLOCKED | |
| 9 | Clean evidence transitions `scan_pending -> clean` | BLOCKED | |
| 10 | EICAR fixture is quarantined/fails closed | BLOCKED | |
| 11 | Assessment submit succeeds without false success | BLOCKED | |
| 12 | Review/decision persists residual-risk + remediation evidence | BLOCKED | |
| 13 | Decision packet/export is generated and readable | BLOCKED | |
| 14 | Audit event -> outbox -> worker -> hash chain -> verify/export is evidenced | BLOCKED | |
| 15 | Refresh/re-login proves durable state | BLOCKED | |
| 16 | Health/log evidence is collected without customer data or secrets | BLOCKED | |

### Staging integrity checks

- Email acceptance keeps `QUEUED`, `PROVIDER_ACCEPTED`, and `INBOX_RECEIVED`
  as distinct states.
- Exact-one-consumer proof is required for invitation delivery.
- Malware acceptance uses controlled clean/EICAR fixtures, never customer files.
- Tenant/org/assessment identifiers in evidence must be synthetic or redacted.
- Audit acceptance includes tamper detection and stale-lease/crash-retry
  exactly-once behavior required by #74.

## Production promotion gate

Production promotion is permitted only after every required staging step is PASS
on the exact release SHA.

Before deployment record:

- protected main/release SHA re-read;
- staging deployed source SHA matches the accepted release SHA;
- production config/source drift result;
- exact production rollback baseline;
- approved production deployment path;
- health/readback commands and expected safe outputs;
- cleanup plan for controlled test data.

No direct-main write, ad-hoc deploy path, destructive migration, secret-value
logging, authority widening, or test weakening is permitted.

## Production bounded smoke/E2E

| # | Required observation | Result | Evidence/source |
|---|---|---|---|
| P1 | Production build/revision reports exact accepted source SHA | BLOCKED | |
| P2 | Health/readback PASS after deployment | BLOCKED | |
| P3 | Controlled org/vendor/assessment flow reaches a durable decision | BLOCKED | |
| P4 | Invitation delivery proves provider acceptance and inbox receipt | BLOCKED | |
| P5 | Clean evidence is accepted by the production scanner | BLOCKED | |
| P6 | EICAR fixture fails closed/quarantines | BLOCKED | |
| P7 | Required production audit behavior is evidenced if enabled by release scope | BLOCKED | |
| P8 | Refresh/re-login proves durable state | BLOCKED | |
| P9 | No staging/prod cross-environment data/config leakage is observed | BLOCKED | |
| P10 | Controlled test data cleanup PASS | BLOCKED | |

## Final evidence and readiness

Final staging, production, cleanup, blockers, and go-live classification must be recorded in the
canonical JSON evidence artifact above. The JSON contract's `final_classification`, per-environment
`overall_result`, step results, blockers, and invariant fields are authoritative. Readiness
scorecard references may be attached as evidence sources, but must not create a second schema.

Rules:

- Never raise readiness points from roadmap text, screenshots, repository merges,
  CI alone, or another environment's evidence.
- Every non-missing runtime point needs exact SHA + matching environment evidence.
- A deployment success without health/readback and required runtime acceptance is
  not `PRODUCTION_LIVE_VERIFIED`.
- Any failure or blocker must identify the exact step, source, observed UTC and
  whether rollback/cleanup changed state.
- Evidence must not contain tokens, secret values, raw auth output, customer data,
  or unredacted principal identifiers beyond what the governing evidence packet
  explicitly permits.
