# Guardentra environments (local-first)

Do **not** share one Firebase project across demo, staging, and production. Firestore, Auth, and Storage are project-scoped.

## Stages

| Stage | App | Firebase project | When |
|-------|-----|------------------|------|
| **local / demo** | `npm run dev` (PORT `8080`) | `guardentra-7f582` (demo only) | Daily development |
| **dev** | Local or App Hosting `dev` | `guardentra-dev` (create when ready) | Shared sandbox |
| **staging** | Cloud Run / App Hosting `test` | `guardentra-staging` | QA / demos |
| **prod** | Cloud Run / App Hosting `main` → guardentra.com | `guardentra-prod` | Paying customers |

Branch mapping (see `.cursorrules`): `dev` → sandbox, `test` → staging, `main` → production.

## Firebase CLI aliases

[`.firebaserc`](../.firebaserc) defines aliases. Today only **demo** (`guardentra-7f582`) exists.

```bash
# After creating projects in Firebase Console:
firebase use demo      # current default
firebase use dev
firebase use staging
firebase use prod
```

Replace placeholder IDs in `.firebaserc` once projects exist (`guardentra-dev`, `guardentra-staging`, `guardentra-prod`).

## Client config

- Committed demo config: [`firebase-applet-config.json`](../firebase-applet-config.json) (demo project only).
- Preferred path: set `VITE_FIREBASE_*` in `.env.local` / App Hosting secrets; [`src/firebase.ts`](../src/firebase.ts) reads env first, then falls back to the JSON file.
- Never commit prod service-account JSON or prod API secrets.

## Server / Cloud Run

- Always bind `process.env.PORT || 8080` on `0.0.0.0`.
- Per-env secrets: `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Staging Stripe = test mode; prod Stripe = live mode.

## Before real customers

1. Create separate Firebase projects for staging and prod.
2. Deploy rules from this repo to each project (`firebase deploy --only firestore:rules,storage --project …`).
3. Remove personal email bypasses from production rules (`isAtIdhee` / similar).
4. Point App Hosting / Cloud Run `main` at `guardentra-prod` only.
