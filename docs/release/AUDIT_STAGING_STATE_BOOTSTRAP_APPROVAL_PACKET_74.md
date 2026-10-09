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
Owner-supplied identity output confirms ADC email admin@guardentra.com and
email_verified true. Tokens and credential file contents are not recorded. Do not
replace existing credentials unnecessarily or upload credential files.

## Proposed cost, residency and custody

USD illustrative monthly cost: 1 GiB average TOTAL current/retained/soft-deleted state,
1,000 Class A and 1,000 Class B operations gives approximately **0.0254/month** at
2026-10-09 published US-CENTRAL1 Standard pricing. Excludes network, tax, currency/free-
tier/account-specific effects and growth. No automatic version purge or hard cost cap.
No Cloud SQL cost is included in this state-only packet.

Proposed state metadata location: US-CENTRAL1, matching staging runtime/scanner region.
Owner residency/cost acceptance remains required. Application/customer audit-record
residency is a separate database gate, not implied by accepting state location.

Owner selected cloud custody and explicitly rejected enabling/changing Windows
BitLocker. The read-only output supplied earlier reported C: FullyEncrypted with
ProtectionStatus On; this is an existing-device observation, not a requested change.
No further Windows encryption inspection or modification is part of this work.

Proposed cloud custody sequence:

1. Apply only the exact approved bootstrap plan. Initial state necessarily remains
   local until the bucket exists. Preserve local state and the saved plan; no cloud
   backup exists during this short bootstrap interval. A lost PC/state in that interval
   requires reconciliation, never blind re-apply or automatic import.
2. Read back the new project, billing, APIs, bucket privacy/versioning/soft delete and
   project/bucket/ancestor IAM. Reconcile runtime and alternate-account access paths.
   State objects must not be uploaded until isolation evidence passes.
3. After approval of the bounded test method, use synthetic objects under
   guardentra/verification/74/<unique-run-id>/ to prove operator create/read and
   runtime denial. Tests must not grant runtime impersonation or new IAM privileges.
   An inability to test is BLOCKED, not a denial PASS. Delete only the synthetic current
   objects; soft-deleted versions may remain billed. Never read application secrets.
4. Prepare a GCS backend migration using bucket guardentra-staging-state-tfstate and
   a separate bootstrap prefix guardentra/bootstrap/isolated-staging-state. Keep the
   audit prefix guardentra/named-staging/audit separate. Review/approve the exact
   migration commands before execution; never change the backend before applying this
   saved local-backend plan. Use init -migrate-state, not force-copy or state push.
5. Verify remote state lineage, serial and expected four resource addresses without
   printing state contents, and verify a version-specific recovery download to a new
   local path by checksum. Preserve local recovery copies until verification succeeds.
   Bucket versions/soft delete provide recovery in the same project, not an independent
   disaster backup. Later independent backup/KMS policy requires a separate design.

Cloud Storage default Google-managed encryption at rest is the selected proposal.
No KMS keys, Windows encryption settings or new encryption IAM are required by it.
Backend migration, test writes and recovery downloads are prepared next; they are not
performed or implicitly authorized by approving creation alone.

## Apply gate and failure/rollback handling

Do not apply yet. Remaining prerequisites before asking for the final exact-plan
approval: final reviewed residency/cost acceptance and acceptance of the temporary
local-state interval in the cloud-custody proposal. ADC identity and existing disk
status are now evidenced. Fresh relevant policy/IAM metadata and hash/code integrity
must hold at apply.

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

Cloud custody references:
https://docs.cloud.google.com/storage/docs/encryption/default-keys
https://developer.hashicorp.com/terraform/language/backend/gcs
