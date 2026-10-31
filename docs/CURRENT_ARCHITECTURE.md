# GuardEntra as-built architecture (reconciled 2026-10-31)

This page records how four parts of GuardEntra actually work today. Where an
older document disagrees, this page wins for these four topics. It describes
the approved architecture as it is; it does not propose a redesign.

Evidence labels follow the operating agreement: **SOURCE** (read from code on
`release/rc-2026-10-08` at `caf27094`), **LIVE VERIFIED** (read back from the
running system), **OWNER REPORTED** (owner ran the check), **UNVERIFIED**.

Scope note: this is a documentation correction only. It changes no code,
rules, configuration, environment, or deployment.

## 1. Vendor portal access (no anonymous Auth in current builds)

**SOURCE.** The vendor portal does not use `signInAnonymously`. Every build
from `29171a6` onward (prod `29171a6`, legacy `7b914ee`, `main`, and the RC)
works like this:

1. `src/pages/VendorPortal.tsx` calls `POST /api/portal/session` with the
   assessment id from the link.
2. `server/routes/portal.ts` checks that the assessment exists and is open (or
   already submitted, for the receipt view), then mints a Firebase custom token
   for uid `portal_<assessmentId>` with claim `portalAssessmentId`. The route
   is unauthenticated by design (link possession is the trust model) and rate
   limited per IP.
3. The client signs in with `signInWithCustomToken` on a separate portal Auth
   instance.
4. `firestore.rules` and `storage.rules` compare `request.auth.token.portalAssessmentId`
   with the assessment id in the path, so one link reaches one assessment only.
   Submission goes through `POST /api/portal/submit`.

Requirement: the App Hosting service account needs
`roles/iam.serviceAccountTokenCreator`, or every portal link fails.

**Anonymous provider state per project:**

| Project | Anonymous Auth | Label |
|---|---|---|
| `guardentra-prod` | Disabled | LIVE VERIFIED 2026-08-27 (`PROJECT_STATE.md`) |
| `guardentra-staging` | Enabled at provisioning 2026-08-20; current state not re-read | UNVERIFIED |
| `guardentra-7f582` (legacy) | **Enabled**, with open email/password self sign-up | OWNER REPORTED 2026-10-31 |

No current build needs the Anonymous provider. On the legacy project it is a
live risk: anyone can obtain a signed-in token, and the legacy emergency rules
still allow some signed-in cross-tenant writes. Turning it off is an open owner
decision (tracked with #126); this page does not change it.

## 2. localStorage fallback

**SOURCE.** The browser keeps local copies under `guardentra.localVendors.v1`,
`guardentra.localAssessments.v1`, and `guardentra.localProfile.v1.<uid>`. Whether they
may stand in for Firestore depends on the Firebase project the build targets:

- `src/lib/vendor/localVendorStore.ts` `shouldUseLocalPersistenceFallback()`
  and `src/lib/AuthContext.tsx` `shouldUseLocalProfileFallback()` return
  **false** for `guardentra-staging` and `guardentra-prod`
  (`HOSTED_FIREBASE_PROJECT_IDS`). On those projects a cloud save or load
  failure shows an error and nothing is saved locally; no `local_org_*`
  profile is created.
- For every other project id (local dev, demo, and the legacy
  `guardentra-7f582`), the local fallback is still allowed.

Fail-closed behaviour arrived in `0db1417` (#62, 2026-09-19). It is in `main`,
the RC and legacy `7b914ee`, but **not** in prod `29171a6`, which still falls
back to localStorage on a Firestore timeout or error. Prod gets the fail-closed
behaviour only when an approved release is promoted.

## 3. Branch to environment mapping

The `dev` → sandbox, `test` → staging, `main` → production mapping in older
docs is the original plan and is **not** how App Hosting is wired today.

| Environment | Firebase project / backend | Builds from | Automatic rollouts | Live build | Label |
|---|---|---|---|---|---|
| Staging | `guardentra-staging` / `guardentra-staging` | `release/rc-2026-10-08` | On (an RC merge deploys staging) | last verified `a32f9f68` via `/api/health`; `caf27094` UNVERIFIED | LIVE VERIFIED / UNVERIFIED |
| Production | `guardentra-prod` / `guardentra-prod` (env name `prod`) | `main` | **Off** | `29171a6` (build 2026-08-27) | LIVE VERIFIED |
| Legacy | `guardentra-7f582` / `guardentra` (env name empty) | `main` | **Off** (`disabled=true`) | `7b914ee` (build-2026-10-06-001) | OWNER REPORTED 2026-10-31 |

- Production and legacy only change when the owner starts a rollout by hand.
  A merge to `main` does not deploy them.
- `guardentra.com` is served by `guardentra-prod`. The legacy backend still has
  a stale `guardentra.com` domain attachment (cleanup is a separate owner
  decision).
- The `test` branch and `deploy/staging` branch exist but are not the staging
  build source.
- `main` and the RC have diverged since 2026-10-26; changes reach `main` by
  separate PRs.
- Branch name alone is never deployment truth (see #126). Check the live
  rollout before claiming what an environment runs.

## 4. Email path

**Staging (LIVE VERIFIED, #72):**

```text
Invite / reminder
  -> POST /api/notify/mail (Firebase ID token, rate limit, server-resolved intent)
  -> Admin SDK writes mail/{id}   (client rules deny all)
  -> Firebase "Trigger Email from Firestore" extension
  -> Gmail SMTP, sending as admin@guardentra.com
  -> inbox
```

- SendGrid is the chosen future provider but is **deferred**: account setup
  needs business and tax identity, which waits until GuardEntra is
  incorporated. No SendGrid account, key, or secret is in use.
- The self-managed mail worker (`server/mailWorkerFunctions.ts`,
  `docs/SELF_MANAGED_EMAIL.md`) is merged but **not deployed**
  (`MAIL_WORKER_ENABLED` defaults to false). It supports the SendGrid API only,
  so the staging cutover from the extension to the worker is on hold.
- The Trigger Email extension shuts down on 2027-03-31; the cutover has to
  happen before then.

**Production:** no email consumer is attached. The prod build `29171a6` has an
older `/api/notify/mail` that accepts caller-chosen recipients and bodies, so
no consumer may be attached to prod until an approved release is promoted.
Prod email is planned, not active.

## Documents corrected alongside this page

- `docs/ENVIRONMENTS.md` (branch mapping, email provider)
- `docs/ARCHITECTURE_FOUNDATION.md` (portal auth, local fallback)
- `docs/STAGING_EMAIL_DELIVERY.md` (SMTP provider actually in use)
- `docs/SECRETS.md` (auth providers line)
- `VENDOR_TEST_CHARTER.md` (portal endpoint name)
