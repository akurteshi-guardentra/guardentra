# Issue #74 preparation correction task packet

- Updated UTC: 2026-10-08
- Repository: `akurteshi-guardentra/guardentra`
- Issue/source: #74 acceptance criteria; #183 existing preparation;
  `docs/release/AUDIT_STAGING_OWNER_APPROVAL_PACKET.md`;
  Owner-supplied authenticated CLI inventory in this session.
- Verified starting branch/head: `infra/named-staging-audit-74` /
  `766f8bdd11fcfa1296e36a56e3496a04584193e3`.
- Exact application RC: `8db71492f5c1eac4d74b47ec239e4e94acac20ff`.
- Management: Engineering/Release and QA responsibilities handled by the assigned
  single preparation writer, Codex. No parallel branch writers or review agents engaged.
- Classification: T3 migration/infrastructure preparation; CHECKPOINT until exact-head
  CI and cloud plans are evidenced. Owner remains merge/deployment authority.
- Authorization: continue existing preparation, isolated validation and concrete plan
  packet. No cloud mutation, merge, deployment-connected push or production change.

## Scope and impact

Correct only the migration dollar-quote delimiters; retain the NOLOGIN privilege role
and append-only grants. Add PostgreSQL 16 SQL execution/repeat and negative privilege
tests, retain historical Terraform validation and include named-staging/bootstrap roots,
track platform-verified provider locks, and prepare the staging state bootstrap.

Affected paths: `.github/workflows/infra-ci.yml`, `.gitignore`,
`migrations/audit/002_roles.sql`, `scripts/audit-tests/`,
`infra/envs/named-staging/README.md` and lock file,
`infra/bootstrap/named-staging-state/`, and this release task/approval documentation.

No application API/UI behavior change. No schema/grant expansion. Bootstrap adds new
proposed staging bucket/IAM intent only, with no API execution. Customer data and secret
payloads are out of scope. Database identities, private TLS/connection method, pricing,
residency/retention ownership and rollback execution still require final reconciliation.

## Verification and evidence

- Bash syntax, YAML parsing, git diff whitespace and Terraform fmt/validate are local checks.
- Provider locks target Linux/Windows amd64, Google provider 6.50.0.
- CI must execute both migrations twice on PostgreSQL 16 and test a distinct LOGIN
  identity's positive and negative operations on synthetic job-local data.
- This does not prove the Node migration runner, Cloud SQL migration permissions,
  network/TLS, live event durability, retry handling, tenant isolation, email or scanner gates.
- Exact Terraform plan is pending verified bootstrap bucket/operator and cloud credentials.
- Production go-live evidence has not advanced; no numeric readiness score is inferred.

## Rollback and remaining decisions

Preparation changes may be reverted through a feature-branch PR; do not rewrite history.
The Owner's Windows email checkout and local migration correction are preserved.
Never destroy audit data/state or apply schema down-migrations as application rollback.

Still required: bootstrap availability/ownership and operator verification; local
bootstrap plan/cost/custody; explicit bootstrap authorization if creation is needed;
final audit plan, DB identity and private connection design; exact application RC versus
migration-preparation SHA provenance; final staging approval; live #74 acceptance.

Handoff evidence must state the final branch/SHA, PR #183, exact changed paths,
actual checks, working-tree state and NOT DEPLOYED status. No completion or live
acceptance claim is authorized by this task packet.

## 2026-10-09 bounded continuation

Owner requested continuation after supplying authenticated bucket/IAM metadata.
Runtime state access is not isolated by the current project policy. Preparation scope
adds `scripts/guardentra/Get-AuditStateInventory74.ps1`, its Windows PowerShell syntax
check in `.github/workflows/ci.yml`, a default-false state-bootstrap technical review gate,
bootstrap/release instructions and narrow ledger addenda. All code is metadata-only
or unapplied Terraform; no live IAM remediation is selected or authorized.

