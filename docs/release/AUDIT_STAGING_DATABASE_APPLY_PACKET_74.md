# Issue #74 — exact staging database infrastructure apply packet

Status: Owner-approved plan APPLIED per Owner terminal output on 2026-10-09.
Independent post-apply metadata readback remains pending. Infrastructure creation only.
No runtime rollout, audit activation, DB user/password/secret operation or SQL migration.

## Provenance

- Repository branch infra/named-staging-audit-74, draft PR #183.
- Executable SHA 89637c01768808ecd203f89102c2dabe4707ee3a.
- Google provider 6.50.0, Terraform Windows 1.15.8, readonly dependency lock.
- Owner worktree C:/Users/Admin/repos/guardentra-db-plan-74/infra/envs/named-staging.
- Saved plan audit-db-corrected-8b3b9e78586148c4890635a2d992d01f.tfplan.
- SHA256 AA15806393F1872EFE907F5A295CFDC94C91914CB37EA977A81C2A9AEC9D08E9.
- Real replacement terminal plan: 8 add, 0 change, 0 destroy, existing default-network
  data read deferred to apply. Assistant reviewed terminal rendering, not plan binary.
- The earlier AE54CD1B... plan is superseded; never apply it.

## Exact actions

| Resource | Action and scope |
|---|---|
| google_project_service.required[compute.googleapis.com] | Configure staging Compute service, disable_on_destroy false |
| google_project_service.required[servicenetworking.googleapis.com] | Configure staging Service Networking service, disable_on_destroy false |
| google_project_service.required[sqladmin.googleapis.com] | Configure staging SQL Admin service, disable_on_destroy false |
| google_compute_global_address.audit_private_services | Reserve 10.20.0.0/16 on staging default VPC, name guardentra-staging-audit-psa |
| google_service_networking_connection.audit_private_vpc | Add Private Service Access peering on that VPC using reserved range |
| google_sql_database_instance.audit | Create guardentra-staging-audit, us-central1, PostgreSQL 16 Enterprise REGIONAL HA, 2 vCPU / 8 GiB / 20 GiB SSD, always running |
| google_sql_database.audit | Create empty guardentra_audit database on new instance |
| google_project_iam_member.runtime_cloud_sql_client | Add roles/cloudsql.client for firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com in staging |

API resources appear as Terraform additions because this is a new state root. They
are not evidence that currently enabled APIs must be enabled anew. Provisioning may
create normal Google SQL/Service Networking service identities and associated service-
agent grants. No manual organization policy/IAM redesign is proposed.

Instance has public IPv4 disabled, explicit ENCRYPTED_ONLY, Terraform deletion
protection, API deletion_protection_enabled, lifecycle prevent_destroy. Database and
reserved address have lifecycle prevent_destroy. The database resource's API deletion
policy still displays DELETE: lifecycle prevents Terraform deletion while config is
present; it is not independent protection against privileged SQL/API database deletion.
Seven retained backups and seven-day PITR logs; no claim of seven-year record retention,
backup restore success or independent disaster recovery. Disk auto-resizes without cap.

## Evidence, cost and acceptance scope

Fresh Owner metadata: 42 default subnets, 43 routes, no listed global addresses,
peerings or SQL instances. Candidate range has no overlap with returned primary
subnets or specific routes. Default 0.0.0.0/0 Internet route excluded from overlap
check. Snapshot must remain current; no proof against future routing changes.

Executable-head CI 37988873225 and infra-ci 37988873231 SUCCESS. All four Terraform
roots validate, named-staging five mock security tests PASS, isolated-state six tests
PASS, PostgreSQL migration/privilege contract PASS. Mock plans do not prove cloud
behavior. Real Owner replacement plan explicitly confirms both new protections.

