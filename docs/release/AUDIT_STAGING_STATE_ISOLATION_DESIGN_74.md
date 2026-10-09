# Issue #74 isolated staging state proposal — 2026-10-09

Status: PREPARATION CHECKPOINT. Recommended design, not an approved cloud change or
an executed Terraform plan. Application RC remains
`8db71492f5c1eac4d74b47ec239e4e94acac20ff`; prior tested preparation head is
`d899176e8eb7b4b377fbfec8f509b82927d3c697`, draft PR #183.

## Verified input and limits

Owner supplied collector metadata captured at `2026-10-09T01:45:34.8278659Z`:
project `guardentra-staging`, number `965959469996`, ACTIVE, directly parented by
organization `280975227603`. All ten runtime project bindings are unconditional.
Four grant overlapping Storage access: `roles/firebase.admin`,
`roles/firebase.sdkAdminServiceAgent`, `roles/firebaseapphosting.computeRunner`, and
`roles/storage.objectViewer`. The first three permit object writes/deletes; Firebase
Admin also permits bucket IAM changes. The same-project state candidate is blocked.

Subsequent authenticated Owner CLI output in this session confirms:

- Organization IAM policy etag `BwZZbmEpFkA=` lists only `user:admin@guardentra.com`,
  in Billing Admin, Owner, Organization Admin and Project Creator roles. No runtime,
  group or public principal appears in this returned policy.
- Active projects returned directly under that organization: `guardentra-prod`,
  `guardentra-staging`, `guardentra-7f582`. This is not an exhaustive inventory of
  folder descendants, inaccessible or inactive projects. No dedicated state project
  was identified; do not repurpose the legacy or production project.
- Firebase Admin SDK account-level policy returns only etag `ACAB`, with no bindings.
  Its project-level grants still include Storage Admin and Service Account Token Creator.
- Runtime account-level policy etag `BwZZb4vFgHs=` grants Token Creator only to that
  same runtime account. This is a self-token grant, not permission to impersonate an
  unrelated state identity. It is not proposed for removal.
- The ten collected runtime role definitions contain no `iam.serviceAccounts.*`
  permission. These observations do not prove absence of all indirect access paths.

No secret values, credential tokens, customer data or full IAM dump are committed.
These are metadata snapshots, not a live effective-access test or perpetual proof.

## Recommended boundary and proposed resource intent

| Item | Proposal | Remaining verification |
|---|---|---|
| State project | `guardentra-staging-state` | Global ID availability (describe 403), effective policies and exact plan |
| Parent | Organization `280975227603`, directly | Fresh inherited policy review before execution |
| State bucket | `guardentra-staging-state-tfstate` | Lookup 404; global name availability and final plan remain unproven |
| Location | `US-CENTRAL1` | Policy compatibility and explicit residency approval; US state metadata storage |
| Operator | `user:admin@guardentra.com` | Effective project/billing permissions and credential method |
| State prefix | `guardentra/named-staging/audit` | Exact backend configuration after bootstrap approval |
| Application infrastructure | Remains in `guardentra-staging` | Existing database/network/app packet still applies |

Prepared root: `infra/bootstrap/isolated-staging-state`, still blocked for live planning.
It restricts the project, organization, verified billing account and human operator.
It does not enable Firebase. Provider `auto_create_network=false` removes a transient
new-project default network and implicitly enables Compute API; the earlier intent
to avoid any network creation was too strong. These new-project side effects must be
included in the exact bootstrap approval scope; staging networks are not changed.
Expected resource intent: project with billing association, required Storage API
configuration, state bucket, and bucket-scoped operator Object Admin binding. This is
not a verified resource count; project provisioning can create service identities and
default API configuration, which must be covered in the execution packet.

Do not edit or activate the blocked same-project bootstrap. Do not remove staging
Firebase/Storage roles, change scanner networking, change organization IAM or create
an application grant in the state project. Existing application permissions stay in
place while the proposed state boundary changes.

