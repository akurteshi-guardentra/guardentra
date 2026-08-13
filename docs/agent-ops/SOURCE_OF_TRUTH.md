# GuardEntra Sources of Truth

No single tool or document proves every kind of state.

| Question | Authoritative evidence |
|---|---|
| Intended product behavior | Approved requirement and source locator |
| Approved technical design | Accepted ADR |
| Current execution contract | GitHub issue acceptance criteria |
| Code that exists and changed | Git commit and PR diff |
| Automated verification | CI run and exact test output |
| Review/approval | GitHub PR reviews and recorded human decision |
| What is merged | Protected-branch history |
| What is deployed | Deployment platform revision/environment plus verification |
| Current GCP/Firebase/IAM/KMS/runtime state | Read-only live-state inspection and captured evidence |

## Practical live-state checks

| State being verified | Check the live system | Durable, safe evidence |
|---|---|---|
| GCP IAM bindings | `gcloud projects get-iam-policy` or the IAM console/viewer | Redacted policy export and timestamp |
| KMS signing key, versions, and rotation | Cloud KMS inventory/public-key endpoints | Key resource/version identifiers, public key, policy metadata; never private material |
| Secret availability/version | Secret Manager metadata | Secret resource name and version state; never secret values |
| Firebase project/auth configuration | Firebase console and project configuration | Project ID, enabled-provider metadata, timestamp; redact tenant/user data |
| Deployed Firestore/Storage rules | Target Firebase project release/deploy state | Ruleset/release identifier and verification timestamp |
| Cloud SQL backup/PITR/restore | Cloud SQL operations and restored instance | Operation IDs, timestamps, measured RPO/RTO, validation results |
| Terraform drift/state recovery | Remote backend versions plus `terraform plan` | Backend object version and redacted no-drift/expected-drift plan |
| Audit outbox reconciliation | Firestore/outbox and restored Postgres comparison | Counts, identifiers/hashes, reconciliation log; no payload/customer evidence |
| Audit-chain integrity | Live verification endpoint/job against the target database | Verification run ID, chain head/checkpoint identifiers, result |
| Signed-checkpoint verification | Recorded checkpoint plus historical KMS public-key version | Checkpoint/key-version identifiers, verification result, timestamp |
| Deployed application revision | Hosting/Cloud Run release state | Environment, revision/commit, deploy mechanism, smoke-test result |

Git records intent and history, but live infrastructure can drift. Live systems show current state, but not why it was approved. Reconcile both.

Never store secret values, private customer evidence, tokens, or production records as evidence. Capture safe metadata, redacted command output, test logs, policy exports, revision IDs, timestamps, and hashes where appropriate.

If sources conflict:

1. Stop changes that could affect security, privacy, data, cost, or availability.
2. Record the conflict and strongest available evidence.
3. Ask the human owner to decide whether requirements, ADRs, repository state, or live state must change.
4. Track the correction in an issue and PR.
