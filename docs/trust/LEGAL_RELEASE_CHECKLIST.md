# GuardEntra legal and customer-trust release checklist

This checklist coordinates engineering evidence with Owner/counsel decisions. It is **not legal advice** and does not provide final contract language.

## Must be approved before production/customer acceptance

### Privacy notice
- [ ] `PENDING_COUNSEL` Controller/processor roles and purposes reviewed.
- [ ] Categories of personal data reflect the actual current product.
- [ ] Service/provider disclosures match the actual production service register.
- [ ] Retention/deletion language matches an approved operational policy.
- [ ] International-transfer/residency language matches actual deployment.
- [ ] Contact and data-subject/customer request path approved.
- [ ] Version, effective date and public URL recorded.

### Terms of Service / pilot terms
- [ ] `PENDING_COUNSEL` contracting entity and jurisdiction approved.
- [ ] Service description matches active GuardEntra product scope.
- [ ] No unsupported certification or compliance guarantees.
- [ ] Availability/support/security commitments are operationally supportable.
- [ ] Pilot limitations, fees/billing terms and termination behavior approved.
- [ ] Version, effective date and acceptance mechanism recorded.

### Data Processing Agreement
- [ ] `PENDING_COUNSEL` DPA template or customer-negotiated path approved.
- [ ] Processing instructions and data categories match this engineering inventory.
- [ ] Security-measures exhibit references current controls, not roadmap controls.
- [ ] Subprocessor notice/change mechanism approved.
- [ ] Deletion/return and assistance obligations are operationally supportable.
- [ ] International-transfer mechanism, if needed, approved.
- [ ] Execution/archival owner identified.

### Subprocessor/service disclosure
- [ ] Each production service has an Owner/counsel classification.
- [ ] Planned/unverified services are not listed as active.
- [ ] Purpose and relevant data category are accurate.
- [ ] Change-notification method is approved.
- [ ] Public URL or contractual disclosure path is recorded.

### Security and incident response
- [ ] Monitored security contact approved.
- [ ] Privacy/legal escalation contact approved.
- [ ] Incident response owner/on-call path approved.
- [ ] Customer incident-notification obligation is counsel-approved and operationally achievable.
- [ ] Current production control limitations (#72/#73/#74) are resolved or explicitly accepted before customer claims are made.

## Product/public-surface follow-up

Repository preparation alone does not authorize UI changes. After counsel approves the customer-facing documents, create a separate bounded task to add any required links/acceptance controls to:
- signup/login/footer;
- pricing/checkout;
- organization Settings;
- invitation/portal surfaces where required.

That task must bind to the approved document URLs, effective dates and acceptance requirements rather than embedding draft legal text.

## Go-live evidence

The #69 production readiness gate for customer trust/privacy/legal may reach `production_verified` only after approved/public or executable contractual evidence exists. Draft docs or this checklist alone may advance engineering readiness but **not** production-live readiness.
