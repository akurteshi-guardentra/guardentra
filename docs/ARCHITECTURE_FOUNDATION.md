# Guardentra — Architecture Foundation

Durable architecture notes for Database, Auth/SSO, Policy validation, Stripe subscriptions, competitive positioning, a future regulatory-fine workflow, continuous monitoring signals (§7), and the three Enterprise design spikes — SSO/SAML (§8), trust exchange (§9), MSP multi-client (§10).

**Product lock-in:** Vendor TPRM spine under the existing **dark** Guardentra theme (`docs/PRODUCT_FOCUS.md`). Non-spine modules stay frozen behind feature flags.

**Phase order (relative to product-focus plan):**

1. Freeze non-core features  
2. Gap-fill mockups 1 → 2 → 3 (reuse inventory; do not rebuild)  
3. **Firestore foundation + Auth/security hardening** (this doc §§1–3)  
4. **Billing hardening** (this doc §4) — after spine + DB/auth are trustworthy for real customers  
5. Competitive polish and upsell modules — only after spine ships as the paid core  
6. Regulatory fine / failed-tool workflow — after user pastes the concrete flow (§6 placeholder)

---

## 1. Database foundation

Spine persistence today: Firestore collections for orgs/users/vendors/assessments, plus **localStorage fallbacks** when `(default)` DB is missing or unreachable. Demo project `guardentra-7f582` is not production. Target projects: `guardentra-dev` / `guardentra-staging` / `guardentra-prod` (`docs/ENVIRONMENTS.md`).

### Implementation

- **One Firestore database per Firebase project**, prefer `(default)`. Create in Console (cannot invent from app code). Align client `VITE_FIRESTORE_DATABASE_ID` / blueprint with whatever is created — never mix named DB in one env and `(default)` in another without explicit config.
- **Multi-env isolation:** separate Firebase projects for demo, dev, staging, prod. Never share Auth/Firestore/Storage across stages. Wire `.firebaserc` aliases once projects exist.
- **Spine collections (source of truth for paid product):**
  - `organizations`, `users`
  - `vendors`, `vendor_assessments`, `assessments` (portal questionnaires), `assessment_responses`
  - `evidence` (+ Storage paths for portal / impact attachments)
  - `audit_readiness` (Audit Lab)
- **Adjacent / frozen collections** keep rules in repo (`policies`, `risks`, `incidents`, …) but are not delivery blockers until flags re-enable them.
- **Deploy rules per project:** `firebase deploy --only firestore:rules,storage --project <alias>`. Confirm no personal email bypass (`isAtIdhee` removed).
- **Local fallback exit criteria** (when to stop treating `localVendorStore` / `localAssessmentStore` / `guardentra.localProfile` as acceptable primary):
  1. `(default)` exists and rules deployed in the active project  
  2. Auth profile `onSnapshot` succeeds within timeout (no DB-missing path)  
  3. Vendor + assessment CRUD round-trips Firestore for a seeded org  
  4. Portal assessment read/update + evidence upload works with anonymous auth  
  5. Staging smoke: two browsers, same org, see shared vendors/assessments  
- Until exit criteria pass: local stores remain **dev backup only**, not a customer data plane.

### Test

- Emulator or staging: create org → user profile → vendor → assessment → portal answers → evidence upload; assert docs under correct `organizationId`.
- Negative: unauthenticated write to `vendors` denied; closed portal (`portalOpen != true`) denies anonymous update.
- Cross-env: demo config must not write into staging/prod when `VITE_FIREBASE_*` unset (fail loud or stay on demo only).
- Fallback drill: with DB disabled, app still loads; with DB healthy, no silent dual-write to local-only as “success.”

### Validation

- Console: Firestore `(default)` present on `guardentra-staging` and `guardentra-prod`.
- Rules unit tests or Rules Playground cover `isOrgMember`, portal open path, admin delete.
- Storage: portal evidence readable only when signed-in (incl. anonymous); org evidence scoped.
- Product checklist: mockup spine data survives refresh and second device (proves Firestore, not localStorage).

### Plan

