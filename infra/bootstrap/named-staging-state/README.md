# Named-staging Terraform state bootstrap (#74)

Preparation only. No apply or backend creation is authorized by this directory.

This root uses local state and proposes exactly two Terraform resources:
- staging-only GCS bucket `guardentra-staging-tfstate-965959469996`;
- one bucket-scoped `roles/storage.objectAdmin` grant to an Owner-verified Terraform
  operator supplied through `state_operator_member`.

The resource count is design intent, not an executed plan. First verify the project
number and global bucket availability/ownership through authenticated read-only
inventory. If the bucket exists, stop: do not adopt, overwrite, or import it casually.

The bucket uses US-CENTRAL1, STANDARD storage, uniform access, public access prevention,
object versioning, seven-day soft deletion, `force_destroy=false`, and Terraform
`prevent_destroy`. There is no automatic version purge or application/runtime grant.
Inherited project IAM still applies; inventory it before approving access. State
storage, operations, versions and soft-deleted bytes are billable; include them in the
final cost estimate after pricing verification and usage assumptions.

The audit root's proposed prefix is `guardentra/named-staging/audit`. Do not use the
Firebase application bucket or historical eu-staging state. Retain the local bootstrap
state securely; after approved creation, decide and document its durable custody before
changing computers or discarding this worktree. Never commit state or saved plans.

After verified identity and bucket inventory, a local bootstrap plan can be prepared:

```bash
terraform init -input=false -lockfile=readonly
terraform validate
terraform plan -input=false \
  -var='project_id=guardentra-staging' \
  -var='state_operator_member=<OWNER_VERIFIED_PRINCIPAL>' \
  -out=state-bootstrap.tfplan
```

The placeholder intentionally requires substitution. Keep the plan private; share
only reviewed resource identifiers/actions, operator metadata, and cost assumptions.

Owner approval of the exact bootstrap packet is required before bucket/IAM creation.
Only then may the audit root initialize its new GCS backend and generate the final
database plan. Initialization/planning may write lock objects; include that scope in
bootstrap authorization. SQL provisioning, migrations, secret operations, runtime
enablement and deployment remain gated by the final staging packet.

Rollback: preserve the bucket, versions and state for recovery; never destroy it as
part of an application rollback. Removing an erroneous operator binding requires an
approved correction and verified alternative recovery access.
