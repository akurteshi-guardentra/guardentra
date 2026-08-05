# Guardentra — Product Roadmap & Sprint Backlog (2026)

Companion doc to `docs/PRODUCT_FOCUS.md`, `docs/ARCHITECTURE_FOUNDATION.md`, and `docs/CYNOMI_GAP_NOTES.md`. Those docs lock scope to the Vendor TPRM spine and sketch a phased plan (DB → Auth → Billing → competitive polish). This doc **validates that plan against the actual codebase** (not just the mockups), adds a competitive/AI-differentiation brainstorm and an architectural stability audit those docs don't cover, and turns everything into a sprint-by-sprint backlog.

Source mockups referenced below: `/vendors` directory, Assessment Wizard (steps 1–3), and the vendor-facing Secure Vendor Portal — the same three screens `PRODUCT_FOCUS.md` calls "mockups 1→3."

*Last updated: 2026-07-25.*

---

## 1. Validated current state — mockup claims vs. shipped code

Confirmed by reading `src/lib/vendor/*`, `server/routes/ai.ts`, `firestore.rules`, and the docs above:

| Claim in mockups | Reality in code |
|---|---|
| AI removes duplicate questions across frameworks ("78 → 52 unique") | **Fixed in Sprint 1.** Was a no-op stub; now a real 48-question framework-tagged bank with genuine dedup. |
| AI identifies duplicate vendors and suggests categories on import | **Not implemented.** No vendor-dedupe code found anywhere in the CSV bulk-import path. |
| Risk scores shown (92, 85, 78, 65, 45…) | **Fixed in Sprint 0.** Was fabricated band midpoints; now shows "Not assessed" when no real score exists. |
| AI Copilot / evidence review / remediation plans | **Fixed in Sprint 0.** Client-side Gemini key exposure removed; all routed through `/api/ai/generate`. |
| Vendor Portal security | **Improved in Sprint 0.** Anonymous portal sessions can now only mutate answer/progress fields (Firestore rules), not org metadata or `portalOpen`. Storage-level path scoping is still open (see §2). |
| Multi-tenancy | Flat Firestore collections scoped by an `organizationId` field (not path-nested). Reasonable at current scale; will need revisiting for MSP multi-client. |
| Server auth | `requireFirebaseAuth` enforces ID-token verification only in `production`/`staging` — intentional today, but untested as a boundary. |
| CI/CD | **Fixed in Sprint 0.** `.github/workflows/ci.yml` added (lint/test on PR, no deploy). |
| Email / notifications | None — no email-sending library; `vendor_invites` collection is declared but unused; "Invite Vendor" is UI-only. Planned Sprint 6. |
| Test coverage | Growing — Sprint 1/2 added dedup, question-taxonomy, and report-export tests. Still no coverage for AI routes or the VendorPortal submit flow end-to-end. |
| Rich answer types (Single/Multiple choice) | **Fixed in Sprint 2.** Added alongside Yes/No/Partial/N/A. |
| Vendor-level attachments | **Already shipped** (found during Sprint 2, not built new) — `uploadVendorAttachment` wired into the Impact page. Storage rule gap fixed. |
| PDF vendor report | **Fixed in Sprint 2.** No PDF library available/verifiable in this environment, so implemented as a print-optimized HTML view + native browser print-to-PDF, not a new dependency. |

---

## 2. Architectural stability audit — roles, auth, validation, database

A deeper pass specifically on application stability (not just feature gaps) surfaced findings more serious than anything above — several are **live correctness bugs**, not just hardening opportunities. This reshapes sprint sequencing in §5.

### Critical — live data-integrity/correctness bugs

