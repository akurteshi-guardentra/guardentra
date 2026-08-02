# Product focus — freeze + Vendor spine (mockups 1→3)

Guardentra is focused on the **Vendor TPRM spine** under the existing **dark** theme. Non-spine modules are frozen behind feature flags (code kept, nav/routes blocked).

## Delivery order

1. Freeze non-core features (`src/lib/featureFlags.ts`)
2. Gap-fill mockups 1 → 2 → 3 (do **not** rebuild what already works)
3. Firestore foundation + security hardening before real customers

## Keep active

| Area | Routes |
|------|--------|
| Dashboard (slim CTAs) | `/dashboard` |
| Vendors + Impact | `/vendors`, `/vendors/:id/impact` |
| Assessments + wizard | `/assessments`, `/assessments/new` |
| Vendor portal | `/portal/:assessmentId` |
| Audit Lab | `/audit-readiness` |
| Docs / Pricing / Settings | `/docs`, `/pricing`, `/settings` |
| Auth / onboarding | `/login`, `/onboarding` |

## Frozen (Coming later)

Trust Intelligence, Agency Intelligence, Trust Vault, Executive Reports, Risks, Incidents, Identity Surface, Compliance, Contract Audit, Policies (+ Draftsman), Connectors, Gmail Auditor, Audit Calendar, Health & QA Lab, Voice Studio, AI Copilot, `/vendors/legacy`.

Re-enable with `VITE_FEATURE_<KEY>=true` (see `featureFlags.ts`).

## Reuse inventory (do not rewrite)

- Directory: KPIs, filters, bulk CSV, assessment chips, local fallback
- Wizard: vendor picker, frameworks, preview, create + status sync
- Portal: Yes/No/Partial/N/A, autosave, evidence upload path
- Correlation: `useOrgVendors` / `useOrgAssessments`, local stores

## Gap checklist (mockups)

### Mockup 1 — `/vendors`

- [x] Structure (KPIs, table, bulk, quick actions)
- [x] Risk score display when score is 0 (derive band score)
- [x] Assessment status icons
- [x] Invite CTA clarity (wizard with vendor preset)

### Mockup 2 — `/assessments/new`

- [x] Vendor pick, frameworks, preview, create
- [x] Two-pane Vendor | Frameworks layout
- [x] Framework tabs (Recommended / All / Industry / Custom)
- [x] Selected vendor card + dedupe banner layout

### Mockup 3 — `/portal/:id`

- [x] Start, answers, autosave, evidence, progress bar
- [x] Landing polish (due, progress ring, download instructions)
- [x] Category rail with Complete / In Progress / Not Started
- [x] Question X of Y chrome

## Theme

Keep dark Guardentra chrome. Match photo **structure/flow**, not light palette.

## Foundation / security

### Firestore `(default)` (manual — cannot create from app code)

In Firebase Console for the active project (`guardentra-dev` / staging / prod — not only demo):

1. Build → Firestore Database → **Create database** if missing
2. Choose **`(default)`** (or configure the client to a named DB consistently)
3. Start in production mode; deploy rules from this repo
4. Local vendor/assessment stores remain backup when the DB is unreachable

Blueprint: [`firebase-blueprint.json`](../firebase-blueprint.json) includes `/assessments/{assessmentId}` (portal questionnaires) alongside `/vendor_assessments`.

### Security hardening (in repo)

- Production Vite builds do **not** inject `GEMINI_API_KEY` into the client — prefer `/api/ai` with Firebase ID token auth
- `firestore.rules`: removed personal email bypass (`isAtIdhee`); portal assessment read/update requires auth + `portalOpen`
- `storage.rules`: portal evidence `read` requires signed-in (incl. anonymous)
- Deploy rules before real customers: `firebase deploy --only firestore:rules,storage`
