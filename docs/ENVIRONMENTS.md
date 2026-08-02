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

## Deploying the app (Firebase App Hosting)

[`apphosting.yaml`](../apphosting.yaml) is the deploy config. App Hosting runs
`npm run build` then `npm start`, which this repo already satisfies — verified locally:
health, the SPA index, and the `/portal/{id}` deep-link fallback all serve from
`dist/server.cjs`, and `APP_ENV=production` makes `/api/*` correctly return 401 without
a token.

**One backend per environment**, each pointed at its own Firebase project and branch
(`dev` → sandbox, `test` → staging, `main` → production):

```bash
firebase apphosting:backends:create --project guardentra-7f582
```

Then set the secrets that backend needs. These live in Google Secret Manager, never git:

```bash
firebase apphosting:secrets:set VITE_FIREBASE_API_KEY --project guardentra-7f582
firebase apphosting:secrets:set GEMINI_API_KEY        --project guardentra-7f582
firebase apphosting:secrets:set STRIPE_SECRET_KEY     --project guardentra-7f582
firebase apphosting:secrets:set STRIPE_WEBHOOK_SECRET --project guardentra-7f582
```

After that, pushing to the connected branch builds and deploys automatically.

### Two prerequisites that fail silently if missed

1. **Grant the backend's service account `roles/iam.serviceAccountTokenCreator`.**
   `server/routes/portal.ts` calls `createCustomToken()` to mint vendor-portal
   sessions, which requires signing a JWT. Without this role every portal link
   returns "Portal link invalid" — the app looks fine until a vendor opens one.

2. **Deploy the app *before* the rules.** `firestore.rules`/`storage.rules` now require
   the `portalAssessmentId` claim that only a build containing `9519bd3` mints. A
   scoped token still satisfies the *old* rules, so app-first is safe; rules-first
   breaks every in-flight vendor portal link at once. Once the app is live:

   ```bash
   firebase deploy --only firestore:rules,storage --project guardentra-7f582
   npm run smoke:portal -- --open <assessmentId> --other-open <assessmentId>
   ```

   The smoke run reports `[mode: scoped-token]` and gates the cross-assessment check
   only when the portal endpoint is reachable; otherwise it falls back to anonymous
   and says so, so a stale deploy can't produce a misleading pass.

`Dockerfile` is retained for local container testing and keeps Cloud Run available as
an alternative; it is not used by App Hosting.

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
