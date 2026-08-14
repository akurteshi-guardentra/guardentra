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

## Phase 2 audit spine (optional Postgres)

Default **off** so App Hosting boots without Cloud SQL. Local:

```bash
docker compose -f docker-compose.audit.yml up -d
# .env.local — see .env.example
AUDIT_SPINE_ENABLED=true
AUDIT_DATABASE_URL=postgres://audit_app:audit_app@localhost:5433/guardentra_audit
AUDIT_DATABASE_URL_MIGRATOR=postgres://audit_migrator:audit_migrator@localhost:5433/guardentra_audit
npm run migrate:audit
```

Details: [`docs/FASTTRACK_PHASE2.md`](./FASTTRACK_PHASE2.md). Prod later attaches Cloud SQL and sets the same env vars as App Hosting secrets.

Week 0 runbook + Terraform: [`docs/PHASE2_WEEK0_START_HERE.md`](./PHASE2_WEEK0_START_HERE.md), [`infra/`](../infra/).

## Dual Firebase residency (Phase 2 Week 1 — not live yet)

`organizations.dataRegion` (`eu`|`us`) and [`server/lib/regionRouter.ts`](../server/lib/regionRouter.ts) are ready. Live isolation still needs two Firebase projects, e.g.:

| Region | Suggested project | Storage bucket env |
|--------|-------------------|--------------------|
| US | `guardentra-us` (or staging/prod aliases) | `FIREBASE_PROJECT_ID_US`, `FIREBASE_STORAGE_BUCKET_US` |
| EU | `guardentra-eu` | `FIREBASE_PROJECT_ID_EU`, `FIREBASE_STORAGE_BUCKET_EU` |

Until both projects exist, keep a single demo/staging project and treat dual routing as prep-only.

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

### Verifying a live App Hosting rollout

Firebase CLI rollout commands need a fresh login. If you see
`Authentication Error: … firebase login --reauth`, restore CLI first:

```bash
npm run firebase:reauth
# or: npx firebase-tools login --reauth
npx firebase-tools projects:list
npx firebase-tools apphosting:rollouts:list --backend guardentra --project guardentra-7f582
```

**Do not wait on CLI to know if guardentra.com updated.** After every `main` push, run
the CDN string probe (no Firebase auth required):

```bash
npm run verify:live
# optional: node scripts/verify-live-deploy.mjs --base https://guardentra.com
```

What it checks:

1. Homepage HTML → hashed `/assets/index-*.js`
2. Entry → `AppAuthenticated-*.js` graph includes `PageShell`, `VendorsDirectory`, `Assessments`, `AddVendorDialog` chunks
3. Eager spine copy in `AppAuthenticated`: `FastTrack · Add vendor`, `FastTrack · Review & decide`, `Risk triage`, `Opening review`
4. Lazy `VendorPortal` graph contains P0-1 markers (`submittedSnapshot`, `correctionReopenedAt`, `portalOpen:!1`)

Exit `0` = live bundle looks current. Exit `1` = stale or incomplete vs markers — then open
Firebase Console → App Hosting → backend `guardentra` and compare rollout commit to
`origin/main`.

Human backup: hard-refresh `/vendors` and confirm the **FastTrack · Add vendor** eyebrow.

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
7. **Install and verify the "Trigger Email from Firestore" extension** (required for Invite Vendor / reminders to reach inboxes such as `akurteshi@guardentra.com`).

### Trigger Email (`firestore-send-email`) — ops checklist

App code path (already implemented):

1. **Invite Vendor** → `POST /api/notify/mail` (auth + rate limit) → Admin SDK writes `mail/{id}` with `{ to, message: { subject, text, html? }, createdAt }`.
2. Firestore rules deny all client access to `mail` — only the server route can queue.
3. The UI now **awaits** queue success for Invite Vendor and shows a banner: queued OK, or “Vendor saved; email could not be queued…”.

What code cannot do: deliver the message. That requires the extension + SMTP/SendGrid.

**Install (each Firebase project that sends mail, including live `guardentra-7f582`):**

1. Firebase Console → **Extensions** → search **Trigger Email from Firestore** (`firebase/firestore-send-email`).
2. Collection: `mail` (must match `server/routes/notify.ts`).
3. Configure SMTP **or** SendGrid. Prefer From: `support@guardentra.com` (or another address on a verified domain).
4. Deploy/enable the extension; wait until status is **Active**.

**Diagnose after Invite Vendor to `akurteshi@guardentra.com`:**

| Observation | Likely cause | Next step |
|---|---|---|
| UI banner: email could not be queued | `/api/notify/mail` auth/Admin/rate-limit failure | App Hosting logs for `[notify] failed to queue email` |
| UI banner: Welcome email queued, but inbox empty | Extension missing, misconfigured, or SMTP rejected | Console → Extensions; Firestore → `mail` docs for `delivery` / error fields |
| `mail` doc has `delivery.state: SUCCESS` | Delivered (check spam) | Confirm From domain / spam filters |
| `mail` doc has error / PENDING forever | SMTP credentials, From not allowed, or extension down | Fix SMTP / SendGrid; re-invite |

**Retest:** Vendors → Invite → contact `akurteshi@guardentra.com` → expect queue banner within seconds and inbox (or spam) within a few minutes once the extension is healthy.

CLI note: listing extensions needs a valid Firebase login (`npm run firebase:reauth` in a local interactive terminal). Agent shells cannot complete browser OAuth.