| Phase | Work |
|-------|------|
| Now (post-mockup) | Create `(default)` on staging; deploy rules; run exit-criteria checklist |
| Next | Create `guardentra-prod`; App Hosting `main` → prod only; remove reliance on demo for any shared sandbox |
| Later | Optional indexes for vendor/assessment queries; migrate any named-DB experiments to `(default)` consistently |
| Out of scope until paid | Multi-region DR, Firestore backups SLA marketing, MSP multi-tenant DB sharding |

---

## 2. Auth & sign-on

Today: Firebase Auth via `AuthContext` + `firebase-utils` — email/password, Google popup, **anonymous** for Vendor Portal evidence. Server `/api/ai` gated by `requireFirebaseAuth` (Bearer ID token) in production/staging. Profile lives in `users/{uid}` with `organizationId`; local profile fallback if Firestore missing.

### Implementation

- **Customer org users:** email/password + Google remain the baseline. Keep onboarding creating `organizations` + `users` docs (already in `AuthContext`).
- **Vendor Portal:** keep `signInAnonymously` for evidence Storage; ensure Anonymous provider enabled per Firebase project. Do not grant anonymous users org-wide reads — only `portalOpen` assessment paths (current rules intent).
- **Session model:** client holds Firebase session; privileged server routes verify `Authorization: Bearer <ID token>` (`src/lib/authHeaders.ts` + `server/middleware/requireFirebaseAuth.ts`). Prefer server-side Gemini (`/api/ai`); never inject `GEMINI_API_KEY` into production Vite bundles.
- **Future SSO / SAML (orgs & gov):** Firebase Auth SAML / OIDC providers (or Identity Platform) per enterprise org — **phase after** spine + Firestore hardening. Map IdP groups → Guardentra roles (`admin` / member) on `users` docs. Gov tenants may need separate Firebase tenants or dedicated projects.
- **Billing identity:** Stripe Customer linked on `users` (`stripeCustomerId`, `subscriptionStatus`) — prefer org-level subscription ownership when MSP multi-client appears (future); today user-scoped is fine for Starter.

### Test

- Login / signup / Google / logout happy paths; onboarding sets `onboarded` + org.
- Portal: anonymous session can update open assessment + upload evidence; cannot list other orgs’ vendors.
- Staging: `/api/ai` without token → 401; with valid token → allowed.
- Disable anonymous in a test project → portal upload fails with clear error (documents Console prerequisite).

### Validation

- Auth providers enabled explicitly on staging/prod (Email, Google, Anonymous).
- No personal-email rule bypass in deployed `firestore.rules`.
- Security review of portal update surface: fields anonymous may mutate should be allowlisted (answers/evidence), not org metadata or `portalOpen` flip — tighten rules if needed before customers.
- SSO: treat as enterprise checklist item, not blocking Starter launch.

### Plan

| Phase | Work |
|-------|------|
| Now | Confirm providers on staging; keep ID-token auth on AI routes; fix any portal field over-permission |
| Billing phase | Require signed-in user before Checkout; stop client-side “simulate active subscription” as production path |
| Post-spine | SAML/OIDC for Gov / Enterprise; optional SCIM later |
| Explicit non-goal (near term) | Building a custom IdP or replacing Firebase Auth |

---

## 3. Policy & controls validation

**Definition for Guardentra:** “Policy validation” means **controls-as-checkable artifacts** — framework control coverage, questionnaire answers, evidence objects, and an audit trail that an auditor can replay — **not** rewriting the frozen Policies / Draftsman UI.

Spine-aligned surfaces today: Assessment Wizard + Vendor Portal (answers + evidence), Impact assessment, Audit Lab (`/audit-readiness` → control coverage %, evidence gaps), markdown TPRM register export. Frozen: `/policies`, Compliance module, Contract Audit (upsell later).

### Implementation

