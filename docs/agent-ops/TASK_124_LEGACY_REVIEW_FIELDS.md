# #124 legacy reviewer fields — open, not executed

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
