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


## 2026-10-09 — restricted runner real-database CI proof

Runner source SHA 057707e3b424e7ea2b12cdfc5ed8c13c3f1b0fd3 on
infra/named-staging-audit-74, draft PR #183. infra-ci run 37995757369 SUCCESS;
managed-audit-runner job 114041281705 SUCCESS. Logs confirm three scope/manifest
unit tests PASS and one real PostgreSQL 16 integration test PASS, zero failures.
The integration test applies both migrations as audit_migrator, repeats with zero
new applications, tests rollback-only app operations/denials, checksum tampering,
unexpected role inheritance and concurrent execution. Existing audit-migrations
fixture and all four Terraform root jobs also SUCCESS. Routine CI remains cloud-neutral.

Local npm ci --ignore-scripts, Node syntax, connector import/cleanup, three unit tests,
workflow YAML parse, dependency lock validation and git diff --check PASS. npm audit
--omit=dev reported zero vulnerabilities. No local PostgreSQL server was available;
real database test evidence comes from the CI service, not Cloud SQL. General CI
run 37995757403 also completed SUCCESS on the exact runner source SHA.

No cloud build/job/credential/bootstrap execution, app rollout, merge or production
change. Bootstrap SQL/secure credential custody and immutable image/execution packet
remain pending. Earlier runtime role definitions include secretmanager.versions.access
through project-level roles/secretmanager.secretAccessor; fresh IAM readback is next.

Exact runner-source changed files (Git diff from prior design head):
- .github/workflows/infra-ci.yml
- docs/agent-ops/PROJECT_STATE.md
- docs/agent-ops/PROJECT_TRANSITIONS.md
- docs/release/AUDIT_STAGING_MIGRATION_DESIGN_74.md
- docs/release/AUDIT_STAGING_PREPARATION_TASK_74.md
- scripts/audit-managed-staging/Dockerfile
- scripts/audit-managed-staging/README.md
- scripts/audit-managed-staging/core.mjs
- scripts/audit-managed-staging/manifest.json
- scripts/audit-managed-staging/package-lock.json
- scripts/audit-managed-staging/package.json
- scripts/audit-managed-staging/postgres.test.mjs
- scripts/audit-managed-staging/run.mjs
- scripts/audit-managed-staging/unit.test.mjs

Source checkout git status --short was empty after fetched GitHub commit reconciliation.
This is a preparation checkpoint, not #74 acceptance or a readiness score advance.


## 2026-10-09 UTC / 2026-10-10 Vienna — fresh secret-access policy checkpoint

Owner fresh project IAM output confirms runtime Cloud SQL Client and unchanged
project-wide Secret Accessor for runtime, Cloud Build and App Hosting; runtime/hosting
also have Secret Version Manager. Developer Connect retains an unconditional Secret
Manager Admin binding as well as an expired setup binding. No grant removed. This
confirms allow-policy exposure; deny/PAB and actual secret access were not evaluated.

Prepared local UNAPPLIED infra/bootstrap/staging-audit-ops candidate: separate project,
Secret Manager API and two region-pinned empty secret shells, no payloads/versions, IAM
bindings, jobs, SQL, state-project repurpose or application changes. Backend prefix must
be independently reviewed/unused; default-false review gate; separate exact-plan approval
required. New root/schema/mocks need CI publication/validation; no live plan performed.
Publication of the prior three-file checkpoint was auto-review rejected; Owner explicit
payload/destination authorization remains pending. No indirect retry or workaround.

Local credential-isolation candidate exact changed/untracked file list (NOT COMMITTED):
- .github/workflows/infra-ci.yml
- .gitignore
- docs/agent-ops/PROJECT_STATE.md
- docs/agent-ops/PROJECT_TRANSITIONS.md
- docs/release/AUDIT_STAGING_PREPARATION_TASK_74.md
- infra/bootstrap/staging-audit-ops/.terraform.lock.hcl
- infra/bootstrap/staging-audit-ops/README.md
- infra/bootstrap/staging-audit-ops/main.tf
- infra/bootstrap/staging-audit-ops/tests/guardrails.tftest.hcl

Local Terraform format/parse, workflow YAML/root wiring and diff checks PASS.
Provider schema, mocked plan execution and candidate CI NOT RUN; publication pending.
Runner source 057707e3b424e7ea2b12cdfc5ed8c13c3f1b0fd3 remains separately CI verified.


## 2026-10-09 UTC / 2026-10-10 Vienna — proposal publication authorization

