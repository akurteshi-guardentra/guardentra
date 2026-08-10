# Dual Firebase bootstrap notes
# Creates nothing automatically - prints the exact commands after billing is ready.
# Usage: powershell -File scripts/phase2-dual-firebase.ps1

Write-Host @"
Dual Firebase (EU/US) - after spine proof

1. Org Owner must create projects (CLI create blocked for admin@guardentra.com):
   - guardentra-eu
   - guardentra-us
   testIamPermissions omits resourcemanager.projects.create on organizations/280975227603
   even with organizationAdmin — use console or grant Project Creator.
   Aliases already in .firebaserc: eu / us.

2. Enable Auth (Email + Anonymous), Firestore, Storage on both.

3. Deploy rules to each:
   npx firebase-tools deploy --only firestore:rules,storage --project guardentra-eu
   npx firebase-tools deploy --only firestore:rules,storage --project guardentra-us

4. Set App Hosting / server env:
   FIREBASE_PROJECT_ID_EU / _US
   FIREBASE_STORAGE_BUCKET_EU / _US

5. Prove: npm run test:e2e-gate

See docs/PHASE2_DUAL_FIREBASE.md
"@
