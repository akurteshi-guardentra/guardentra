# GuardEntra data handling and service register — readiness draft

> This is an engineering inventory for privacy/legal review. It does not decide legal roles, lawful bases, transfer mechanisms, retention periods, or subprocessor classifications.

## Data categories visible in the current product architecture

| Category | Examples | Primary handling surface | Current release note |
|---|---|---|---|
| Account identity | email, display name, Firebase UID, organization membership/role | Firebase Auth + Firestore user/org records | tenant authority is server/rules bound |
| Vendor contact data | vendor name, contact name/email, business metadata | Firestore vendor/assessment records | used for TPRM workflow and invitations |
| Assessment responses | questionnaire answers, attestations, progress/status | Firestore assessment records | portal access is assessment-scoped |
| Evidence files | uploaded vendor evidence/attachments | Firebase/Google Cloud Storage + metadata | production malware scanning is pending #73 live acceptance |
| Audit events | actor/object/event metadata, outbox/hash-chain records when enabled | application + planned/current audit datastore | live staging audit-spine acceptance pending #74 |
| Notification data | recipient address and invitation/reminder content | server mail intent/queue; planned SMTP provider path | live delivery pending #72 |
| Billing identifiers | Stripe customer/subscription identifiers; no card PAN intended in Firestore | application server + Stripe integration | exact current production billing runtime must be separately verified |
| AI request content | prompts/context sent by server-side AI features when configured | `/api/ai/generate` → Google GenAI | current production provider/data-use state must be release-verified |

## Retention and deletion

No single counsel-approved customer retention schedule is established by repository evidence. Before customer-facing acceptance, define and approve at least:

- account/org retention after termination;
- assessment/vendor record retention;
- uploaded evidence retention and deletion;
- audit-record retention (including any immutable/tamper-evident requirement);
- notification/mail queue retention;
- billing/accounting record retention;
- backups and deletion propagation;
- support/security-log retention;
- customer export and deletion request SLA.

Until approved, do not publish a specific retention period as a GuardEntra contractual promise.

## Data residency and international transfers

The repository contains preparation for regional routing, but dual-Firebase residency is not established as a current production capability. Do not promise EU-only, US-only, or customer-selected residency from repository code alone.

Any international-transfer representation or contractual mechanism is **PENDING_COUNSEL** and must be based on the actual production service configuration and approved provider/legal terms.

## Service classification

The machine-readable source is `docs/trust/CUSTOMER_TRUST_READINESS.json`.

Important distinction:
- `ACTIVE_VERIFIED` = engineering/runtime evidence that the service is used;
- `UNVERIFIED_CURRENT_PRODUCTION` = integration exists, but current exact production use is not proven;
- `PLANNED_STAGING` = intended release path, not an active service assertion;
- `PENDING_COUNSEL` = legal classification/disclosure has not been approved.

The engineering inventory must never silently convert a service into a legal "subprocessor" determination; counsel/Owner review owns that classification.
