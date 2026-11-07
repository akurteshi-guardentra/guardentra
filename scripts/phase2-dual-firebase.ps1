# Dual Firebase bootstrap notes
# Creates nothing automatically - prints the exact commands after billing is ready.
# Usage: powershell -File scripts/phase2-dual-firebase.ps1

Write-Host @"
Dual Firebase (EU/US) - GATED historical planning helper

Named release environments now exist separately:
- staging: guardentra-staging
- production: guardentra-prod
- guardentra-7f582 is demo/legacy only and must not be treated as release authority.

The eu/us residency projects remain a separate Phase 2 capability and must be inventoried
before any creation/configuration work. This helper prints planning guidance only.

1. Under a separately scoped Owner packet, reconcile/create only the intended residency projects:
   - guardentra-eu
   - guardentra-us
   Do not infer current existence or IAM from this historical helper.
   Use the #116 read-only cloud inventory first.
   Aliases already exist in .firebaserc: eu / us.

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