1. **The local/Firestore fallback is a one-way, permanent ratchet.** `useOrgVendors.ts`/`useOrgAssessments.ts`: once a 3.5s timeout or any Firestore error flips a session to "local mode," the Firestore listener is torn down and **never re-attempted**, and there is no path that ever promotes local-only data back to Firestore. A single transient network blip can permanently silo a user's data in `localStorage` for that browser, invisible to teammates, with no recovery. This is the single biggest risk in the codebase.
2. **`assessments` vs `vendor_assessments` is a live silent-inconsistency bug.** `AssessmentWizard.tsx` writes to both (the second as a "best-effort" try/catch stub with an incompatible shape), but `Assessments.tsx`/`VendorPortal.tsx` read only `assessments` while `VendorRisk.tsx`'s per-vendor history panel reads **only** `vendor_assessments`. Any assessment whose best-effort legacy write silently fails is invisible in one view of the app while correctly showing in another, today.
3. **Missing composite Firestore indexes will hard-crash specific queries in production.** No `firestore.indexes.json` exists. Confirmed multi-clause queries needing one: `AuditReadiness.tsx` (policies + incidents), `VendorRisk.tsx` (vendor assessment history), `ContractNegotiator.tsx`. These throw `FAILED_PRECONDITION` the first time each query shape runs against real Firestore.
4. **Org/profile creation has an unhandled partial-failure race.** `AuthContext.tsx`: org-doc and profile-doc creation are two separate un-transacted writes. If the second fails, the user falls back to a local-only profile, and next login **creates yet another new org** (nothing dedupes by uid/email).

### High — foundational gaps blocking "enterprise" positioning

