# #226 Vendor archive — staging acceptance gate

Status: **SOURCE READY ON PR — INDEX NOT DEPLOYED BY THIS WORK**

PR: https://github.com/akurteshi-guardentra/guardentra/pull/255  
Issue: https://github.com/akurteshi-guardentra/guardentra/issues/226

## Why this gate exists

`POST /api/org/vendor-archive` queries:

```text
assessments where organizationId == org AND vendorId == vendor
```

That shape needs the composite index defined in `firestore.indexes.json`:

- collection: `assessments`
- fields: `organizationId` ASC, `vendorId` ASC

Without that index live in the target Firebase project, open-assessment blocking can fail at runtime even when source and unit tests are green.

## Staging acceptance (before enabling archive in staging)

1. Merge of PR #255 into the release candidate is authorized separately.
2. Owner deploys indexes only: `firebase deploy --only firestore:indexes --project <staging-project>` (or equivalent).
3. Read back that the `assessments` / `organizationId`+`vendorId` index is **READY** (not Building).
4. Smoke: archive a synthetic vendor with no open assessments succeeds; archive with an open assessment returns `409 vendor_has_open_assessments`.
5. Confirm `vendorCount` decrements once and a `vendor.archived` material audit intent is written.

## Production

Same index deploy + readback on `guardentra-prod`, after staging acceptance. Not authorized by the PR alone.

## Out of scope of PR #255

- Index deploy
- Rules deploy
- Merge
- Production rollout