- **Rules as code (product sense):** map framework IDs → question bank / control IDs; store responses on `assessments` / `assessment_responses`; store evidence with org + assessment linkage; Audit Lab writes `audit_readiness` snapshots (framework, coveragePercent, gaps).
- **Evidence chain:** Portal / Impact uploads → Storage + metadata; reviewer notes / remediations collections already sketched in rules — use when closing gaps, not for vanity UI.
- **Audit trail:** Phase 2 append-only spine lives in **PostgreSQL** (`audit_events` + `audit_hash_chain` + outbox), not Firestore. Product state stays in Firestore; material transitions emit via `POST /api/audit/emit` when `AUDIT_SPINE_ENABLED=true`. See [`docs/FASTTRACK_PHASE2.md`](./FASTTRACK_PHASE2.md). Until Cloud SQL is attached, the spine stays off and product flows continue without hashing.
- **Data region (P2B prep):** `organizations.dataRegion` is `eu`|`us`, set at org create (default `us`), immutable in rules. Server bindings resolve from trusted org records only ([`server/lib/regionRouter.ts`](../server/lib/regionRouter.ts)); dual Firebase projects still required before live isolation.
- **Do not** unfreeze Policies UI unless Plan phase says so; if policy text is needed for Audit Lab context, read existing `policies` collection optionally without shipping Draftsman.

### Test

- Assessment: Yes/No/Partial/N/A + evidence → visible in org review path.
- Audit Lab: scan against a framework produces coverage + gap list tied to vendor evidence gaps.
- Export: markdown register includes assessment status / risk band for sampled vendors.
- Regression: with `VITE_FEATURE_POLICIES=false`, `/policies` stays Coming later.

### Validation

- Auditor persona can answer: “Which control failed, what evidence was attached, who attested, when?” using spine data only.
- Gap missed in questionnaire should appear as Audit Lab / review finding — foundation for §6 fine workflow later.
- No claim of “policy engine complete” until Policies module is intentionally re-enabled and tested.

### Plan

| Phase | Work |
|-------|------|
| Spine (current) | Harden evidence + readiness as the validation MVP |
| Framework packs (shipped) | Versioned `FRAMEWORK_PACKS` in `src/lib/vendor/frameworkPacks.ts`; assessments stamp `frameworkPackIds` + `questionBankVersion` + `controlKey` on each question; org pins in Settings; no auto-download of SDO standards; existing assessments never auto-upgrade |
| After billing | Optional Firestore-hosted pack hotfixes (same schema); richer email notify on new pack publish |
| Later upsell | Unfreeze Policies / Compliance; link policy docs → controls → evidence via `controlKey` |
| Avoid | Parallel “policy product” that duplicates Audit Lab + portal; client scraping of NIST/ISO sites |

**Framework update model:** Guardentra content team edits the question bank / packs and ships a release. Admins see newer versions in Settings / Assessments, review the changelog/diff, and pin defaults for *new* assessments. Optional rebaseline (`rebaselineAssessment` / `applyAssessmentRebaseline`) copies answers by `controlKey`. AI `/api/ai/framework-map` suggests mappings but never auto-applies.

---

## 4. Stripe subscriptions & pricing

**Model:** B2B SaaS subscriptions (not Stripe Connect marketplace). Prefer **Checkout Sessions** `mode: 'subscription'` + **Customer Portal** for self-serve manage/cancel/payment method. Use Billing **Products + Prices** (not deprecated Plans). Flat seat/vendor caps first; defer complex usage metering — if true usage-based AI or API billing is needed later, evaluate **Metronome** per Stripe guidance rather than bolting Meters onto an unfinished catalog.

**Code reality:** `server/routes/stripe.ts` creates Checkout (currently passes `payment_method_types` — **remove** so Dashboard dynamic payment methods apply). Webhooks: `checkout.session.completed`, `customer.subscription.updated|deleted` → `users` subscription fields. Pricing page still **simulates** upgrade in Firestore when keys/path incomplete — replace with real Checkout redirect before live. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; staging = **test** keys, prod = **live**. Prefer restricted API keys (`rk_`) over long-lived `sk_` where operable.

### Implementation

**Recommended tier sketch** (list prices are **Guardentra starter proposals**, not scraped competitor quotes):

