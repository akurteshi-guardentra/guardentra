# Visible UX pass — Vendors & Assessments

Follow-up to the spine polish (`5060f8d` / `1ff0faa`). Deploy verification showed the
polish **is live**, but the product still *feels* unchanged because that work was
structure + shell consistency, not a redesign.

## Goal

Make `/vendors` and `/assessments` obviously different and clearer at a glance —
density, hierarchy, empty states, and one primary action path. Align chrome to the
FastTrack / TPR journey (Drive: GuardEntra Documents workflows + Phase 2 TPR diagram).

## Non-goals

- New features / new modules
- Homepage / Landing redesign
- Expanding Audit Lab, Docs, Pricing beyond honesty copy

## FastTrack inventory (guide vs live)

| TPR / guide step | Live route | Gap to close |
|------------------|------------|--------------|
| 1 Add vendor | `/vendors` | One primary CTA; stage strip; denser table |
| 2 Triage risk | `/assessments/triage` | Lite/Standard/Enhanced as three clear paths |
| 3 Generate assessment | `/assessments/new` | Stepper labels match guide |
| 4 Send questionnaire | Wizard send step | Due + reminders + portal link as climax |
| 5 Vendor completes | `/portal/:id` | Brand + receipt (shipped); quiet autosave |
| 6 AI + rules review | Assessments review | Exceptions-first surface |
| 7 Reviewer decision | Decision overlay | Four outcomes obvious |
| 8 Monitor & reassess | Assessments + Settings | nextReview / open conditions + audit verify |

Sources: Training Guide PDF, Graphical Workflow, Third-party risk PNG, Phase 2 gap diagram.

## Surfaces

| Page | Pain today | Target |
|------|------------|--------|
| Vendors | Filters + table + aside compete; KPI cards look like filler | One scan path: search → table → row action; aside demoted or collapsed |
| Assessments | Tracker works but still feels utility-dense | Tracker-first with calmer filters; review stays a focused overlay |
| Shared shell | PageShell header is easy to miss | Stage strip + stronger title hierarchy |

## Table ergonomics (light pass)

Folded from the enterprise-dashboard brief — only what helps the live spine:

- `min-w-0` + `truncate` on vendor/name cells (prevent flex overflow)
- `tabular-nums` on scores, dates, progress
- Soft slate text in dense rows (avoid pure white glow in tables)
- Defer: subgrid rewrite, virtualization, full APCA token system

## Concrete changes (implementation order)

1. **Shared FastTrack stage strip** on Vendors / Triage / Wizard / Assessments
2. **Vendors density** — one primary CTA (Add vendor); demote Bulk / Invite; compact KPI strip
3. **Assessments density** — tracker-first; lifecycle actions; empty → triage CTA
4. **Review / decide / monitor** — exceptions-first; four decisions; Settings verify when spine on
5. **Proof** — hard refresh shows stage strip + denser layout; `npm run verify:live` after push

## Success criteria

- A first-time user can say what the page is for from the first viewport alone
- Primary action is unambiguous without reading the aside
- Stage strip makes the FastTrack journey visible without reading docs
- Hard refresh after deploy shows an obvious layout change (not only an eyebrow label)

## Out of scope until after this pass

- Custom questionnaires, AI citation UX, PDF polish (see `docs/AGENT_HANDOFF.md`)
- Dual Firebase / Cloud SQL production enablement (Phase 2 Track B)