Bucket intent: uniform access, public access prevention, object versioning, seven-day
soft deletion, no automatic version purge, `force_destroy=false`, and destruction
protection. Current project/bucket IAM inheritance and recovery access must be
reviewed. State storage, operations, retained versions and soft-deleted bytes are
billable; pricing and usage assumptions remain required before approval.

Use the verified human operator initially; no state service account, key or Token
Creator grant is proposed. Any later CI/state identity requires a separate least-
privilege and impersonation review. Billing linking and project creation are cloud
mutations and remain unauthorized until the exact bootstrap packet is approved.

## Ordered plan and approval boundaries

1. Collect billing association, organization-policy metadata and candidate project/
   bucket lookups. A 403 or 404 is not proof of global availability; record the gap.
2. Prepare and validate the guarded root and local-state plan. Do not initialize a
   remote backend. Record credential mechanism, exact actions, costs, residency,
   bootstrap-state custody and inherited IAM review. Plan creation is not apply approval.
3. Obtain Owner approval of that concrete project/billing/service/bucket/IAM bootstrap
   packet. This includes a scope extension beyond `guardentra-staging` for state only.
4. Apply only the approved bootstrap, capture metadata readback, and verify fresh IAM
   plus effective access to the empty bucket before any remote state/lock write.
5. Prove operator read/write/locking/recovery access and runtime denial of object
   get/list/create/update/delete and bucket IAM changes. Review alternate staging
   identities and impersonation paths. Use an approved test mechanism; do not add
   Token Creator grants or deploy a test revision merely to run these checks.
6. Only after isolation checks pass and the approved write scope covers it, initialize
   the application root's GCS backend, prepare the database plan, and request final
   staging approval. Bootstrap approval does not authorize SQL, secret payload access,
   migrations, app rollout or production changes.

A future access test must report explicit ALLOW/DENY or blocked results. Empty bucket
or empty service-account policy is not itself a denied-access test. No live token
minting, state/object writes, IAM changes or deployment was performed in this review.

## Impact, rollback and remaining work

Security impact: proposed Terraform state isolation from broad application Storage
permissions. No product behavior, migration, secret or scanner change in this document.
Rollback before apply: revise/revert this preparation proposal. After an approved
bootstrap, preserve the project, state bucket, versions and local bootstrap state;
do not delete state infrastructure as application rollback. Correct IAM only through
an approved packet with an alternative recovery principal verified first.

Still pending: billing and policy metadata, global identifiers, guarded Terraform root
and exact plan, operator credentials, costs, residency approval, state custody and
negative access tests. Existing database connection/TLS/identity, migrations/retention
ownership, retained rollback-image proof and live #74 acceptance remain separate gates.
Optional reviewer: NONE. Owner remains merge and cloud-execution authority.

References:
https://docs.cloud.google.com/storage/docs/access-control/iam
https://docs.cloud.google.com/iam/docs/service-account-permissions
https://docs.cloud.google.com/sdk/gcloud/reference/billing/projects/describe
https://docs.cloud.google.com/sdk/gcloud/reference/org-policies/list


## 2026-10-09 subsequent preparation checkpoint

Owner billing lookup confirms account `019203-E57CB3-666105`, billing enabled.
Organization Policy API query returned SERVICE_DISABLED in staging; Resource Manager
fallback returned seven configured organization policies, including uniform bucket
access, allowed customer `C02fbgmro` and service-account key/default-IAM restrictions.
No API was enabled by this preparation. Verify allowed-customer membership and
applicable custom/default/effective policy limits before live plan.

New guarded root declares four resources and is added to cloud-neutral CI with six
mocked plan tests; existing roots and application RC are retained. Provider lock is
copied unchanged from the signed/checksum-verified 6.50.0 Linux/Windows selection.
Billing/name metadata narrows the proposal; live isolation, operator credentials,
cost/residency/custody and exact plan remain pending. Mocked tests are not live plans.
