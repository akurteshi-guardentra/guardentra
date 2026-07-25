# Guardentra — Product Roadmap & Sprint Backlog (2026)

Companion doc to `docs/PRODUCT_FOCUS.md`, `docs/ARCHITECTURE_FOUNDATION.md`, and `docs/CYNOMI_GAP_NOTES.md`. Those docs lock scope to the Vendor TPRM spine and sketch a phased plan (DB → Auth → Billing → competitive polish). This doc **validates that plan against the actual codebase** (not just the mockups), adds a competitive/AI-differentiation brainstorm those docs don't cover, and turns everything into a sprint-by-sprint backlog.

Source mockups referenced below: `/vendors` directory, Assessment Wizard (steps 1–3), and the vendor-facing Secure Vendor Portal — the same three screens `PRODUCT_FOCUS.md` calls "mockups 1→3."

*Last updated: 2026-07-25.*

---

## 1. Validated current state — mockup claims vs. shipped code

Confirmed by reading `src/lib/vendor/*`, `server/routes/ai.ts`, `firestore.rules`, and the docs above:

| Claim in mockups | Reality in code |
|---|---|
| AI removes duplicate questions across frameworks ("78 → 52 unique") | **Not implemented.** `questionBank.ts`'s `buildQuestionsForFrameworks()` ignores the `frameworks` param and returns the same static 17-question bank regardless of which of NIST CSF 2.0 / SOC 2 / ISO 27001 / HIPAA / PCI DSS 4.0 / CIS Controls is selected. No per-framework question sets exist yet. |
| AI identifies duplicate vendors and suggests categories on import | **Not implemented.** No vendor-dedupe code found anywhere in the CSV bulk-import path. |
| Risk scores shown (92, 85, 78, 65, 45…) | **Partly fabricated.** `displayRiskScore()` invents a band midpoint whenever no real `riskScore` is stored on the vendor doc — most demo/seed vendors show an invented number, not a computed one. |
| AI Copilot / evidence review / remediation plans | **Real, but fragile.** `server/routes/ai.ts` calls real Gemini (`@google/genai`, `gemini-3.5-flash`) with genuine prompts + JSON schemas. However ~15 page components *also* instantiate `GoogleGenAI` directly client-side via `process.env.GEMINI_API_KEY` — a key-exposure risk in production Vite bundles, already flagged in `ARCHITECTURE_FOUNDATION.md` §2 but not yet fixed. Every AI route silently falls back to canned mock JSON on any error or missing key. |
| Vendor Portal security | Real, but access model is "possession of the link": `signInAnonymously` + a `portalOpen` flag, no actual vendor identity. Field-level allowlisting for what an anonymous session may mutate is still open (flagged in `ARCHITECTURE_FOUNDATION.md` §2). |
| Multi-tenancy | Flat Firestore collections scoped by an `organizationId` field (not path-nested). Reasonable at current scale; will need revisiting for MSP multi-client. |
| Server auth | `requireFirebaseAuth` enforces ID-token verification only in `production`/`staging` — intentional today, but untested as a boundary. |
| CI/CD | None — no `.github/` workflows; lint/tests only run locally. |
| Email / notifications | None — no email-sending library; `vendor_invites` collection is declared but unused; "Invite Vendor" is UI-only. |
| Test coverage | Strong on `csvBulk`, vendor validators, local stores. No tests for the Assessment Wizard, VendorPortal, AI routes, or Reports. |

**Bottom line:** the single biggest gap is that the flagship "AI dedup" story — the thing most likely to differentiate Guardentra in a demo — isn't real yet. That makes it the highest-leverage item to close.

---

## 2. Competitive brainstorm — wedge features, not just parity

`docs/CYNOMI_GAP_NOTES.md` already tracks parity gaps against Cynomi (rich answer types, vendor-level attachments, inherent/residual charts, MSP account switcher). These six ideas aim at **leapfrogging**, not matching:

