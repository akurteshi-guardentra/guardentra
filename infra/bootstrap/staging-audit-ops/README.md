# Staging audit credential isolation — UNAPPLIED CANDIDATE

Owner's fresh IAM metadata confirms unconditional project-level Secret Accessor for
staging runtime, Cloud Build and App Hosting principals. Staging runtime/hosting also
have project-wide Secret Version Manager. A new resource binding to a migrator-only
secret in that project does not remove inherited allow grants. This is an allow-policy
observation, not a complete evaluation of IAM deny/PAB or a live payload access test.

The candidate proposes four Terraform-managed additions:
1. guardentra-staging-audit-ops project under org 280975227603 and the explicitly
   validated billing account, no default VPC, PREVENT deletion policy/prevent_destroy.
2. Secret Manager API in that new project.
3. AUDIT_BOOTSTRAP_ADMIN_PASSWORD_74 empty secret metadata, user-managed us-central1.
4. AUDIT_MIGRATOR_PASSWORD_74 empty secret metadata, user-managed us-central1.

There are NO secret versions/values, service accounts, IAM grants, jobs, SQL updates,
application changes, bucket changes or production resources in this candidate.
No admin/migrator credentials enter Terraform state. The existing state-only project
is preserved. Later exact secret-level grants to separate job identities require a
separate reviewed packet; the application runtime must receive no operations grant.
Human inherited Owner and Google service-agent policy must be inventoried after any
approved apply. Do not call the empty shells isolated credential proof.

Use separate GCS state prefix guardentra/bootstrap/staging-audit-ops in the existing
isolated state bucket only after metadata proves the prefix unused and custody is
reviewed. Never use the existing SQL/bootstrap prefixes or migrate their state here.
Default-false review gate blocks normal planning. This is not a ready-to-apply plan.

Before live planning: publish/validate the exact source and provider schema/mocks;
check project-name ownership/availability, billing/org/effective policies, ADC identity,
operator/backend access, residency, pricing and custody. A denied describe cannot
prove a globally unique project name is available. Collision/failure means stop;
never import or overwrite an existing project/secret without review.

Provider project creation can temporarily enable Compute and remove a newly created
default VPC despite auto_create_network=false. Include those service effects in any
future exact approval. No manual staging networking change is proposed. Secret Manager
charges depend on active versions/access/replicas; this root creates no versions, and
no cost ceiling is claimed. Verify official pricing before apply approval.

Do not execute init/plan/apply using a prior SQL approval. Any real plan is new scope.
Post-apply checks must verify project IAM, secret IAM and intended region/API; prove
runtime has no allow grant for ops secret access and job access is scoped only to its
required secrets. Preserve deny/PAB limitations; never test by retrieving real admin
credentials through the application identity. Any live negative test uses synthetic data.

Rollback: preserve ops project/secret metadata and versions/state; no automatic destroy,
password reset, removal of existing IAM, job execution or secret version destruction.
This candidate does not resolve postgres credential bootstrap, password provisioning,
job packaging/deployment or app connection integration. Those gates remain open.