After the explicit request to publish the nine-file credential-isolation proposal and
CI/documentation updates to GuardEntra draft PR #183, Owner directed “go ahead”.
Scope is repository publication and cloud-neutral CI validation only. No project/API/
secret creation, payload disclosure, IAM mutation, cloud plan/apply, merge or deployment
authorization is added. The earlier auto-review rejection remains recorded as history.


## 2026-10-10 — allowlisted migration build context checkpoint

Issue #74 preparation on infra/named-staging-audit-74 / draft PR #183, starting
bcb608e717bb4cf917785a07e3a2b5c827883662. Owner directed continuation toward dev,
test/staging and production rollout. This authorizes further preparation, not an
application release or production mutation. Added a Git-object-only eight-file
runner context generator requiring exact source SHA and Node base-image digest.
It rejects extra/modified SQL, mutable source refs and unpinned base inputs; a
receipt outside the context records hashes. No build submission/cloud mutation.

Local npm test PASS: five tests, zero failures, including two real disposable-Git
context/exclusion/negative tests and the existing three scope/manifest tests. The
new generator does not verify registry provenance or image availability. No local
PostgreSQL server: existing real PostgreSQL CI proof is unchanged; fresh CI pending
publication. Exact update files: scripts/audit-managed-staging/stage-context.mjs,
scripts/audit-managed-staging/stage-context.test.mjs,
scripts/audit-managed-staging/package.json, scripts/audit-managed-staging/README.md,
docs/release/AUDIT_STAGING_MIGRATION_DESIGN_74.md,
docs/release/AUDIT_STAGING_PREPARATION_TASK_74.md,
docs/agent-ops/PROJECT_STATE.md, docs/agent-ops/PROJECT_TRANSITIONS.md.
Source checkpoint NOT COMMITTED at preparation; working changes limited to this
list (verified by git status). No application deployment, merge, new secret version,
SQL/bootstrap execution, IAM mutation or production change. Rollback of this source
preparation is a feature-branch revert; it has no live resource side effects.

Deployment mapping is documented as dev -> guardentra-dev sandbox,
test -> guardentra-staging, main -> guardentra-prod. ENVIRONMENTS.md still says dev
"create when ready" and also contains stale "only demo exists" text, contradicted
by current staging/prod evidence; documentation is not live backend inventory.
Do not claim a live dev backend or deploy to legacy demo from those instructions.
The next actual app rollout remains blocked by bootstrap/credential/job setup,
live migrations and separate app connector/rollout approval. Production follows
staging durable events/chain/failure/rollback acceptance, never just Terraform apply.
No numeric readiness score or calendar deployment promise is minted here.


## 2026-10-10 — password-free bootstrap prerequisite preparation

Owner instructed continuation while away. Prepared source only, no new live cloud
or credential action. Starting head 141161bfb0dc6de96808a460796392519637c98f on
infra/named-staging-audit-74 / draft PR #183. One-time transaction candidate creates
restricted NOLOGIN audit_app/audit_migrator/audit_runtime and pgcrypto in an exact,
fresh PostgreSQL 16 database; existing roles/objects/owners fail for reconciliation.
Temporary database CREATE/actor SET grants for schema ownership are removed and
verified. No password payload or verifier is created, read or logged by live code;
roles remain unable to log in. This is outside the migration image allowlist and
has no cloud entry point/job. Credential setup and live bootstrap remain unapproved.

Added isolated real PostgreSQL 16 CI fixture with postgres stripped of superuser,
checking target/actor/lock/collisions, rollback, NOLOGIN/privilege/password absence.
Local npm test: five PASS; Node syntax, workflow YAML and diff check PASS. New real
bootstrap integration NOT RUN at local checkpoint (no native PostgreSQL; local apt
setup failed with UID/group restrictions, no escalation/workaround). CI publication
will be reported separately if permitted. Cloud-specific privileges remain unproved.

Exact source/checkpoint files: .github/workflows/infra-ci.yml;
scripts/audit-managed-staging/bootstrap-prerequisites.sql;
scripts/audit-managed-staging/bootstrap.test.mjs;
scripts/audit-managed-staging/package.json; scripts/audit-managed-staging/README.md;
docs/agent-ops/PROJECT_STATE.md; docs/agent-ops/PROJECT_TRANSITIONS.md;
docs/release/AUDIT_STAGING_MIGRATION_DESIGN_74.md;
docs/release/AUDIT_STAGING_PREPARATION_TASK_74.md. Checkpoint NOT COMMITTED at
preparation, working tree limited to these nine paths. No merge/app rollout/cloud
build/job/credential/SQL execution or production change. Rollback: source revert;
no live effect to reverse. No readiness score or deployment-date promise. Next
bounded gate is real fixture proof, then exact credential/job/bootstrap packet.