1. **Ship the AI dedup for real.** Embedding-based semantic similarity across framework question banks (not keyword matching), so "52 unique from 78" is an actual computed number the vendor sees.
2. **"Answer once, reuse everywhere" trust exchange.** A vendor who's completed a questionnaire for Customer A can share/reuse that response set with Customer B (with consent), collapsing the #1 vendor complaint about TPRM tools — repetitive questionnaires. This is closer to Whistic's core wedge than anything currently in the gap notes.
3. **AI risk narrative per vendor.** Auto-generated 3-sentence executive summary (e.g. "Critical risk driven by an unresolved MFA gap and 2 open incidents; last assessed 47 days ago") using the weighting `TrustScoreEngine.ts` already computes but doesn't narrate today.
4. **Continuous monitoring signals** (Growth/Gov tier). Lightweight external signal ingestion (breach feeds, domain/cert hygiene) blended into the risk score between assessment cycles — closes a real gap vs. SecurityScorecard-style continuous monitoring.
5. **AI-drafted remediation tickets tied to Audit Lab gaps.** `RemediationService.ts` / `/remediation-plan` already exists — close the loop so a detected control gap can one-click generate an assignable task, not just a text card.
6. **PDF vendor report**, paired with the AI risk narrative (#3) so it's not just a data dump — markdown export already exists as a base.

**Sequencing:** #1 and #3 reuse code that already exists and directly fix a "we're showing something we haven't built" gap — do these first. #2 is the biggest strategic differentiator but needs a vendor identity + consent model + cross-org sharing rules — sequence after the spine is trustworthy. #4–6 map to the Growth/Gov tiers already sketched in `ARCHITECTURE_FOUNDATION.md` §4.

---

## 3. Architecture & database recommendations

Builds on `ARCHITECTURE_FOUNDATION.md` §1–2, doesn't replace it:

- **Keep** flat Firestore collections + `organizationId` field-scoping — appropriate at current scale; don't move to subcollections or shard prematurely.
- **Fix now (cheap, high risk-reduction):** remove direct client-side `GoogleGenAI` instantiation from the ~15 page components; route everything through the existing `/api/ai` server layer, which already has auth middleware and real prompts. Mechanical refactor, not a redesign.
- **Tighten Firestore/Storage rules:** allowlist exactly which fields an anonymous portal session may mutate (answers, evidence, progress) vs. org metadata / `portalOpen`.
- **Add `firestore.indexes.json`** once vendor/assessment filter+sort queries outgrow automatic single-field indexes.
- **Add lightweight email infra** for vendor invites/reminders — smallest viable option is a Firebase Extension ("Trigger Email from Firestore") writing to a `mail` collection, avoiding a new backend service.
- **Add CI** — one GitHub Actions workflow running `tsc --noEmit`, `jest`, `vitest run` on PRs. No deploy automation until explicitly approved (touches `.github/`, treat as its own decision).
- **Testing gap-fill:** Assessment Wizard framework selection, VendorPortal autosave/evidence, and `/api/ai` mock-fallback paths before they're relied on by paying customers.

---

## 4. Sprint backlog

Each sprint ≈ 1–2 weeks. Sprint 0 is foundation/risk-reduction and should go first regardless of what follows.

### Sprint 0 — Security & correctness hardening ✅ done (2026-07-25, uncommitted)
- ✅ Removed client-side Gemini key usage from all 16 flagged components; added a generic `POST /api/ai/generate` passthrough (prompt/model/responseMimeType/responseSchema) to `server/routes/ai.ts` and routed every call through it via `authHeaders()`. Each component keeps its exact original prompt, model, JSON schema, and fallback/catch behavior — only the transport changed.
  - Deferred: `LiveAssistant.tsx` uses the Gemini **Live API** (`LiveServerMessage`/`Modality`), a persistent streaming session, not `generateContent` — it cannot be proxied through a simple REST endpoint and needs its own design (ephemeral token minting or a WebSocket proxy). Frozen behind `voiceStudio` flag, not user-reachable today.
- ✅ Allowlisted mutable fields for anonymous portal sessions in `firestore.rules` (`assessments`/`assessment_responses` updates now require `diff().affectedKeys().hasOnly([...])` matching exactly what `VendorPortal.tsx` writes — `organizationId`, `vendorId`, `frameworks`, and `portalOpen` itself can no longer be touched by an anonymous session).
  - Deferred: `storage.rules` still allows any signed-in (incl. anonymous) user to read/write any `/portal/{assessmentId}/{fileName}` path regardless of which assessment their session belongs to. Cross-referencing Firestore's `portalOpen` from Storage rules needs `firestore.get()` support and its own testing pass — not done this round to avoid an unverified change to file upload/download.
- ✅ Replaced fabricated `displayRiskScore()` midpoints with an honest "Not assessed" label (added `hasRealRiskScore()`) in `VendorsDirectory.tsx` and `AssessmentWizard.tsx` — same badge styling, just conditional on whether a real score exists.
- ✅ Added `.github/workflows/ci.yml` (Node 20, `npm ci` → `tsc --noEmit` → `jest` → `vitest run` on PRs/push to `main`/`dev`). Not pushed anywhere — stays local until you decide to commit.

**Verification status:** this sandbox has no Node/npm, so changes were reviewed manually (diff-by-diff) rather than compiled/tested here. Run `npm run lint && npm test && npm run test:vitest` (Cursor's terminal, which has Node) before trusting this. One thing to watch: `src/tests/vitest.setup.ts` mocks `@google/genai` globally — that mock is now dead for the components that moved to `fetch('/api/ai/generate')`, so `Dashboard.test.tsx` and `Risk.test.tsx` (which render two of the changed components) may need a `fetch` mock instead if they exercised the AI call path.

### Sprint 1 — Make the AI dedup story real ✅ done (2026-07-25, uncommitted)
- ✅ Replaced the 17-question generic stub in `src/lib/vendor/questionBank.ts` with a 48-question real control bank spanning all 5 portal categories, each question tagged with every framework (NIST CSF 2.0, SOC 2, ISO 27001, HIPAA, PCI DSS 4.0, CIS Controls) whose actual requirements it satisfies (e.g., MFA-for-privileged-accounts is tagged against all 6, since every framework requires it; PCI-specific cardholder-data-storage rules are tagged PCI-only).
  - Chose **rule-based control tagging** over embedding/semantic-similarity dedup for this first real implementation — deterministic, testable without a live AI call, and reviewable by a human auditor (a hallucinated embedding-similarity match would be a compliance risk). Embedding-based dedup for the eventual Custom Questionnaire upload path is still a reasonable Sprint 5+ enhancement.
  - `buildQuestionsForFrameworks()` dedup is now real: it filters the bank to items tagged with any selected framework, so overlapping controls collapse to one question automatically — no separate "dedup pass" needed since the bank itself has zero duplicate rows.
  - Added `countQuestionsForFramework()` and wired `FRAMEWORK_CATALOG.questionCount` (`src/lib/vendor/constants.ts`) to derive from the same bank instead of hand-maintained numbers — this changes the framework-card counts shown in the wizard from the mockup's placeholder 42/36/48/34/40/30 to real computed ones (22/25/37/20/23/25). The wizard's "source questions" and "unique questions" summary already read from these two functions, so no UI code changed — only the data underneath did.
  - With the wizard's default selection (NIST CSF 2.0 + SOC 2), this now shows a real **47 source → 31 unique** (16 shared controls collapse), replacing the previous always-17-regardless-of-selection stub.
- ✅ Added regression tests in `src/tests/questionBank.test.ts` proving the dedup is real (combined selection is strictly less than the sum of individual frameworks, never less than the max) and that `countQuestionsForFramework` stays in sync with `buildQuestionsForFrameworks`.

**Verification status:** same caveat as Sprint 0 — no Node/npm in this sandbox, reviewed by manual read-through and grep-based tag counting, not compiled. Run the same `npm run lint && npm test && npm run test:vitest`.

### Sprint 2 — Close Cynomi depth gaps
- Rich answer taxonomy (Single/Multiple choice) alongside existing Yes/No/Partial/N/A
- Vendor-level attachments (not just per-question evidence)
- PDF vendor report export

### Sprint 3 — Notifications & invite flow
- Email infra (Firebase Trigger Email extension) for vendor invites, reminders, due-date nudges
- Activate the unused `vendor_invites` collection end-to-end

### Sprint 4 — Billing hardening
(per `ARCHITECTURE_FOUNDATION.md` §4, already scoped there)
- Real Stripe Checkout wired, remove "simulate active subscription" path
- Seat/vendor cap enforcement server-side

### Sprint 5 — Differentiation (Growth/Gov upsell)
- AI risk narrative per vendor (`TrustScoreEngine.ts` → LLM summary)
- AI-drafted remediation tickets tied to Audit Lab gaps
- Continuous monitoring signal ingestion (design spike first)

### Sprint 6 — Enterprise
- SSO/SAML for Gov/Enterprise orgs
- "Answer once, reuse everywhere" trust exchange (design spike — needs consent model + cross-org sharing rules before build)
- MSP multi-client account switcher

---

## Cross-cutting references

| Doc | Role |
|---|---|
| `docs/PRODUCT_FOCUS.md` | Freeze + spine scope, Firestore Console setup |
| `docs/ARCHITECTURE_FOUNDATION.md` | DB/Auth/Billing phased plan, Stripe tier sketch |
| `docs/CYNOMI_GAP_NOTES.md` | Competitor parity gap notes |
| `docs/ENVIRONMENTS.md` | Project aliases, secrets, pre-customer checklist |
| `docs/SECRETS.md` | Key/secret handling policy |
| This doc | Codebase validation, AI-differentiation brainstorm, sprint backlog |