| Product (create separate Stripe Product per tier) | Monthly Price | Annual Price (~20% off) | What unlocks |
|---------------------------------------------------|---------------|-------------------------|--------------|
| **Guardentra Starter** | $149 | $1,490/yr | Vendor TPRM spine: vendors, impact, assessments, portal, markdown export; up to **25 vendors**, **3 seats**, Audit Lab basic (1 framework pack) |
| **Guardentra Growth** | $399 | $3,990/yr | Up to **150 vendors**, **10 seats**, multi-framework packs, bulk CSV, priority email support; optional AI review assists (metered soft cap, see below) |
| **Guardentra Gov** | Custom (sales) | Custom | Higher/ unlimited vendors, SSO/SAML, dedicated staging, BAA/DPA process, frozen modules as negotiated add-ons (Compliance, Policies, Gov Intel, Trust Vault) |

Map freeze → packaging:

- **Included in Starter+:** dashboard, vendors, assessments, portal, audit readiness, docs, settings (feature flags already on).
- **Growth / Gov upsell (flags off today):** Trust Intelligence, Agency/Gov Intel, Trust Vault, Executive Reports, Risks, Incidents, Identity Surface, Compliance, Contract Audit, Policies, Connectors, Gmail Auditor, etc.

**Flat vs metered:**

- **Flat:** subscription tier (Product/Price), vendor cap, seat cap.
- **Soft-metered (Growth):** AI calls via `/api/ai` — enforce org monthly quota in app; overage = upgrade CTA. Avoid Stripe Meters for v1.
- **Hard metered later:** only if AI becomes primary cost driver → Metronome or simple overage Price.

**Stripe objects to create (Dashboard or API, test mode first):**

1. Products: `Guardentra Starter`, `Guardentra Growth`, `Guardentra Gov` (Gov may be Price-less + Checkout only after sales quote).  
2. Prices: monthly + annual recurring USD for Starter and Growth; store real `price_…` IDs in env (`STRIPE_PRICE_STARTER_MONTHLY`, …) — replace placeholders in `Pricing.tsx`.  
3. Customer Portal configuration: cancel, switch plan, update payment method.  
4. Webhook endpoint on Cloud Run / App Hosting: same events as today + `invoice.paid` / `invoice.payment_failed` for dunning UX.  
5. Tax: enable Stripe Tax only **after** active registrations; do not assume `automatic_tax` alone collects tax.

**Checkout session pattern:** omit `payment_method_types`; set `client_reference_id` / metadata `userId` + prefer `organizationId`; `success_url` / `cancel_url`; `allow_promotion_codes` OK; on API ≥ `2026-03-25.dahlia` consider `integration_identifier` for funnel analytics.

### Test

- Test-mode Checkout → webhook → `subscriptionStatus: active` on user (and later org).
- Portal: customer cancels → webhook → status `canceled` / `unpaid`; UI gates spine create if required.
- No secret key → mock URL only in development; staging must not silently “simulate active.”
- Card decline / failed invoice path does not leave zombie “active” in Firestore.

### Validation

- Live mode keys only on `guardentra-prod`; webhook signing secret per endpoint.
- Price IDs in env match Products customers see on `/pricing`.
- Feature gating: unpaid org cannot create unlimited vendors (enforce caps server-side eventually; client checks insufficient alone).
- Legal: pricing page copy matches spine (Vendor TPRM / Audit readiness), not generic GRC vapor.

### Plan

| Phase | Work |
|-------|------|
| After DB/auth | Wire real Checkout; remove simulation path; Customer Portal link in Settings |
| Catalog | Create Starter/Growth Products+Prices in test; mirror to live |
| Hardening | Org-level subscription doc; seat/vendor enforcement; invoice failure UX |
| Later | Gov custom contracts; optional Metronome if AI usage explodes |
| Not recommended | Connect marketplace payouts for core SaaS billing |

---

## 5. Competitive differentiation (Cynomi & peers)

Grounded in `docs/CYNOMI_GAP_NOTES.md` and shipped spine — **not** roadmap vaporware.

### Implementation

**What Guardentra already stands on (shipped / in-repo spine):**

