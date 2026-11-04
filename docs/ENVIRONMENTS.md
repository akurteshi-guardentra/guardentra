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

`guardentra-staging` and `guardentra-prod` are established named release environments. `guardentra-7f582` remains the local/demo/legacy project alias only. Do not use the default/demo alias as a staging or production deployment target. Issue #126 tracks the separate external App Hosting GitHub connection that is still auto-rolling protected-main commits to the legacy backend.`

## Client config

**Hard rule:** every deployed client Firebase configuration must be coherent and belong to exactly one Firebase project. Staging/production Vite builds must **not** fall back field-by-field to demo JSON.

| Environment | Firebase project | Client config source |
|-------------|------------------|----------------------|
| **local / demo** | `guardentra-7f582` | `VITE_FIREBASE_API_KEY` + committed [`firebase-applet-config.json`](../firebase-applet-config.json) identifiers (dev only) |
| **staging** | `guardentra-staging` | Complete `VITE_FIREBASE_*` from `apphosting.staging.yaml` (+ API key secret) |
| **production** | `guardentra-prod` | Complete `VITE_FIREBASE_*` from `apphosting.prod.yaml` / `apphosting.production.yaml` (+ API key secret) |

- Committed demo config: [`firebase-applet-config.json`](../firebase-applet-config.json) — **demo project identifiers only**. The Web **`apiKey` is not committed** (empty in git).
- Resolver: [`src/lib/firebaseClientConfig.ts`](../src/lib/firebaseClientConfig.ts) (used by [`src/firebase.ts`](../src/firebase.ts) and portal auth).
  - **Production Vite builds:** require the full set — `VITE_FIREBASE_API_KEY`, `PROJECT_ID`, `AUTH_DOMAIN`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`. Fail closed when any are missing. No demo merge. Rejects resolving to `guardentra-7f582` in production builds.
  - **Local/dev:** demo identifiers remain available when no project identifiers are set. Partial env overrides are rejected (would mix environments).
- **App Hosting:** [`apphosting.yaml`](../apphosting.yaml) holds safe common defaults only (including the API key secret name). Environment-specific identifier files are mandatory:
  - `apphosting.staging.yaml` — backend Environment name must be `staging`
  - `apphosting.prod.yaml` — current live backend Environment name is `prod`
  - `apphosting.production.yaml` — preferred if Environment is renamed to `production`
- Staging and production Firebase identifiers must **never** cross environments.
- Get keys from Firebase Console → Project settings → Your apps. Restrict in Google Cloud (HTTP referrers + API allowlist). See **[`docs/SECRETS.md`](./SECRETS.md)**.
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

[`apphosting.yaml`](../apphosting.yaml) is the shared deploy config. App Hosting runs
`npm run build` then `npm start`. Environment-specific identifiers must come from
the matching named backend environment:

- staging: project `guardentra-staging`, environment `staging`, overrides in `apphosting.staging.yaml`
- production: project `guardentra-prod`, environment `prod` (or `production` after an explicit Owner rename), overrides in `apphosting.prod.yaml` / `apphosting.production.yaml`
- demo/legacy: `guardentra-7f582` is **not** an approved staging or production release target.

### P0 release-integrity quarantine — Issue #126

Protected-main pushes have been observed triggering automatic App Hosting rollouts on the
legacy backend `guardentra-7f582/us-central1/guardentra`. That external Firebase GitHub
connection is under P0 investigation in Issue #126.

Until #126 is live-reconciled:

1. **Do not create, configure, deploy, grant secrets to, or deploy rules to a release backend by copying a `guardentra-7f582` example.**
2. Treat any `guardentra-7f582` rollout check as legacy/demo evidence only — never as staging or production verification.
3. Use explicit `--project guardentra-staging` or `--project guardentra-prod` only inside the separately approved environment-specific release packet.
4. Before any App Hosting mutation, read back the target backend's project, source branch, environment name, current revision/source SHA, domain/traffic role, and rollback baseline.
5. Production promotion must use the approved production release path and exact current-source evidence; a GitHub/App Hosting check alone is not `PRODUCTION_LIVE_VERIFIED`.

The legacy backend must not be deleted or detached blindly: #126 first requires read-only
inventory of its current branch connection, domain/traffic role, and rollback dependency.

### Verifying a live named-environment rollout

Bind every verification record to the explicit Firebase project and expected source SHA.
For staging or production, use the corresponding approved release/evidence packet and
record the backend/build/revision/source SHA from that named project. Never infer the
environment from the Git branch or from a successful rollout check name alone.

After a production promotion, the public health/readback and the full release evidence
contract in `docs/release/GO_LIVE_E2E.md` are required. A CDN/content probe may supplement
that evidence but cannot substitute for exact production backend/source readback.

### Portal signing/rules ordering

The portal custom-token path requires the selected environment backend service account to
have the approved signing capability. IAM changes are privileged and must be separately
scoped, least-privilege, preflighted and read back; this document does not grant that
authority.

When a release includes both portal-token behavior and Firestore/Storage rules, preserve
the proven app-first ordering described by the scoped release packet so rules never require
claims the deployed app cannot yet mint. Rules deployment must always name the intended
staging or production project explicitly; never rely on the Firebase default alias.

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

1. **Invite Vendor** → `POST /api/notify/mail` (auth + rate limit) → Admin SDK writes `mail/{id}` via `server/lib/mailQueue.ts` (`to`, `message.{subject,text,html?}`, `createdAt`, `source`).
2. Firestore rules deny all client access to `mail` — only the server route can queue.
3. The UI **awaits** queue success for Invite Vendor and shows a banner: queued OK, or “Vendor saved; email could not be queued…”. Queue success is not delivery success.
4. **Delivery** (`delivery.*`) is written by the extension — not by App Hosting. **SUCCESS = provider/SMTP accepted the message. Inbox receipt must be confirmed separately.**

What code cannot do: deliver the message. That requires the extension + SMTP/SendGrid.

**Staging (Issue #72) — SendGrid path:** follow the full no-code install, secret-name list, acceptance, and failure procedure in [`docs/STAGING_EMAIL_DELIVERY.md`](./STAGING_EMAIL_DELIVERY.md). Do **not** configure production until separately Owner-authorized.

**Install (each Firebase project that sends mail; staging first):**

1. Firebase Console → **Extensions** → search **Trigger Email from Firestore** (`firebase/firestore-send-email`).
2. Collection: `mail` (must match `MAIL_COLLECTION` in `server/lib/mailQueue.ts`).
3. Configure **SendGrid SMTP** (staging target) or another SMTP. Prefer From: `support@guardentra.com` on a verified domain.
4. Deploy/enable the extension; wait until status is **Active**. Record the installed extension version before relying on status/retry fields.
5. Keep SMTP password / API key in extension config (or Secret Manager name `SENDGRID_API_KEY` if Owner stores it there). Never commit values.

**Diagnose after Invite Vendor to `akurteshi@guardentra.com`:**

| Observation | Likely cause | Next step |
|---|---|---|
| UI banner: email could not be queued | `/api/notify/mail` auth/Admin/rate-limit failure | App Hosting logs for `[notify] failed to queue email` |
| UI banner: Welcome email queued, but inbox empty | Extension missing, misconfigured, or SMTP rejected | Console → Extensions; Firestore → `mail` docs for `delivery` / error fields; confirm inbox separately |
| `mail` doc has `delivery.state: SUCCESS` | Provider/SMTP accepted the message (not proof of inbox) | Confirm From domain / spam / inbox receipt |
| `mail` doc has `delivery.state: ERROR` | Provider rejection / bad SMTP | Read `delivery.error`; fix SendGrid; follow installed extension version for any re-send |
| `mail` doc stuck without SUCCESS/ERROR | Extension down, not installed, or version-specific behavior | Fix extension; re-invite; verify against installed version docs |

**Retest:** Vendors → Invite → contact `akurteshi@guardentra.com` → expect queue banner within seconds, then `delivery.state: SUCCESS` (SMTP accepted), then separately confirm inbox (or spam) once the extension is healthy.

CLI note: listing extensions needs a valid Firebase login (`npm run firebase:reauth` in a local interactive terminal). Agent shells cannot complete browser OAuth.
