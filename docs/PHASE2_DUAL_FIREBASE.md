# Dual Firebase EU / US (Phase 2 Week 1)

Prep code already exists (`organizations.dataRegion`, `server/lib/regionRouter.ts`).
Live isolation needs two Firebase projects.

## Create projects (Firebase console — CLI blocked)

```bash
# Suggested IDs (aliases already in .firebaserc):
#   guardentra-eu
#   guardentra-us
# Also reserved aliases: guardentra-dev / guardentra-staging / guardentra-prod

npx firebase-tools projects:list
```

### Org permission note (re-verified 2026-08-10)

Account `admin@guardentra.com` on `organizations/280975227603` currently has:

- `roles/billing.admin`
- `roles/resourcemanager.organizationAdmin`

But `organizations/...:testIamPermissions` does **not** return `resourcemanager.projects.create`
(only `resourcemanager.organizations.get`). Prior `firebase_create_project` / CLI create for
`guardentra-eu` failed with:

`Permission 'resourcemanager.projects.create' denied on parent resource 'organizations/280975227603'.`

Projects `guardentra-eu` / `guardentra-us` do not appear under this account (describe → permission denied / missing).

**Do not retry CLI create until create permission is confirmed.** Prefer console create by an org Owner
who can actually create projects, or grant Project Creator / fix org policy, then:

```bash
npx firebase-tools projects:create guardentra-eu --display-name "Guardentra EU"
npx firebase-tools projects:create guardentra-us --display-name "Guardentra US"
```

### Org Owner checklist

1. In Google Cloud Console → IAM (org `280975227603`), ensure a principal can create projects
   (`roles/resourcemanager.projectCreator` or equivalent; check org policies if create still fails).
2. Create Firebase projects `guardentra-eu` and `guardentra-us` (link billing).
3. Grant `admin@guardentra.com` Owner/Editor on both projects.
4. Confirm: `gcloud projects describe guardentra-eu` and `.firebaserc` aliases `eu` / `us`.

## Env wiring (App Hosting / server)

```
FIREBASE_PROJECT_ID_EU=guardentra-eu
FIREBASE_PROJECT_ID_US=guardentra-us
FIREBASE_STORAGE_BUCKET_EU=guardentra-eu.appspot.com
FIREBASE_STORAGE_BUCKET_US=guardentra-us.appspot.com
```

## Prove

```bash
npm run test:e2e-gate
# includes assertRegionIsolation — must fail EU→US cross reads when dual projects are wired
```

Until both projects exist, keep a single project and leave dual routing as prep-only
(see [`docs/ENVIRONMENTS.md`](./ENVIRONMENTS.md)).

Runbook printout: `powershell -File scripts/phase2-dual-firebase.ps1`