- Dark-theme Vendor TPRM flow: directory → Impact → Assessment wizard (framework multi-select + preview) → Vendor Portal (Y/N/Partial/N/A, autosave, evidence) → Audit Lab readiness.
- Impact + security path toward final rating (Cynomi-style dual track pattern addressed).
- Local→Firestore resilience for demos; markdown TPRM register export.
- Feature freeze: honest product boundary vs kitchen-sink GRC.

**Honest gaps vs Cynomi (do not market as done):**

- Answer model still Y/N/Partial/N/A vs rich SC/MC taxonomies.
- No MSP multi-client account switcher.
- PDF vendor report still missing (markdown export exists).
- Questionnaire preview exists in wizard; Cynomi-depth vendor-detail “Resend / Manage access” polish may still lag.
- Mature inherent/residual analytics charts are thinner than Cynomi’s KPI charts when empty-state polished.

**Peers (OneTrust, ServiceNow VRM, Whistic, SecurityScorecard, etc.):** typically heavier enterprise suite, questionnaire networks, or ratings feeds. Guardentra’s wedge: **fast audit-ready vendor evidence loop** for teams that outgrew spreadsheets but will not deploy a full GRC platform in quarter one.

**Positioning line (defensible):**  
“Guardentra is Vendor TPRM + audit readiness with evidence attached to answers — Impact, questionnaire portal, and control-gap scans in one dark-ops console — not a 40-module GRC suite.”

### Test

- Sales/demo script: create vendor → impact → send assessment → portal complete → Audit Lab gap — timed vs spreadsheet baseline.
- Side-by-side checklist against Cynomi notes: only claim rows marked shipped.
- Pricing page features list matches flags (no “AI Copilot” on Starter while frozen).

### Validation

- Every public differentiator maps to a route in PRODUCT_FOCUS “Keep active.”
- Gap notes updated when mockups close items (already partially done).
- Avoid competitor price claims unless labeled **estimate** and sourced.

### Plan

| Phase | Work |
|-------|------|
| Now | Sell spine; keep freeze; update CYNOMI notes when UX closes gaps |
| Growth tier narrative | Multi-framework + bulk + AI assist as paid depth |
| Later | MSP multi-client, PDF reports, richer answer types — sequenced after billing |
| Never as launch claim | “Replaces OneTrust” or “full policy lifecycle” while Policies frozen |

---

## 6. Regulatory fine / failed-tool workflow (placeholder)

**Intent:** Capture a future narrative the user will paste: organizations (or states) adopted market GRC/TPRM tools, completed assessments, still missed a gap, and received a **regulatory fine**. Structure below is ready to fill; do not invent the user’s story.

**Actors (expected):** `Organization` | `State / public body` | `Regulator`  
**Stages (expected):** Tool adopted → Assessment completed → Gap missed → Fine issued → (optional) Remediation / re-attestation  

### Implementation

- **Awaiting user workflow paste.**  
- Stub data model (do not build until paste): `regulatory_cases` (orgId, jurisdiction, toolVendor, assessmentRef, missedControlIds, fineAmount, fineDate, regulatorRef); link to existing `assessments` / `audit_readiness` / evidence for “what was attested vs what failed.”  
- UI placeholder: future route or Audit Lab panel — **not** scheduled while spine freeze holds.

### Test

- **Awaiting user workflow paste.**  
- When pasted: translate each stage into given/when/then cases (e.g., assessment status complete + evidence present + control still failing → case eligible).

### Validation

- **Awaiting user workflow paste.**  
- Success criteria TBD with user: e.g., can reconstruct “tool X said green, control Y open, fine Z” from Guardentra records alone.

### Plan

- **Awaiting user workflow paste.**  
- After paste: map stages → spine objects; decide if this is a **Gov-tier** narrative module or an Audit Lab report template; sequence behind DB/auth/billing.  
- Until then: no code, no Stripe SKU, no nav entry.

---

## 7. Continuous monitoring signals (design spike, per `docs/PRODUCT_ROADMAP_2026.md` Sprint 8c)