State bucket is in separate project, default encrypted and versioned. Bootstrap state
uses separate prefix. Audit root uses guardentra/named-staging/audit, checked unused
before its initialization. Policy evaluation finds no runtime allow grant for seven
Storage permissions; deny explanation errors remain, no real runtime-denial claim.
Operator synthetic upload/version download/hash/cleanup and bootstrap migration PASS.

Illustrative on-demand monthly base using published Iowa Enterprise HA prices and
730 hours: 2 * 0.0826 * 730 = USD 120.596 CPU, 8 * 0.014 * 730 = USD 81.76 RAM;
20 GiB HA SSD approximately USD 6.80; if average retained backup usage is 20 GiB,
approximately USD 1.60. Working total approximately USD 210.76 (~211) before data
transfer, extra backup/log/storage growth, taxes and other services. This is an
estimate, not a hard cap, commitment purchase or account-specific quote. Backup usage
is total retained billable space, not assumed seven full 20-GiB copies. No CUD purchase.
Published rates reference: https://cloud.google.com/sql/pricing

Database region is us-central1 to match current staging application/scanner. Backup
placement is not explicitly pinned in this plan; read back service-selected location
before ingesting audit/customer records. No production, legacy or scanner deletion/
replacement appears in this plan. New PSA peering changes staging VPC connectivity;
existing scanner routes/service health require post-apply verification.

## Boundary and next steps

Owner approval must identify this exact hash and accept state-bound API/PSA/peering/
instance/database/runtime-client scope, US region and ongoing cost. No command should
apply a replacement artifact under approval for this hash. Check hash/checkout and
fresh relevant inventory before execution; do not rerun an already applied plan.

Create empty protected infrastructure only. Preserve existing AUDIT_DATABASE_URL secret
and keep AUDIT_SPINE_ENABLED false. App and migrator LOGIN identities, secure credential
provisioning, authenticated encrypted private client/connector and runtime attachment
remain unimplemented gates. Roles/cloudsql.client alone is not PostgreSQL privilege
or a network path. No local Windows proxy path to private IP is established.

After approved apply: read back SQL region/private-only/TLS/API deletion protection,
backup/PITR placement and state; PSA peering/range; additive IAM; existing scanner
routing and health. Verify actual remote state recovery separately without printing
payloads. Then prepare separate DB identity/migration/runtime integration packet.

If apply partially fails, preserve resources/state and stop. Never automatically
retry/import/destroy or remove peering/deletion protection. Prepare a fresh corrective
plan for review. Rollback for application keeps database/audit records and infrastructure;
no destructive down-migration. Bootstrap/SQL decommission needs separate authorization.


## 2026-10-09 — Owner approval and successful infrastructure apply

Owner answered “yes” to the exact replacement-plan approval request, then supplied
the apply result for executable 89637c01768808ecd203f89102c2dabe4707ee3a and
SHA256 AA15806393F1872EFE907F5A295CFDC94C91914CB37EA977A81C2A9AEC9D08E9.
Terminal reports 8 added, 0 changed, 0 destroyed and state lock released.
This supersedes the earlier pending-approval checkpoint; do not apply the saved plan again.

Reported outputs: instance guardentra-staging-audit, connection
guardentra-staging:us-central1:guardentra-staging-audit, private IP 10.20.0.2,
database guardentra_audit, region us-central1, staging default network, reserved
range guardentra-staging-audit-psa and the intended Firebase App Hosting runtime SA.
State list contains all eight managed resource addresses plus the default-network
data source. Peering creation reports success; instance creation took 5m5s.

Evidence is Owner-supplied Terraform terminal output, not an independent live API
readback. Next checks cover instance settings, backup status/location, peering,
runtime network attachment, scanner VM and NAT metadata. Actual scanner health,
remote audit-state recovery, PostgreSQL privileges, migration, authenticated encrypted
client connection and application audit writes remain unverified. No DB credential
operation, migration, application rollout, audit activation, PR merge or production
action is evidenced by this infrastructure apply. Preserve resources and remote state.
