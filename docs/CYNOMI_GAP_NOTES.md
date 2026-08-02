# Cynomi vs Guardentra — Vendor / Assessments gap notes

Read-only reference study for plan Step 6.  
**Hard rule:** view/navigate only — no create/edit/delete/resend on Cynomi data.

## In-app walkthrough (PPCIGA account, Jul 2026)

Logged into `dashboard.cynomi.com` as Gentian Mema / account **PPCIGA**.

### Vendor Risk list (`/vendors`)
- Nav label: **Vendor Risk** (not “Vendors” alone).
- KPI charts: **Inherent Risk** + **Residual Risk** (empty until data exists).
- Table actions: Search, Filter, **Download CSV**, **Add Vendor**.
- Row shows vendor name + assessment status chip (e.g. “In progress”).
- Delete on row can be disabled depending on state.

### Vendor detail (`/vendors/{id}`)
Example: **JPI Data Resources (Laserfiche Consultants)** — type SaaS; contact/phone/email/website in a **Details** side panel with inline edit affordances.
- Top action: **Report** (download).
- **Final Assessment** = Impact + Security combined; banner until both complete: “Complete both Assessments to determine the Vendor Rating.”
- **Impact Assessment** — completed separately (date, impact band e.g. Moderate, completed-by); View / Edit / Delete.
- **Security Assessment** — Questionnaire *or* Manual Input toggle.
  - Status: Awaiting Response when questionnaire sent.
  - Shows template name (“Cynomi General Security Assessment”), recipient, Manage access / Remove Access / Delete / **Resend** / **Preview**.
- **Vendor Notes** + **General Attachments** (drag-drop, **20 MB** max) — evidence lives at vendor level, not only per-question.

### Questionnaire preview (`/vendors/security-assessment/preview/...`)
Numbered domains (Collapse/Expand All):
1. Governance and Risk Management (11)
2. People and Process (5)
3. Identity and Access Management (5)
4. Asset and Data Management (5)
5. Protection (9)
6. Detection and Response
7. Resilience
8. Generative AI Use  

Question types: **Single Choice** / **Multiple Choice** with N answers (not Guardentra’s Yes/No/Partial/N/A only).

### Assessments module (nav)
Separate top-level **Assessments** for client security programs (distinct from vendor security questionnaires).

## Cynomi TPRM patterns vs Guardentra spine

| Pattern | Cynomi | Guardentra today |
|---------|--------|------------------|
| Dual track: Impact + Security → final rating | Yes | Single assessment path; no explicit Impact track |
| Inherent / Residual risk charts on directory | Yes | KPI cards (counts / risk bands), different model |
| Questionnaire + Manual Input | Yes | Portal questionnaire only |
| Preview before/during send | Yes | No dedicated preview surface |
| Vendor-level attachments (20 MB) | Yes | Per-question Storage evidence (25 MB validator) |
| Answer model | Multi-option SC/MC | Yes / No / Partially / N/A |
| Domain taxonomy | 8 Cynomi domains incl. GenAI | 5 categories (Company Profile → BC) |
| CSV download of register | Yes | Markdown Export + CSV *template* for bulk upload |
| Report download on vendor | Yes | Markdown register export (PDF still missing) |
| Account switcher (MSP multi-client) | Yes | Single org |

## Recommended polish (from this walkthrough)

1. ~~**Impact assessment step**~~ — shipped: `/vendors/:id/impact` + `finalRating`.
2. ~~**Questionnaire Preview**~~ — shipped: Assessment wizard step 3.
3. ~~**Vendor-level attachments**~~ — shipped on Impact page (20MB, Storage).
4. Keep Guardentra **dark theme**; do not copy Cynomi light UI chrome.
5. Already shipped: directory **Export** → markdown TPRM register.
6. **Audit Readiness** — framework picker, control coverage, evidence gaps, Compliance progress sync.

## Public docs (still valid)

- Shared vendors across MSP clients, client-risk linkage, CISO weighting, trimmed question sets remain longer-term differentiators.