**Intent:** blend lightweight external signal ingestion into vendor risk between assessment cycles, so risk isn't static until the next questionnaire — a Growth/Gov-tier differentiator vs. SecurityScorecard/BitSight-style continuous monitoring. This section is a design spike only — deliberately no code yet, per the roadmap's own sequencing (design first, build later, once the open questions below have real answers).

### Open questions this spike surfaces (need your answers before any code)

1. **Which signals, and from where?** Realistic v1 candidates using cheap/free public APIs rather than a commercial threat-intel subscription:
   - Domain/certificate hygiene — SSL cert expiry and config via SSL Labs' free API, or `securityheaders.com`'s API for missing security headers.
   - Public breach disclosure — HaveIBeenPwned's domain-search API (paid tier; per-lookup cost needs a real budget decision, not a default-on assumption).
   - DNS hygiene — SPF/DKIM/DMARC presence (free, simple DNS TXT lookups).
   None of these require a vendor's cooperation — they only need the vendor's public domain, already on file as `primaryContactEmail`'s domain or a new `website` field (`Vendor` type doesn't have one today — would need adding).
2. **Who runs the scan, and how often?** This is inherently a background job, not something to fetch on page load (API keys, rate limits, cost). No Cloud Scheduler/Cloud Functions exist in this project today. Two options, neither built:
   - A GitHub Actions scheduled workflow (`on: schedule`) hitting a new authenticated server endpoint — reuses the CI mechanism already in this repo (`.github/workflows/ci.yml`), no new GCP infra, but GitHub's free-tier cron can be delayed/skipped (acceptable for a weekly cadence, not for anything time-sensitive).
   - Cloud Scheduler + a Cloud Function / Cloud Run job — more reliable, but a genuinely new piece of infrastructure this project doesn't have.
3. **How does this show up in the UI without breaking the audit trail?** `ARCHITECTURE_FOUNDATION.md` §3 already establishes that Guardentra's differentiator is an auditable "what was attested vs. what failed" chain. Silently blending an external signal into the existing assessment-derived `riskScore` would break that traceability. Proposed instead: a separate `continuousMonitoringScore`/`signalFlags: string[]` field, shown distinctly (e.g. "Assessed: 85 (Jul 2026) · 2 new monitoring flags since"), never overwriting the assessment-derived number.
4. **Tier gating and cost control.** Growth/Gov only, per the original positioning — needs a subscription-tier check before running any paid-API lookup for a given org, and a hard per-org monthly cap on paid lookups (same soft-metering pattern already used for AI usage and vendor caps).

### Plan

| Phase | Work |
|-------|------|
| Now | Design only (this section) — no code, no new collection, no scheduled job |
| Next, pending your answers above | Add `website` field to `Vendor`; pick the free-tier signals to start with; decide GitHub Actions cron vs. Cloud Scheduler |
| Later | Wire the chosen signals into a scheduled job writing to a new `vendor_signals` collection (or fields on the vendor doc), surfaced as a distinct "Monitoring" badge alongside (not replacing) the assessment-derived risk score |
| Out of scope until a real budget decision | Any paid breach-feed API (HaveIBeenPwned) — free DNS/cert checks first |

---

## 8. SSO/SAML for Gov/Enterprise (design spike, `docs/PRODUCT_ROADMAP_2026.md` Sprint 9a)

**Now viable to design** — this was blocked on multi-user orgs (Sprint 4, done: `src/lib/orgBootstrap.ts`, `org_invites`). Still not viable to *build* blind: real SAML requires infrastructure this project doesn't have and a live IdP to test against, neither of which can be provisioned from code.

### The real blocker

Firebase Auth's base tier doesn't support SAML/OIDC providers — that requires upgrading to **Google Cloud Identity Platform**, a paid, opt-in extension of Firebase Auth (per-MAU billing). That's a billing decision only you can make in the Firebase/GCP Console; nothing here can enable it. Once enabled, `firebase/auth`'s `SAMLAuthProvider`/`OAuthProvider` classes work with the same `signInWithPopup`/`signInWithRedirect` calls already used for Google sign-in (`src/lib/firebase-utils.ts` `signInWithGoogle`) — the client-side mechanics are a small, well-understood change. The hard parts are everything around it:

