# Visible UX pass — Vendors & Assessments

Follow-up to the spine polish (`5060f8d` / `1ff0faa`). Deploy verification showed the
polish **is live**, but the product still *feels* unchanged because that work was
structure + shell consistency, not a redesign.

## Goal

Make `/vendors` and `/assessments` obviously different and clearer at a glance —
density, hierarchy, empty states, and one primary action path.

## Non-goals

- New features / new modules
- Homepage / Landing redesign
- Expanding Audit Lab, Docs, Pricing beyond honesty copy

## Surfaces

| Page | Pain today | Target |
|------|------------|--------|
| Vendors | Filters + table + aside compete; KPI cards look like filler | One scan path: search → table → row action; aside demoted or collapsed |
| Assessments | Tracker works but still feels utility-dense | Tracker-first with calmer filters; review stays a focused overlay |
| Shared shell | PageShell header is easy to miss | Stronger title hierarchy, less nested card-on-card |

## Concrete changes (implementation order)

1. **Vendors density**
   - Collapse “Quick Actions” / bulk tips into a single overflow menu or first-run hint
   - Keep one primary CTA (Add vendor); demote Bulk / Invite
   - Tighten filter bar to one row on desktop; move “More filters” defaults off-path

2. **Assessments density**
   - Keep tracker table as the only main surface
   - Group row actions by lifecycle (copy link / remind / review) with clearer labels
   - Improve empty state copy + single CTA to triage

3. **Visual hierarchy**
   - Reduce nested borders (PageBand inside PageShell should not double-frame)
   - KPI stats: smaller or inline, not four equal hero cards competing with the table
   - Consistent table header + row height / action affordances

4. **Proof**
   - Screenshot before/after for Vendors + Assessments
   - `npm run verify:live` after push to confirm deploy

## Success criteria

- A first-time user can say what the page is for from the first viewport alone
- Primary action is unambiguous without reading the aside
- Hard refresh after deploy shows an obvious layout change (not only an eyebrow label)

## Out of scope until after this pass

- Custom questionnaires, AI citation UX, PDF polish (see `docs/AGENT_HANDOFF.md`)
