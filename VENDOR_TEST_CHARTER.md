# Vendor spine — smoke & exploratory charter

## Smoke (every PR / local before demo)

1. `npm run lint` and `npm run test:vitest` pass (Jest suite is legacy/optional)
2. `npm run dev` boots; `/api/health` returns ok
3. Login → `/vendors` shows KPI cards + table (empty or live data)
4. Add Vendor with valid data → row appears
5. Add Vendor with bad email → validation error
6. From row **Assess** → `/assessments/new` wizard opens with vendor selected
7. Select frameworks → Create assessment → lands on `/assessments?vendorId=…` tracker (portal link via **Copy Vendor Portal Link**)
8. Open `/portal/:id` → start questionnaire → answer Yes/No/Partial/N/A → autosave indicator
9. Upload a small PDF (needs Storage rules deployed + portal custom-token auth working)
10. Classic workspace still available at `/vendors/legacy` (feature-flagged)

## Exploratory (manual, weekly)

- Combine filters: Critical + Cloud Services + Due Soon
- Pagination when >10 vendors
- Duplicate vendor names (note for future AI dedupe)
- Wizard with zero frameworks blocked; Custom-only blocked
- Very long vendor name / unicode characters
- Portal evidence upload size >25MB rejected
- Org isolation: user A must not see user B vendors (rules)
- Portal works while org user is logged out (scoped custom token via `/api/portal/token`, not anonymous Auth)
- Empty legacy assessment (`questions: []`): Review → Rebuild from packs or Archive with reason

## Firebase console checklist for uploads

- Authentication → custom token minting works for portal (Admin SDK on server)
- Deploy `firestore.rules` and `storage.rules` (`firebase deploy --only firestore:rules,storage`)

## Not yet covered (later steps)

- Real CSV bulk import
- Playwright E2E happy path
- Invite colleague on portal
