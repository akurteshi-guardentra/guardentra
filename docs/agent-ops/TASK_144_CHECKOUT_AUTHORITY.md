# GuardEntra Task Packet

- Packet ID: GPT-144-CHECKOUT-AUTHORITY-20261125
- Updated UTC: 2026-11-25
- Repository / GitHub issue: akurteshi-guardentra/guardentra #144;
  independent finding 7131590474; source ownership checkpoint 7163114561.
- Requirement/source IDs: #144 required checkout identity/org mapping and
  durable, fail-closed processing; #210 portal-scoped identity;
  server/lib/evidenceAccess.ts existing admin/owner authority convention;
  docs/ARCHITECTURE_FOUNDATION.md section 4 existing B2B subscription model.
- Relevant ADRs: existing tenant and subscription model retained.
- Base branch and verified SHA: fix/210-portal-ai-authority,
  d7b6532dd38c495c9239ed884443d90b13459dad.
- Feature branch / PR: existing remote fix/210-portal-ai-authority / #290.
  Local preparation uses fix/210-144-source-corrections from that exact head.
- Primary writing tool: tool:codex; L2 Security / L3 Backend and QA, T2.
- Optional reviewer: independent security review requested, not self-accepted.
- Owner / merge authority: @akurteshi-guardentra.

## Scope and authority

- Outcome: ordinary membership cannot open tenant billing; checkout completion
  cannot replace a conflicting existing customer/subscription mapping.
- Allowed files: server/routes/stripe.ts, server/lib/checkoutMembership.ts,
  src/tests/stripeCheckoutAuthority.test.ts,
  src/tests/stripeCheckoutCurrentState.test.ts, this task packet,
  docs/agent-ops/PROJECT_STATE.md and PROJECT_TRANSITIONS.md.
- Authorized end state: source fix, commit/publication and draft PR under the
  owner's existing development autonomy and current instruction to fix blockers.
  Keep the existing correction PR; no second release candidate/controller.
- Out of scope: prices/products/keys, Stripe Dashboard, actual payment, billing
  configuration, source rules, IAM, live data, migrations, merge/deployment.
- Dependencies: independent review and updated exact-head CI before governed
  integration into Cursor's existing #289. Cursor's branch remains untouched.

## Impact analysis

- UI: unchanged; server returns explicit billing authority/existing-link errors.
- API: checkout requires admin/owner, settled invite and a real org; portal
  claims cannot invoke checkout. Existing user/org provider links or active
  billing state refuse a new initial checkout with 409.
- Database: read-only preflight; completion checks current authority, settled
  invite, user/org agreement and existing provider pair inside the same durable
  event/product transaction. Actual provider subscription customer must match
  the signed checkout event customer. No replacement/relink migration implied.
- Audit/evidence: signature verification, processed-event ledger, current-status
  correction and cursor priority stay unchanged. Stale events are durably skipped
  without replacing mappings; exact duplicates remain harmless.
- Security/privacy: new restrictions; no additional caller authority or data read.
- Infrastructure: no live configuration/resource changes.
- Rollback: source revert only; a live revert needs separate release authority.
- Documentation: source checkpoint below; no production acceptance/score gain.

## Acceptance and verification

- Synthetic actual-handler tests reproduce non-admin/portal checkout, existing
  billing overwrite and foreign-tenant/customer completion before correction.
- Normal initial admin/owner checkout and matching-pair reconciliation work.
- Conflicting user/org customer/subscription IDs produce non-2xx and zero writes,
  including the durable processed-event record; a later competing completion
  cannot replace the first mapping. Database/provider failures stay retryable.
- Existing subscription status, duplicate/stale/catalog/signature cases retained.
- Initial diagnostic: 17 failed / 19 passed on the original billing code.
- Final focused tests/typecheck/build and exact-head CI: recorded in #290 with
  the published SHA and exact changed-file list; no provider or real data used.
- Full live billing acceptance NOT RUN; existing production gate remains open.

## Handoff

- Classification: source CHECKPOINT, pending updated publication/CI/review.
- Exact branch/SHA/PR/files/checks/git status: bind in #290 completion evidence.
- Deployment: NOT DEPLOYED.
- Known limitations: initial checkout is not an upgrade, resubscription or
  provider-relink flow. Existing links need an explicit supported billing-owner
  operation. Concurrent provider sessions can still exist; conflicting completion
  is refused without falsely acknowledging durable success and needs operational
  reconciliation. No claim of refunds, canceled charges or live safety testing.
  Pricing UI was not redesigned. Portal founder bootstrap and legacy privacy
  remain separate blockers.
- Numeric readiness: N/A; no staging/production points claimed.
- Next permitted action: independent review/exact-head CI, then governed source
  integration. Existing release, protection and hosted acceptance gates remain.