5. **Multi-user organizations are structurally impossible today.** Every signup creates a brand-new `organizations` doc and makes that person its sole `admin`. There is no teammate-invite flow anywhere (only vendor-assessment invites exist) — this directly contradicts selling to any team larger than one person.
6. **The `admin` role is vacuous.** Every account is `admin` of its own org (see #5), so the only place role is checked (`isAdmin()` gating Firestore `delete`) never actually excludes anyone in practice. No server route checks role; UI never hides actions by role.
7. **No email verification, no password reset flow exists anywhere.** Table-stakes for a paid product handling vendor security data.

### Medium — validation/abuse hardening

8. **13+ Firestore collections enforce org-ownership only, zero field-shape validation** (`risks`, `incidents`, `compliance`, `connectors`, `policies`, `vendors`, `vendor_assessments`, `audit_readiness`, and more) — no `hasOnly()`, no type checks, no required fields. Any authenticated client can write arbitrary shapes as long as `organizationId` matches.
9. **Six forms have zero client-side validation**: Settings, Onboarding, PolicyDraftsman, ContractNegotiator, LiveAssistant, VendorPortal (only the vendor spine is validated).
10. **Storage rules don't check content-type on evidence/vendor-attachment uploads** — only the vendor-portal path does; a spoofed `File.type` can upload any file type to those two paths.
11. **No rate limiting or prompt-length caps on `/api/ai/*`**, no App Check/throttling on anonymous portal access.
12. CSV bulk import has no formula-injection sanitization (`=CMD(...)` style cells re-exported as-is).

---

## 3. Competitive brainstorm — wedge features, not just parity

`docs/CYNOMI_GAP_NOTES.md` already tracks parity gaps against Cynomi (rich answer types — now shipped; vendor-level attachments — already shipped; inherent/residual charts; MSP account switcher). These six ideas aim at **leapfrogging**, not matching:

1. **Ship the AI dedup for real.** ✅ Done in Sprint 1 (rule-based tagging; embedding similarity remains a good future enhancement for Custom Questionnaire uploads).
2. **"Answer once, reuse everywhere" trust exchange.** A vendor who's completed a questionnaire for Customer A can share/reuse that response set with Customer B (with consent), collapsing the #1 vendor complaint about TPRM tools — repetitive questionnaires. Closer to Whistic's core wedge than anything currently in the gap notes. Needs vendor identity + consent model + cross-org sharing rules — sequence after multi-user orgs (§2 item 5) land.
3. **AI risk narrative per vendor.** Auto-generated 3-sentence executive summary using the weighting `TrustScoreEngine.ts` already computes but doesn't narrate today.
4. **Continuous monitoring signals** (Growth/Gov tier). Lightweight external signal ingestion (breach feeds, domain/cert hygiene) blended into the risk score between assessment cycles.
5. **AI-drafted remediation tickets tied to Audit Lab gaps.** `RemediationService.ts` / `/remediation-plan` already exists — close the loop so a detected control gap can one-click generate an assignable task.
6. **PDF vendor report.** ✅ Done in Sprint 2.

---

## 4. Architecture & database recommendations

Builds on `ARCHITECTURE_FOUNDATION.md` §1–2 and the audit in §2 above:

- **Keep** flat Firestore collections + `organizationId` field-scoping — appropriate at current scale; don't move to subcollections or shard prematurely.
- ✅ **Done (Sprint 0):** removed direct client-side `GoogleGenAI` instantiation; everything routes through `/api/ai/generate`.
- ✅ **Done (Sprint 0):** allowlisted which fields an anonymous portal session may mutate in Firestore rules.
- **Still open, higher priority than previously scoped** (see §2): fix the permanent local/Firestore fallback ratchet, unify `assessments`/`vendor_assessments`, add `firestore.indexes.json`, make org/profile creation transactional, add field-shape validation to unguarded collections, add content-type checks to evidence/attachment Storage rules.
- **Add lightweight email infra** for vendor invites/reminders — smallest viable option is a Firebase Extension ("Trigger Email from Firestore") writing to a `mail` collection.
- ✅ **Done (Sprint 0):** CI workflow added.
- **Testing gap-fill:** AI routes end-to-end, VendorPortal full submit flow.

---

## 5. Sprint backlog

Each sprint ≈ 1–2 weeks. Renumbered from the original plan: the stability audit in §2 is more urgent than notifications/billing/growth work, so it's inserted as Sprints 3–5, pushing the original Sprint 3–6 items to Sprints 6–9.

### Sprint 0 — Security & correctness hardening ✅ done (2026-07-25)
- ✅ Removed client-side Gemini key usage from all 16 flagged components; added a generic `POST /api/ai/generate` passthrough (prompt/model/responseMimeType/responseSchema) to `server/routes/ai.ts`, routed via `authHeaders()`. Each component keeps its exact original prompt, model, schema, and fallback behavior — only the transport changed.
  - Deferred: `LiveAssistant.tsx` uses the Gemini **Live API**, a persistent streaming session, not `generateContent` — needs its own design. Frozen behind `voiceStudio` flag, not user-reachable today.
- ✅ Allowlisted mutable fields for anonymous portal sessions in `firestore.rules` (`assessments`/`assessment_responses` updates now require `diff().affectedKeys().hasOnly([...])`).
  - Deferred: `storage.rules` portal path still isn't cross-referenced against `portalOpen` — needs `firestore.get()` support and its own testing pass.
- ✅ Replaced fabricated `displayRiskScore()` midpoints with an honest "Not assessed" label (`hasRealRiskScore()`).
- ✅ Added `.github/workflows/ci.yml` (Node 20 → `npm ci` → `tsc --noEmit` → `jest` → `vitest run`).

### Sprint 1 — Make the AI dedup story real ✅ done (2026-07-25)
- ✅ Replaced the 17-question generic stub with a 48-question real control bank, each question tagged with every framework whose requirements it actually satisfies.
- ✅ Rule-based control tagging chosen over embedding/semantic-similarity dedup for this first pass — deterministic, testable, auditor-reviewable.
- ✅ `FRAMEWORK_CATALOG.questionCount` now derives from the bank (`countQuestionsForFramework()`) instead of hand-maintained numbers.
- ✅ Regression tests proving the dedup is real.

### Sprint 2 — Close Cynomi depth gaps ✅ done (2026-07-25)
- ✅ Rich answer taxonomy: added `QuestionType` (`yesno`/`single_choice`/`multiple_choice`), 6 new real single/multiple-choice questions, multi-select UI in `VendorPortal.tsx` (reuses existing button styling + `lucide-react` check/square icons). Fixed an array-truthiness bug in required-question validation (`isAnswered()` helper) along the way.
- ✅ Vendor-level attachments: discovered already shipped (`uploadVendorAttachment` in `evidenceUpload.ts`, wired into `ImpactAssessment.tsx`) — fixed a `storage.rules` gap where its `attachments/` path had no matcher at all (only `evidence/` did), which would have silently denied every upload in a deployed environment.
- ✅ PDF vendor report: no PDF library in the project and none installable/verifiable in this sandbox (no Node/npm), so implemented as a clean print-optimized HTML document (`buildVendorReportHtml`) opened via `window.open()` + `window.print()` — "Save as PDF" from the native dialog produces the artifact without a new dependency. Wired to a new "Report" button on the Impact page. HTML-escaped against injection; tests added.
- **Found and tracked, not fixed (out of scope for this sprint):** vendor answers never actually reach the org-side review screen — `Assessments.tsx` reads `q.answer` off objects that never carry it (answers live in a separate map in `VendorPortal.tsx`). Pre-existing bug, confirmed while working in this area.

**Verification status (Sprints 0-2):** this sandbox has no Node/npm, so all changes were reviewed manually (diff-by-diff, brace/bracket/backtick balance checks) rather than compiled/tested here. Run `npm run lint && npm test && npm run test:vitest` before trusting these. Note: `src/tests/vitest.setup.ts` still globally mocks `@google/genai` — now only actually needed for `LiveAssistant.tsx`, since the other 15 components moved to `fetch('/api/ai/generate')`.

### Sprint 3 — Data integrity & stability ✅ done (2026-07-25)
- ✅ Fixed the permanent local/Firestore fallback ratchet in `useOrgVendors.ts`/`useOrgAssessments.ts`: both hooks now auto-retry Firestore every 30s while stuck in local mode (via a `retryTick` state that re-runs the same proven connection effect, rather than a separate new listener path), and on a successful reconnect, any local-only records (`local_...`/`local_asm_...` IDs) are promoted — written for real via `addDoc`, then dropped from the local store (new `removeLocalVendor`/`removeLocalAssessment` in the local stores). A transient network blip can no longer permanently silo a user's data in one browser.
- ✅ Unified `assessments` as sole source of truth: removed the best-effort dual-write to `vendor_assessments` from `AssessmentWizard.tsx` (it was silently inconsistent — any assessment whose legacy write failed was invisible on `/vendors/legacy` while showing correctly everywhere else). Left `VendorRisk.tsx`'s history panel query as-is since that page is frozen behind the `vendorsLegacy` flag and not user-reachable today — added a code comment there so a future re-enable points it at `assessments` instead, rather than resurrecting the dual-write.
- ✅ Added `firestore.indexes.json` (+ wired into `firebase.json`) covering the 4 confirmed composite-index query shapes: `policies` (organizationId+status), `incidents` (organizationId+status), `contract_audits` (organizationId+createdAt), `vendor_assessments` (vendorId+createdAt, kept for the frozen legacy page so it won't crash if re-enabled).
- ✅ Made org/profile creation atomic in both places it happens (`AuthContext.tsx`'s auto-init fallback, and `firebase-utils.ts`'s `signInWithGoogle`/`signUpWithEmail`) — a single `writeBatch` now creates the organization and user profile together, so a failed profile write can never leave an orphaned organization doc behind, and a retry can never create a duplicate org.
- **Found and tracked, not fixed:** a dead-code branch in `AuthContext.tsx`'s auto-init error handling means `handleFirestoreError` never actually runs for permission-denied errors during org/profile creation — they always silently fall back to a local profile instead. Pre-existing, unrelated to the transactional fix; needs its own careful look at error-surfacing behavior.

**Verification status:** same caveat as before — no Node/npm in this sandbox. The retry/promotion logic in particular (async Firestore listeners + timers) could not be executed or tested here at all, only reasoned through and reviewed line-by-line; treat it as higher-risk than the Sprint 0-2 changes until `npm run lint && npm test && npm run test:vitest` actually pass and someone manually verifies the reconnect-and-promote flow (e.g., via the Firestore emulator: go offline, create a vendor, go back online, confirm it appears in Firestore and stops appearing as local-only).

### Sprint 4 — Multi-user orgs & auth hygiene ✅ done (2026-07-25)
- ✅ Password reset: `resetPassword()` in `firebase-utils.ts`, "Forgot password?" link on the Login screen (`App.tsx`), doesn't reveal whether an account exists for a given email.
- ✅ Email verification: `sendEmailVerification()` fired on signup (best-effort, doesn't block account creation), a dismissible amber banner in `Layout.tsx` for any signed-in, non-anonymous, unverified user with a resend action.
- ✅ Teammate invite flow — the big one. New `org_invites` Firestore collection + rules (readable by exact email match via `request.auth.token.email`, so a brand-new user with no org yet can check their own pending invites; admin-only create; the invited user can only flip `status`/`acceptedByUid`/`acceptedAt`, nothing else). New `src/lib/orgBootstrap.ts` consolidates what was three separate copies of org/profile-creation logic (`AuthContext.tsx`, and both functions in `firebase-utils.ts`, all touched in Sprint 3d) into one `bootstrapUserProfile()`: if there's a pending invite for the new user's email, they join that org with the invited role; otherwise they get a new org as before — same atomic `writeBatch` guarantee either way. New `src/lib/orgInvites.ts` (create/list/revoke) and a "Team Members" card in `Settings.tsx` (admin-only invite form + role picker + pending-invite list with revoke). No email-sending infrastructure exists yet (that's Sprint 6), so there's no invite link — the invited person just signs up at `/login` with the exact email they were invited under and the match happens automatically at signup.
  - **Scope limit, by design:** this only covers a brand-new user joining via invite. An existing user (who already has a profile in a different org) cannot use an invite to join a second organization — multi-org membership per user is a materially bigger feature, not attempted here.
- ✅ Role-aware UI: audited every active-surface page (Vendors, Impact, Assessments, Audit Readiness, Dashboard) for `deleteDoc` calls — found **zero**, so there was nothing to hide. The unconditional delete buttons found in the original audit all live on frozen pages (Connectors, Policies, RiskManagement, ContractNegotiator, VendorRisk, PolicyDraftsman, AuditCalendar) that aren't reachable today; tracked as a task to fix before any of those are ever re-enabled, now that real non-admin members are possible. The one new admin-gated action (sending invites) is admin-only from the start.
- **Found while building this, tracked as follow-ups (not fixed):** `Onboarding.tsx` unconditionally overwrites the organization's name/industry from whatever the current user types, with no check for whether they're the org's original creator — a real risk now that invited teammates go through the same onboarding wizard and could clobber a shared org's settings. Also found a hardcoded personal-email "Admin Bypass" button in `Onboarding.tsx`, the same pattern as the `isAtIdhee` Firestore-rules bypass already removed elsewhere — missed in that cleanup.

### Sprint 5 — Validation & abuse hardening ✅ done (2026-07-25)
- ✅ Storage content-type enforcement: `storage.rules`' `evidence/` and `attachments/` paths only checked file size before — now all three upload paths (portal, evidence, attachments) share one `isAllowedDocType()` check mirroring `EVIDENCE_ALLOWED_TYPES`, since client-side `File.type` is trivially spoofable.
- ✅ CSV/export formula-injection sanitization: new `sanitizeForSpreadsheet()` in `validators.ts` (OWASP-standard leading-quote mitigation for values starting with `=+-@`) applied to CSV bulk-import fields and the markdown register export's `escapeCell()` — both layers, since a payload could enter via import and leave via export.
- ✅ AI abuse hardening: new dependency-free `server/middleware/rateLimit.ts` (in-memory fixed-window, keyed by Firebase uid) applied to all of `/api/ai/*` (20 req/min), plus a 20,000-character prompt cap on `/api/ai/generate`. Known limitation: per-process state, would need a shared store for a multi-replica deployment — not attempted to avoid a new infra dependency.
- ✅ Firestore field-shape validation — **scoped down deliberately, see below.** Added soft type guards (`isStringIfPresent`/`isNumberIfPresent` — reject a known field written with an obviously wrong type, never reject missing/unknown fields) to `vendors` and `audit_readiness`, the only two of the 13 flagged collections actually reachable on the active surface today. The other 11 were **not** given a strict `hasOnly()` allowlist: this repo has no visibility into what's already sitting in any deployed database, and guessing an exact field list risked breaking updates to pre-existing documents with unknown fields. Tracked in `docs/KNOWN_ISSUES.md` (#11) for a real per-collection audit if/when any of those frozen pages are re-enabled.
- ✅ Client-side validation pass across the 6 originally-flagged forms — findings were more mixed than the original audit suggested:
  - `Onboarding.tsx` already validated org name; added a missing industry-required check and a `maxLength`.
  - `ContractNegotiator.tsx` already required non-empty contract text; added a `maxLength` cap.
  - `PolicyDraftsman.tsx`'s brief field is intentionally optional (no required-check needed); added a `maxLength` cap.
  - `VendorPortal.tsx`'s answer-required validation was already added in Sprint 2; added a `maxLength` to the optional context textarea.
  - `LiveAssistant.tsx` has no form at all — it's audio/voice only (Gemini Live API), so the original "unvalidated form" claim didn't apply.
  - `Settings.tsx` is now covered by the Team Members invite form added in Sprint 4, which already validates email format.

### Sprint 6 — Notifications & invite flow (was Sprint 3) ✅ done (2026-07-26)
- ✅ Email infra: `server/routes/notify.ts` (`POST /api/notify/mail`, rate-limited, auth-gated) writes Trigger-Email-extension-shaped docs to a `mail` collection via the Admin SDK — `firestore.rules` denies all direct client access to `mail`, so this server route is the only path that can queue an email. Installing/configuring the actual extension in the Firebase Console is documented in `docs/ENVIRONMENTS.md` §7 — that one step can't be done from code.
- ✅ Vendor gets emailed automatically when an assessment is created (`AssessmentWizard.tsx`, best-effort) — previously there was no notification at all, just a "Copy Vendor Portal Link" button for manually sharing it yourself.
- ✅ On-demand "Send Reminder" action on pending/in-progress rows in `Assessments.tsx` (no Cloud Scheduler/Functions available, so this is admin-triggered, not a real automated cron nudge).
- ✅ Real "Invite Vendor" quick action in `VendorsDirectory.tsx` — the mockup's third quick action was never actually built before this (confirmed zero references anywhere in the codebase). Adds the vendor, records a `vendor_invites` audit entry (new Firestore rule; the collection existed as a name in `COLLECTIONS` but nothing ever wrote to it), and sends a welcome email — distinct from the pre-existing "Invite to assessment" shortcut, which just navigates to the wizard.
- **Bonus, now that Node/npm work in this sandbox:** fixed every remaining pre-existing `tsc` error (6 total, none caused by this session's work, all confirmed via `git blame` to predate it) — missing `AssessmentStatus` union member (`'Under Review'`, a real value `VendorPortal.tsx` sets but the type never declared), dead `profile.uid` references in `ImpactAssessment.tsx` (should be `user.uid` — `UserProfile` never had a `uid` field), a test missing a required `progressPct`, and missing `vite/client` types in `tsconfig.json`. `tsc --noEmit` is now completely clean.

**Verification status:** first sprint verified for real — Node/npm are now installed in this sandbox (direct download from nodejs.org, after a `brew install node` attempt proved impossibly slow compiling from source on this unsupported macOS 12 host). `tsc --noEmit`: 0 errors. `npm test` + `npm run test:vitest`: 12/12 files, 50/50 tests passing.

### Sprint 7 — Billing hardening (was Sprint 4) ✅ done (2026-07-26)
- ✅ Real Stripe Checkout wired: `Pricing.tsx`'s "subscribe" button previously just `updateDoc`'d the user's own profile to `subscriptionStatus: active` directly — a pure client-side fake with zero Stripe involvement. Now calls the (already-real) `/api/stripe/create-checkout-session` and redirects to actual Stripe Checkout.
  - That endpoint was also completely unauthenticated — fixed: added `requireFirebaseAuth`, and `userId`/`email` now come from the verified token instead of trusting client-submitted body values (previously anyone could pass an arbitrary `userId` and have a completed checkout misattributed via the webhook).
  - Removed the `payment_method_types` override per `ARCHITECTURE_FOUNDATION.md`'s own note, so Stripe Dashboard's configured dynamic payment methods apply. No `STRIPE_SECRET_KEY` now returns a clear 503 instead of a fake mock checkout URL that would 404.
  - Plan copy updated to match the Starter/Growth/Gov tier sketch already documented in `ARCHITECTURE_FOUNDATION.md` §4 (previous copy was generic "GRC" boilerplate predating the vendor-TPRM-spine focus) — price IDs now read from `VITE_STRIPE_PRICE_*` env vars instead of fake hardcoded strings; real Products/Prices still need creating in the Stripe Dashboard (can't be done from code).
- ✅ Vendor cap enforcement (soft, not airtight — see `docs/KNOWN_ISSUES.md` #12): `organizations.vendorCount`/`vendorCap` (Starter default 25) checked by `firestore.rules` at vendor-create time; the counter is maintained by a Firestore transaction in `createVendor` (`VendorsDirectory.tsx`), which all three vendor-creation paths (Add One Vendor, Invite Vendor, bulk CSV import) already funnel through, so all three correctly stop at the cap.
- **Scoped out, tracked:** seat cap enforcement (`docs/KNOWN_ISSUES.md` #13) — only vendor cap was wired this pass, to avoid doubling the transaction/counter work across two different paths in one sprint.

**Verification status:** `tsc --noEmit` clean, 50/50 tests passing (one transient/unreproducible flake noted in `docs/KNOWN_ISSUES.md` #14).

### Sprint 8 — Differentiation / Growth-Gov upsell (was Sprint 5) ✅ done (2026-07-26)
- ✅ AI risk narrative per vendor: new "AI Risk Narrative" card on the Impact page (`ImpactAssessment.tsx`) — on-demand (button-triggered, not auto-fired on load), calls the existing `/api/ai/generate` proxy with the vendor's real data (risk score, criticality, impact level, combined rating, assessment status), returns a 3-sentence plain-English summary. Distinct from `TrustScoreEngine.ts`'s existing org-wide Trust Score narration (which already works via `/api/ai/trust-explain`) — this is genuinely per-vendor, which didn't exist before.
- ✅ AI-drafted remediation tickets tied to Audit Lab gaps: "Create Ticket" buttons added to both the Evidence Gaps list and the Remediation Checklist on `AuditReadiness.tsx`, calling the already-real `RemediationService.generateAIPlan()` + `createTicket()` (previously only wired up on the frozen legacy `VendorRisk.tsx` page via `RemediationEngine.tsx`). Tickets are org-wide (`vendorId: 'org-wide'`) since Audit Lab scans aren't tied to one vendor.
  - **Found and tracked, not fixed:** created tickets have no view anywhere in the active app yet — `RemediationEngine`'s Kanban board (the only UI that renders them) is vendor-oriented and lives on the frozen page. `docs/KNOWN_ISSUES.md` #15.
- ✅ Continuous monitoring signal ingestion — **design spike only**, as scoped: written up as a new §7 in `docs/ARCHITECTURE_FOUNDATION.md` with the open questions (which signals, who runs the scan and how often, how to surface it without breaking the audit trail, tier gating/cost control) that need real answers before any code. Deliberately no implementation this round — this needs a new field (`Vendor.website`), a decision on GitHub Actions cron vs. Cloud Scheduler (neither exists in this project today), and a real budget call on any paid API (HaveIBeenPwned).

**Verification status:** `tsc --noEmit` clean, 50/50 tests passing.

### Sprint 9 — Enterprise ✅ design done (2026-07-26), no implementation this round
All three items depend on decisions or infrastructure this pass couldn't provide unilaterally — each written up as a real, grounded design spike in `docs/ARCHITECTURE_FOUNDATION.md` §8-10 rather than built blind:
- ✅ SSO/SAML for Gov/Enterprise orgs (§8) — real blocker: SAML needs Google Cloud Identity Platform (a paid, opt-in upgrade — a billing decision only you can make) and a live IdP to test against (Okta/Azure AD/etc.), neither obtainable from code. Design covers org-to-IdP domain mapping, extending `bootstrapUserProfile()` for SSO provisioning, and why role-from-IdP-group mapping needs a Cloud Function this project doesn't have yet.
- ✅ "Answer once, reuse everywhere" trust exchange (§9) — the biggest strategic differentiator on this roadmap and the biggest lift: needs real vendor accounts (today's `VendorPortal.tsx` uses anonymous sign-in per link, nothing persistent to attach reusable answers to), a mandatory consent UI, and cross-org Firestore rules (a real departure from today's strict single-org-per-doc model). **Precursor shipped:** durable `controlKey` on the question bank + versioned `FRAMEWORK_PACKS` with assessment stamps (see `docs/ARCHITECTURE_FOUNDATION.md` framework packs plan).
- ✅ MSP multi-client account switcher (§10) — confirmed the real scope: `profile.organizationId` is read directly in **25 files**; every collection's Firestore rule (`isOrgMember`/`isDocOrgMember`) would need an alternate `msp_memberships` path. One encouraging finding: the data hooks (`useOrgVendors`, `useOrgAssessments`) already take `orgId` as an explicit parameter, so the query layer itself doesn't need to change — only what org ID gets passed in.

**This closes out the original 9-sprint roadmap.** Remaining work going forward lives in `docs/KNOWN_ISSUES.md` (15 tracked items) and whichever of the three Sprint 9 designs you choose to actually build next.

---

## Cross-cutting references

| Doc | Role |
|---|---|
| `docs/PRODUCT_FOCUS.md` | Freeze + spine scope, Firestore Console setup |
| `docs/ARCHITECTURE_FOUNDATION.md` | DB/Auth/Billing phased plan, Stripe tier sketch |
| `docs/CYNOMI_GAP_NOTES.md` | Competitor parity gap notes |
| `docs/ENVIRONMENTS.md` | Project aliases, secrets, pre-customer checklist |
| `docs/SECRETS.md` | Key/secret handling policy |
| `docs/KNOWN_ISSUES.md` | Running list of every found-but-not-fixed issue discovered mid-sprint — check before starting a new sprint |
| This doc | Codebase validation, architectural stability audit, AI-differentiation brainstorm, sprint backlog |
