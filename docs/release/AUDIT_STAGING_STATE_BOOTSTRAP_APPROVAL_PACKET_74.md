# Issue #74 isolated state bootstrap — exact-plan approval packet

Status: CONCRETE PLAN CHECKPOINT; not approved, not applied, not live verified.
Scope is Terraform state bootstrap only. SQL, migrations, secret operations,
application deployment, scanner changes and production remain outside this packet.

## Exact provenance

- Repository/PR: `akurteshi-guardentra/guardentra`, draft PR #183.
- Code branch: `infra/named-staging-audit-74`.
- Planned executable code: `1f56352a81e91c48950fea45ea572cd2140ea9b6`.
- Proposal-review documentation: `6d2db6eba86caed17e7daacf5ebada1c75d73436`.
- Provider: Google 6.50.0, readonly verified lock; Terraform Windows 1.15.8.
- Owner Windows root:
  `C:/Users/Admin/repos/guardentra-state-74/infra/bootstrap/isolated-staging-state`.
- Saved plan filename: `state-bootstrap-73b9b58c3fbb491ab698921e26747834.tfplan`.
- Owner-supplied SHA-256:
  `CB250BF233AF001005BAE761A534A94B3DDE98B5B2715625935B896D1D3B778C`.
- Owner terminal evidence: real saved plan, **4 add / 0 change / 0 destroy**; after
  correction/hash, no status output was reported. Raw plan remains on Owner's machine;
  assistant has reviewed terminal actions, not independently inspected its binary.

PowerShell correction: initial `-out=$gePlanPath` became a literal filename. The
successful plan was renamed, not regenerated, and then hashed. Always pass future
native arguments as `"-out=$gePlanPath"`; verify the saved artifact exists before hash.
Hash must be rechecked immediately before any approved execution; do not apply a
replacement/regenerated artifact under approval for this hash.

## Reviewed actions

| Terraform resource | Exact intent |
|---|---|
| `google_project.state` | CREATE `guardentra-staging-state`, display name GuardEntra Staging State, org `280975227603`, billing `019203-E57CB3-666105`, deletion PREVENT, auto_create_network false |
| `google_project_service.storage` | Configure Storage API in the NEW project; disable_on_destroy false |
| `google_storage_bucket.state` | CREATE `guardentra-staging-state-tfstate`, NEW project, US-CENTRAL1 Standard, uniform access, public prevention enforced, force_destroy false, versioning enabled, soft delete 604800 seconds |
| `google_storage_bucket_iam_member.operator` | ADD bucket Object Admin for `user:admin@guardentra.com` only |

Project and bucket also have Terraform prevent_destroy. No organization IAM change,
state-project service account/key/runtime grant, existing staging/production/legacy
resource update, SQL or DNS resource appears in the reviewed terminal plan.

Provider execution side effects are ALSO in proposed scope: the new project's
initial default network can be transiently created and removed; Compute API is
implicitly enabled by auto_create_network=false. Google project provisioning can
create default APIs/service identities. The four-resource summary is not a claim
that those implicit service actions do not exist. No staging scanner/VPC/NAT change.

## Evidence and limits

Owner metadata: organization active, domain guardentra.com, customer `C02fbgmro`
matches allowed-member policy; billing open USD under same org. Organization IAM
snapshot grants only the human operator. Four unconditional application Storage
roles remain in staging, not proposed in the state project. Runtime Token Creator is
account-level self access. Candidate bucket lookup 404; project describe 403 does not
prove globally available project ID. Creation conflict means STOP, not import/adopt.

Exact-code CI 37980491095 and infra-ci 37980490973 PASS; all four roots validate,
PostgreSQL role contract PASS, six mocked plan guardrails PASS. Owner Windows fmt,
readonly-lock init, validate and six tests PASS. A real cloud plan is now evidenced;
this is not live resource creation, effective permission denial or #74 acceptance.

Local ADC file exists; no reported inline/file/token overrides among checks supplied.
Actual ADC identity still requires a metadata-only identity check without token
output. Do not replace existing credentials unnecessarily or upload credential files.

## Proposed cost, residency and custody

USD illustrative monthly cost: 1 GiB average TOTAL current/retained/soft-deleted state,
1,000 Class A and 1,000 Class B operations gives approximately **0.0254/month** at
2026-10-09 published US-CENTRAL1 Standard pricing. Excludes network, tax, currency/free-
tier/account-specific effects and growth. No automatic version purge or hard cost cap.
No Cloud SQL cost is included in this state-only packet.

Proposed state metadata location: US-CENTRAL1, matching staging runtime/scanner region.
Owner residency/cost acceptance remains required. Application/customer audit-record
residency is a separate database gate, not implied by accepting state location.

Bootstrap state remains LOCAL in the isolated Windows root. Before apply, select and
verify encrypted storage/recovery custody for local bootstrap state and the retained
plan, separate from source control. Disk-encryption and backup destination evidence
are pending. Do not claim a worktree or ignore rule supplies encryption or recovery.
No remote backend initialization/state writes are authorized by this packet alone.

## Apply gate and failure/rollback handling

Do not apply yet. Remaining prerequisites before asking for the final exact-plan
approval: actual ADC principal, protected local storage and durable backup/custody
choice, final reviewed residency/cost acceptance scope and post-bootstrap access-test
method. Fresh relevant policy/IAM metadata and hash/code integrity must hold at apply.

Owner approval must explicitly cover this hash and state-only project/billing/API/
transient-network-cleanup/bucket/operator-binding scope. No SQL/runtime/production
permission is included. Approval must also specify the controlled empty-bucket test
writes, if any; live tests must pass before state/backend/lock writes are allowed.

If approved apply fails, stop and retain local state and created resources. Record
partial status; prepare a fresh corrective plan and obtain approval before remediation.
Never automatically destroy/recreate/import, force-unlock or retry uncertain writes.
For application rollback, retain this project, bucket, state and versions. Any eventual
state-project decommission or access change requires separate approved recovery steps.

After bootstrap: read back project/billing/services/bucket/IAM, verify no inherited
runtime/alternate-account route, prove operator access and runtime object/policy denial
with an approved mechanism, and document recovery custody. Then obtain explicit write
scope for remote backend initialization/locking before the database plan is generated.

Source: Owner authenticated CLI outputs in this session, issue #74 and preparation
packet; Google Storage pricing and provider project behavior:
https://cloud.google.com/storage/pricing
https://registry.terraform.io/providers/hashicorp/google/6.50.0/docs/resources/google_project
https://docs.cloud.google.com/iam/docs/service-account-permissions
