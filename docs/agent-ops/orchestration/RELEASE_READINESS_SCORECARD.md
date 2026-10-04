# Release-readiness scorecard (#69)

GuardEntra uses two independent 100-point scores:

1. Engineering Delivery Progress
2. Production Go-Live Readiness

The score is evidence-weighted, not a percentage of code written.

## Engineering weights

- security / tenant isolation / authorization: 20
- core vendor-to-assessment-to-decision lifecycle: 25
- durable persistence / data integrity: 15
- email / scanner / audit infrastructure implementation: 15
- release verification / E2E / environment drift: 10
- pilot UX / progressive onboarding: 5
- orchestration / agent safety / delivery tooling: 10

## Production weights

- tenant isolation / authorization: 15
- core lifecycle integrity: 15
- durable cloud persistence / no false-success: 10
- evidence trust + production malware scanning: 10
- invitation / notification delivery: 10
- audit trail / observability / recovery: 10
- runtime release verification / config drift: 10
- findings -> residual risk -> remediation -> report / next review: 10
- customer trust pack / privacy / legal readiness: 10

Use `scripts/guardentra.ps1 readiness -BodyFile <file>`.

The calculator fails closed on unknown stages, missing exact SHAs, missing evidence, or environment mismatch. It does not read roadmap status or infer production readiness from merge/CI.
