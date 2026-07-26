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

- Committed demo config: [`firebase-applet-config.json`](../firebase-applet-config.json) — **demo project identifiers only** (`projectId`, `authDomain`, `appId`, …). The Web **`apiKey` is not committed** (empty in git); GitHub secret scanning flags `AIzaSy…` keys.
- **Required:** set at least `VITE_FIREBASE_API_KEY` in `.env.local` / App Hosting build env (copy from [`.env.example`](../.env.example)). [`src/firebase.ts`](../src/firebase.ts) reads `VITE_FIREBASE_*` first, then fills other fields from the JSON; it fails loud if the API key is missing.
- Get the key from Firebase Console → Project settings → Your apps. Restrict it in Google Cloud (HTTP referrers + API allowlist). See **[`docs/SECRETS.md`](./SECRETS.md)** (GitHub alert + rotate checklist).
- Never commit prod service-account JSON, live Web API keys, or server API secrets.

## Server / Cloud Run

- Always bind `process.env.PORT || 8080` on `0.0.0.0`.
- Per-env secrets: `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Staging Stripe = test mode; prod Stripe = live mode.

## Secrets & identity

See **[`docs/SECRETS.md`](./SECRETS.md)** for the full policy:

- Never paste Stripe Dashboard passwords into chat; **rotate** any password that was exposed.
- Store API secrets in **1Password** (local mounts) or App Hosting / Cloud Run secret env — not in git.
- Stripe: restricted API keys + Cursor Stripe MCP **OAuth** (not admin password).
- App users: Firebase Auth; enterprise SSO later.

## Before real customers

1. Create separate Firebase projects for staging and prod.
2. **Create Firestore `(default)`** in each project (Console → Firestore → Create database). Local stores are backup only.
3. Deploy rules from this repo to each project (`firebase deploy --only firestore:rules,storage --project …`).
4. Confirm production rules have **no** personal email bypass (`isAtIdhee` removed).
5. Point App Hosting / Cloud Run `main` at `guardentra-prod` only.
6. Keep `GEMINI_API_KEY` server-only (not in client production bundles).
7. **Install the "Trigger Email from Firestore" extension** (Console → Extensions → search "firestore-send-email") in each project, configured with a real SMTP or SendGrid provider. `server/routes/notify.ts` (`POST /api/notify/mail`) already writes correctly-shaped docs to the `mail` collection — without this extension installed, those writes succeed but no email is ever actually sent. This is the one piece of Sprint 6 (notifications) that can't be done from code.
