# #124 legacy reviewer fields — open, not executed

## 2026-11-26 — source read-boundary alternative, not deployed

The existing correction PR #290 now prepares a finite vendor projection from
the portal session's existing read and a scoped refresh endpoint. Direct portal
reads of any document containing the five reviewer-only keys are denied by the
candidate rules, while org reviewers retain access. Receipt and editable-legacy
flows use projected fields without rewriting old records. This source boundary
does not depend on the migration below. Independent review, app-first/rules-second
rollout and hosted verification remain required; no live protection is claimed.
See TASK_124_LEGACY_PORTAL_READ.md and the implementation decision in
docs/adr/portal-legacy-review-read-boundary.md. No inventory/migration was executed.

## Historical 2026-11-24 migration proposal

Date: 2026-11-24. Status: OPEN. No inventory run, no migration, no rules rollout.

New decisions write reviewer notes, reviewer identity, residual risk, and the
remediation owner to `assessment_reviews/{assessmentId}` and delete those keys
from the vendor-visible assessment. Firestore cannot hide fields that are
already stored on `assessments/{id}`.

A terminal decision cannot be rewritten just to move those fields. Doing so
would be a decision mutation, which the terminal guard refuses. Historical
completed assessments can therefore still expose the old fields to a portal
session that is allowed to read the assessment document.

## Later, separately authorized

1. Read-only inventory of `assessments` documents that still contain
   `decisionNotes`, `decidedBy`, `decidedByName`, `residualRiskLevel`, or
   `remediationOwner`. No writes.
2. Owner-authorized copy of those values into `assessment_reviews` and deletion
   of the public copies, with a rollback copy taken before any delete.
3. Live rules rollout only after that inventory and a separate rules-release
   approval. This source change does not deploy rules.

Until that packet is approved and executed, legacy exposure stays a known gap.
Production remains NO-GO.
