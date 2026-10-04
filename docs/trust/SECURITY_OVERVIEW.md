# GuardEntra customer security overview — readiness draft

> Status: **repository preparation only**. This document is not a certification, audit report, legal commitment, or substitute for customer-specific security review.

## Current architecture facts

GuardEntra is a multi-tenant web application using Google Cloud/Firebase services. Customer/staff identity uses Firebase Authentication. Tenant-bound application records use `organizationId` and server/rules authorization. Privileged server routes verify Firebase ID tokens. Vendor-portal sessions use scoped portal identity and assessment binding rather than broad organization access.

Secrets and server credentials are not intended for the browser bundle or repository. The repository documents separate local, GitHub Actions, and Google Secret Manager stores. Production and staging are separate Firebase/GCP projects.

## Evidence and portal controls already implemented

- tenant enrollment/ownership is server-authoritative (#61);
- hosted persistence fails closed rather than presenting local browser storage as durable success (#62);
- vendor-portal audit requests use the portal Firebase identity, not the ordinary app identity (#63);
- portal assessment scoping and storage/rules isolation have prior live verification evidence in project-state records;
- invitation mail ingress is bound to tenant-authorized notification intent (#86);
- email consumer cutover has a single-consumer release gate (#87);
- audit-spine authorization and stale outbox recovery are hardened in repository code (#102).

## Current release limitations — must remain visible

These items are **not production-live proven for the current release**:

1. **Invitation email delivery (#72):** queue/security code exists, but staging provider/extension state, real provider acceptance, inbox receipt, failure/retry and duplicate suppression remain live acceptance work.
2. **Production malware scanning (#73):** staging scanner has recorded live evidence; production scanner is not currently production-live verified. Do not represent production uploads as malware-scanned unless #73 acceptance proves it.
3. **Audit spine (#74):** authorization/durability code is merged, but current staging Cloud SQL/runtime attachment and live hash-chain acceptance remain pending.
4. **Local autonomous factory (#90/#106/#116):** repository tooling exists, but workstation activation and current Cursor/Gemini unattended runtime must be proven from local checkpoints.

## Certifications and framework claims

GuardEntra must not state or imply that GuardEntra itself is SOC 2 certified, ISO 27001 certified, FedRAMP authorized, or endorsed/certified by a standards publisher unless separate authoritative evidence exists. Framework packs and mappings are product content; they are not evidence of GuardEntra certification.

## Customer-facing security contact

**PENDING_OWNER.** A monitored security contact and escalation ownership must be approved before this pack is accepted for production/customer use.

## Release binding

For a customer-facing version of this overview, record:
- exact deployed production SHA/build/revision;
- effective date and document version;
- named security/privacy owner;
- current live state of email, scanner and audit-spine controls;
- approved public or contractual distribution path.
