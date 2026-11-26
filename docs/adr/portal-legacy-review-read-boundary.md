# Vendor-safe reads for historical assessment records

Date: 2026-11-26. Status: source proposal prepared under the owner's requested
#124 privacy correction; independent security review and release acceptance pending.
No live rollout or migration is approved by this document.

## Context

New decisions partition reviewer-only fields into assessment_reviews, but older
assessment documents still hold those keys. Firestore cannot redact individual
fields in an allowed document read. Moving/deleting historical data would require
a separately authorized migration and would not protect existing sessions by itself.

## Source decision

Use the existing portal link/session and assessment-scoped identity model.
The session returns a finite vendor field projection from its existing Admin read.
The portal renders that projection, not a full Firestore document fetch. Firestore
refuses direct portal reads whenever any of the five reviewer-only keys is present.
Organization reviewers retain their existing access and no records are rewritten.

Safe documents keep the existing scanner trust listener. Historical projected
documents use a same-assessment authenticated view endpoint only while a scan is
pending. Refreshes do not overlap, stop on disposal/error/resolution, and are bounded
to 60 requests at ten-second spacing. Failure/exhaustion leaves evidence untrusted
and reports the need to refresh; it never invents a clean verdict. No new service,
identity, database, background worker or paid model is introduced.

## Acceptance and release boundary

Tests must cover unknown/private field omission, receipts, existing answers,
cross-assessment/organization-token refusal, legacy raw-read denial, normal portal
reads and writes, scan refresh and disposal. No live data is copied/deleted.

For a future authorized rollout, deploy the app/API first, verify projected initial
loads, then release the exact reviewed Firestore rules with its current deployed
ruleset rollback baseline recorded. Existing cached clients can require a page
reload. No app deployment is evidence of rules release. Do not roll back the privacy
rules to regain raw access; prefer an approved app revert that preserves projection
or hold the release. Existing migration proposal remains optional, not executed.
