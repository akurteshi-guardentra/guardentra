# ADR 0080: self-managed mail delivery

Status: local implementation decision for #80 under the owner's session authorization;
not approval to deploy or configure a provider. Date: 2026-09-27.

## Decision

Prepare self-managed Cloud Functions for Firebase 2nd gen: a mail document-create
trigger and a scheduled recovery/retry function. Keep the #72 `mail/{id}` queue
and authenticated API. Deploy as a separate function codebase in a future authorized
release; do not attach functions to firebase.json or App Hosting in this change.

Separate queue validation, provider adapter, transactional store, delivery state
machine, and allowlisted observability. The initial replaceable adapter uses
SendGrid HTTPS Mail Send (same provider as the #72 staging plan), not managed
Extensions or SMTP credentials. Provider selection is not a runtime approval.

Use a transaction to claim a document before sending, a bounded lease, fencing by
attempt ID, and a durable next-attempt timestamp for scheduled recovery. Never call
the provider inside a Firestore transaction. Keep SUCCESS/ERROR/PROCESSING/RETRY
visible in `delivery.state`; SUCCESS means accepted, not inbox receipt.

SendGrid does not provide a deduplication guarantee used by this implementation.
Confirmed rate-limit rejection can retry with backoff; transport errors, server
errors and expired processing leases become ERROR/OUTCOME_UNKNOWN for human
reconciliation. This sacrifices automatic recovery of uncertain attempts to avoid
silent duplicate invitations. No exactly-once delivery claim. Duplicate queue
documents (separate API submissions) remain separate messages as in #72.

The worker requires explicit enablement and a cutover timestamp, uses the actual
Firestore creation timestamp for ownership, and refuses any legacy delivery
metadata. Only one consumer may operate on mail; the extension does not understand
our ownership marker. Disable/drain it before activation. Preserve original payloads
and never resolve recipients or invitation links from other tenants during retry.

## Alternatives and consequences

- Managed extension: short-term #72 staging only; not the durable production path.
- SMTP: preserves provider transport but cannot resolve ambiguous acceptance either.
- Provider-native idempotency: a future adapter can support safe replay after its
  retention/guarantees are tested; do not pretend a custom header provides it.
- Poll every historical queue document: rejected; creation events plus a single-field
  due-time query avoid full scans. Cutover backlog requires explicit reconciliation.

No existing ADR directory/numbered ADR for email was found at the supplied base.
Foundational constraints: docs/ARCHITECTURE_FOUNDATION.md sections 1–3 and
docs/SECRETS.md. No rules, IAM, production config, tenant bootstrap, or scanner changes.

References: [Firebase migration/deprecation](https://firebase.google.com/docs/extensions/faq-and-troubleshooting),
[Firestore triggers](https://firebase.google.com/docs/functions/firestore-events),
[scheduled functions](https://firebase.google.com/docs/functions/schedule-functions),
[SendGrid Mail Send](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send).