### Design

- **Org-to-IdP mapping.** Guardentra's tenancy is flat collections + an `organizationId` field (`firestore.rules`), not Firebase's own multi-tenant feature. Simplest viable approach without adopting Identity Platform tenants: store `ssoProviderId`/`ssoDomain` on the `organizations` doc. On Login, ask for email first; if the domain matches a configured `ssoDomain`, redirect to that provider instead of showing a password field.
- **Provisioning from SSO.** `bootstrapUserProfile()` (`src/lib/orgBootstrap.ts`) already has the right shape for this — extend its "no existing profile" branch to check email-domain → org match (alongside the existing pending-invite check) before falling back to creating a brand-new org.
- **Role mapping from IdP groups.** Needs the IdP to pass group/role claims, and something server-side to read them and set `users/{uid}.role` accordingly — Identity Platform supports this via a "beforeSignIn" blocking Cloud Function, which is a new piece of infrastructure (this project has none today, per `docs/ARCHITECTURE_FOUNDATION.md` §1's Cloud Run/Express-only backend).
- **Self-serve IdP configuration.** A real enterprise customer expects to paste their own SAML metadata (Entity ID, SSO URL, x509 cert) into a settings page. Identity Platform providers are configured in the GCP Console, not through your own app UI, unless you build a wrapper around the Identity Platform Admin REST API from a trusted server route — more scope again.

### Plan

| Phase | Work |
|-------|------|
| Now | Design only (this section) |
| Blocking decision needed from you | Enable Identity Platform billing; pick a real IdP (Okta/Azure AD/etc.) to test against — nothing below can be verified without one |
| Next | `ssoProviderId`/`ssoDomain` on `organizations`; domain-aware Login page; extend `bootstrapUserProfile()` |
| Later | Role-from-IdP-group mapping (needs a Cloud Function — new infra); self-serve IdP config UI (needs the Identity Platform Admin API) |
| Not recommended now | Building any of this without a real IdP to test end-to-end — auth bugs are exactly the wrong place to ship unverified |

---

## 9. "Answer once, reuse everywhere" trust exchange (design spike, Sprint 9b)

**Intent:** a vendor who's completed a questionnaire for Customer A can reuse those answers for Customer B, instead of answering the same NIST/SOC2 questions from scratch every time a new customer asks. This is Whistic's core wedge (`docs/PRODUCT_ROADMAP_2026.md` §3) — genuinely the biggest strategic differentiator on the roadmap, and also the biggest lift.

### Why this doesn't fit today's model

Every `assessments` doc is scoped to exactly one `organizationId` + one `vendorId` (`firestore.rules`), and the vendor has no identity of their own — `VendorPortal.tsx` uses `signInAnonymously`, a fresh anonymous session per link, not a persistent vendor account. There is nothing to attach a "reusable" answer set *to*.

### Design

- **Vendor needs a real identity**, independent of any customer org — a new `vendor_accounts/{id}` keyed by email/domain, with actual sign-in (not anonymous), separate from any one customer's `vendors/{vendorId}` record.
- **Stable control keys.** Each `BankItem` / snapshotted portal question carries a durable `controlKey` (`src/lib/vendor/questionBank.ts`). Framework pack versions (`src/lib/vendor/frameworkPacks.ts`) stamp assessments with `frameworkPackIds` so historical questionnaires stay pinned. Remaining trust-exchange work is vendor identity + consent + cross-org rules — not inventing control identity.
- **Consent is mandatory, not automatic.** A vendor's answers may include specifics they don't want shared with everyone who asks — every reuse needs an explicit per-customer consent step, not silent auto-fill. Sketch: `vendor_answers/{vendorAccountId}_{controlKey}` (canonical answer + evidence), `vendor_shares/{id}` (which org, which controlKeys, consented when, expires when).
- **Cross-org Firestore rules.** Today's rules assume a doc belongs to exactly one org. A shared vendor answer needs to be readable by *multiple* customer orgs once consented — a genuinely different security model than the strict single-org scoping everywhere else in `firestore.rules`, and worth getting a second pair of eyes on before shipping.

### Plan

| Phase | Work |
|-------|------|
| Now | Design only |
| Precursor work (own effort, sequenced first) | Real vendor accounts/auth; consent UI (`controlKey` on the bank is already shipped) |
| Then | `vendor_answers`/`vendor_shares` collections + rules; wire consent into the Assessment Wizard's create flow (pre-fill overlapping controls, vendor confirms per new customer) |
| Not attempted now | Any of the above — this is a multi-sprint effort in its own right once the precursors land, not a single pass |

---

## 10. MSP multi-client account switcher (design spike, Sprint 9c)

**Intent:** one login for an MSP (a firm managing security for many client companies) that can switch between client organizations, instead of the current one-user-one-org model.

### Scope of the change

Every `users/{uid}` doc has exactly one `organizationId`, and it's read directly (not passed as a parameter) in **25 files** across the client (`profile?.organizationId` / `profile.organizationId`). `firestore.rules`' `isOrgMember(orgId)`/`isDocOrgMember()` check `users/{uid}.organizationId == orgId` as the *only* path to access — there's no "also a member of this other org" concept anywhere.

One encouraging finding: the data-fetching hooks already take `orgId` as an explicit parameter (`useOrgVendors(orgId)`, `useOrgAssessments(orgId)` — `src/lib/vendor/useOrgVendors.ts`/`useOrgAssessments.ts`), not a hidden global — so the query layer itself doesn't need to change, only *what org ID gets passed in* when an MSP user is active.

### Design

- **New `msp_memberships/{id}`** collection: `{ mspUserId, clientOrganizationId, role }` — a user can have many of these, separate from their own home `organizationId` (their MSP firm's own org, if they have one).
- **"Active org" context**, distinct from `profile.organizationId`: a React context holding the currently-selected client org, defaulting to the user's home org, changeable via a switcher in `Layout.tsx`'s header. Every hook/query call site among those 25 files needs auditing to read from this active-org context instead of `profile.organizationId` directly where an MSP user is involved.
- **Firestore rules**: `isOrgMember`/`isDocOrgMember` need an alternate path — `exists()` a matching `msp_memberships` doc for `request.auth.uid` + the target org — touching every collection's rule, not a localized change.
- **Billing**: ties into `ARCHITECTURE_FOUNDATION.md` §4, which already flagged this — "prefer org-level subscription ownership when MSP multi-client appears (future)." An MSP's billing model (one subscription covering many clients, or per-client) is a business decision, not just an engineering one.

### Plan

| Phase | Work |
|-------|------|
| Now | Design only |
| Recommended incremental start | Read-only cross-org visibility for MSP users first (lower risk than write access across orgs from day one) |
| Then | `msp_memberships` + active-org context + switcher UI; audit and update the 25 direct-`organizationId` call sites |
| Then | Extend `isOrgMember`/`isDocOrgMember` in `firestore.rules` for every collection |
| Not attempted now | This is the largest of the three Sprint 9 asks — a multi-sprint initiative once you're ready to commit to the tenancy-model change, not a single pass |

---

## Cross-cutting references

| Doc / code | Role |
|------------|------|
| `docs/PRODUCT_FOCUS.md` | Freeze + spine + Firestore Console steps |
| `docs/ENVIRONMENTS.md` | Project aliases, secrets, before-customers checklist |
| `docs/SECRETS.md` | Password/key policy, 1Password / App Hosting, Stripe RAK + MCP OAuth |
| `docs/CYNOMI_GAP_NOTES.md` | Competitive walkthrough facts |
| `src/lib/featureFlags.ts` | Spine vs frozen modules |
| `firestore.rules` / `storage.rules` | AuthZ for spine + portal |
| `server/routes/stripe.ts` | Checkout + webhooks |
| `server/middleware/requireFirebaseAuth.ts` | Server AI auth |
| `src/lib/AuthContext.tsx` | Session + org bootstrap + local fallback |

---

*Last updated: 2026-07-26. Do not treat list prices as competitor benchmarks; treat them as Guardentra catalog starters pending Stripe Product creation.*