Relevant evidence: Owner's 404 bucket lookup and project IAM; public Google Storage
IAM and Firebase role references. Existing migration/app code remains unchanged.
Local checks: Terraform formatting, Git diff whitespace and workflow parsing.
CI must parse the collector on Windows PowerShell and validate the bootstrap root.
Collector execution and state-isolation permission tests remain pending Owner's
authenticated CLI output and a reviewed isolation design. Retain exact seven-field
checkpoint evidence; no apply, merge, production change or autonomous automation.


## 2026-10-09 read-only evidence reconciliation

Owner supplied the full collector report plus organization IAM, direct-child project
inventory and two service-account policies. Continue single-writer preparation with
an isolated-state proposal and narrow ledger/approval addenda; no new Terraform root,
cloud action or plan is claimed yet. Changed paths are this task packet, the owner
packet, `AUDIT_STAGING_STATE_ISOLATION_DESIGN_74.md`, PROJECT_STATE and append-only
PROJECT_TRANSITIONS. Check exact diff/whitespace and proposal consistency; no new
executable behavior or additional low-impact documentation tests are introduced.
Billing/policy/name inputs remain external dependencies. Revert through a feature PR;
never touch Windows dirty worktrees or apply without the exact approved packet.


## 2026-10-09 guarded isolated bootstrap preparation

Owner requested continuation with read-only billing/policy/name output. Scope adds
`infra/bootstrap/isolated-staging-state/` (main, README, provider lock and six mocked
plan tests), narrow .gitignore lock/plan rules, infra-ci fourth-root/test coverage,
isolation proposal and ledger reconciliation. No runtime or application RC change.
Tests: recursive Terraform formatting, whitespace and existing lock equality locally;
CI provider schema validation and six mock-only guardrail tests. Local provider process
validation remains unavailable in this managed runtime; CI is the execution verifier.
Impact/rollback: state isolation candidate only, fixed human principal and identifiers,
protected project/bucket. Provider temporarily creates/deletes new-project default
network and enables Compute; include in the future packet. Never edit staging scanner
networks or treat technical review as apply authorization. Live plan/deny tests/cost/
residency/custody remain pending; exact changed-file and seven-field evidence required.


## 2026-10-09 — #74 migration preparation boundary

Owner SQL metadata returns postgres only and confirms guardentra_audit exists.
Active revision audit flag is false, AUDIT_DATABASE_URL secret alias 3 / version 1,
no inline value; no payload inspected. Prepared cloud-job migration design in
docs/release/AUDIT_STAGING_MIGRATION_DESIGN_74.md with separate administrative,
migrator and runtime privileges, private authenticated transport and real-test gates.
Runner/image/bootstrap implementation and exact additional-cloud approval remain
pending. No credentials, SQL, job deployment, app config, merge or production changes.
Existing Node migration URL fallback and lack of app connector are integration gaps.

Continuation is design and metadata preparation only. Validate exact changed paths
and whitespace; no executable runner or live-test completion is claimed.


## 2026-10-09 — runner candidate and credential-isolation correction

Owner inventory returns no jobs, no matching audit service accounts and only staging
AUDIT_DATABASE_URL secret. Prepared isolated scripts/audit-managed-staging package,
locked connector/pg dependencies, exact-target/no-fallback guardrails, migration
checksums/advisory lock and restricted PostgreSQL 16 CI execution/privilege contract.
Local Node syntax and three unit tests PASS; real PostgreSQL/CI pending at publication.
No cloud build, role/password creation, secret write or job execution performed.

The candidate secret-placement design above is BLOCKED: earlier staging IAM grants
application runtime and build/hosting principals project-wide Secret Accessor.
Resource-level access assigned to a job cannot cancel inherited runtime access.
Do not create admin/migrator secrets in staging and claim separation. Fresh policy
and role metadata is needed before selecting isolated credential custody or scoped
IAM correction. No state-project repurpose, IAM removal, token/key creation or
password operation is authorized. Runner bootstrap, build context/base-image pin,
exact cloud execution packet and application connector integration remain pending.
