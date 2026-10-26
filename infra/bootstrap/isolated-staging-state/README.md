# Isolated staging Terraform state bootstrap (#74)

PREPARATION ONLY: local state, no cloud auth in CI, no live plan/apply or remote
backend initialization authorized. Use this new root only for the proposed
`guardentra-staging-state` project. The earlier same-project root remains blocked.

## Resource and execution scope

Four declared resources: new project with billing association, Storage API
configuration, private GCS state bucket, and one human operator bucket IAM member.
Fixed organization `280975227603`, project `guardentra-staging-state`, bucket
`guardentra-staging-state-tfstate`, location US-CENTRAL1 and quota project
`guardentra-staging`. Billing input accepts only the verified account
`019203-E57CB3-666105`; operator accepts only `user:admin@guardentra.com`.
No service-account creation, key, runtime grant, staging/scanner network change,
Firebase configuration, secret, SQL, application rollout or production resource.

IMPORTANT provider behavior: `auto_create_network=false` removes the new project's
initial default network and implicitly enables Compute API in that NEW project.
It does not guarantee zero transient network creation or Storage-only API enablement.
Project provisioning can also create default APIs/service identities. These hidden
provider/service actions must be explicitly included in the reviewed bootstrap packet;
no organization policy change to skip network creation is proposed here.

Project uses PREVENT deletion policy plus prevent_destroy. Bucket uses prevent_destroy,
force_destroy=false, uniform access, public access prevention, versioning and seven-day
soft deletion. No automatic version purge. Preserve state and bootstrap project during
application rollback; deletion/recovery access changes require separate approval.

## Inputs and gates

Owner billing lookup confirms staging billing enabled on the account above.
Resource Manager policy fallback succeeded: uniform bucket access enforced,
allowedPolicyMemberDomains restricted to directory customer `C02fbgmro`, no automatic
IAM grants to default service accounts, and service-account key restrictions. This
root requires no keys or default-account grants. Confirm the proposed operator's
membership in that allowed customer; existing grants are not proof of new-grant
admission. Listed policies do not prove all custom/default/effective constraints.
The Organization Policy API is disabled in the staging quota project; do not enable
it as part of this preparation.

Candidate bucket lookup returned 404; candidate project describe returned 403.
Neither result proves global identifier availability. Do not adopt/import an existing
project/bucket if creation conflicts. Reconcile before any execution.

`state_isolation_review_complete` defaults false and blocks project planning. Record
technical review of policy/name/operator/cost/residency/custody/access-test design
before setting it true for a LIVE plan. This flag is NOT Owner apply approval or proof
of live denied access. The billing account input is deliberately required.

Cloud-neutral checks (no credentials, no remote backend):

```powershell
terraform fmt -check
terraform init -backend=false -input=false -lockfile=readonly
terraform validate
terraform test -no-color
```

Tests mock the Google provider and use plan only. They verify refusal of production
project, different organization/billing account, runtime operator and unreviewed plan,
plus intended privacy and recovery settings. They do NOT test live IAM, costs, policy
admission, name availability or remote state writes.

Do not run a live plan yet. First review the pending residency/cost/credential/custody
and name/policy questions. After that review, prepare the saved local-state plan and
request Owner approval for its exact project/billing/API/network-cleanup/bucket/IAM
scope. A future approved bootstrap must verify operator access and runtime denial on
the empty bucket before any real Terraform state/lock object is written. Backend
initialization needs approved write scope; database/migration/runtime approval remains
separate. Never commit plans, tfstate, tfvars, passwords or credential files.

References and broader approval sequence:
`docs/release/AUDIT_STAGING_STATE_ISOLATION_DESIGN_74.md`
https://registry.terraform.io/providers/hashicorp/google/6.50.0/docs/resources/google_project
https://docs.cloud.google.com/storage/docs/access-control/iam
