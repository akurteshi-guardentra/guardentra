# Vendor spine — smoke & exploratory charter

## Smoke (every PR / local before demo)

1. `npm run lint` and `npm test` pass
2. `npm run dev` boots; `/api/health` returns ok
3. Login → `/vendors` shows KPI cards + table (empty or live data)
4. Add Vendor with valid data → row appears
5. Add Vendor with bad email → validation error
6. From row **Assess** → `/assessments/new` wizard opens with vendor selected
7. Select frameworks → Create assessment → lands on `/assessments`
8. Classic workspace still available at `/vendors/legacy`

## Exploratory (manual, weekly)

- Combine filters: Critical + Cloud Services + Due Soon
- Pagination when >10 vendors
- Duplicate vendor names (note for future AI dedupe)
- Wizard with zero frameworks blocked
- Very long vendor name / unicode characters
- Portal evidence upload size >25MB rejected (Step 4)
- Org isolation: user A must not see user B vendors (rules)

## Not yet covered (later steps)

- Real CSV bulk import
- Full questionnaire portal autosave
- Playwright E2E happy path
