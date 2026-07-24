# Secrets & identity (Guardentra)

How we store credentials so agents and git never see Dashboard passwords or live API keys in chat or the repo.

## Immediate action (chat-exposed credentials)

If a Stripe Dashboard password (or any admin password) was pasted into Cursor chat:

1. **Rotate it now** in the Stripe Dashboard (Profile → Security / change password). You must do this yourself — agents cannot safely rotate Dashboard passwords without Dashboard login, which we will not do.
2. Enable **2FA** on the Stripe account if it is not already on.
3. Do **not** paste the old or new password into chat, tickets, `.env` files that might be shared, or docs.
4. Prefer disconnecting any agent session that saw the password and treating chat history as compromised for that secret.

## GitHub secret scanning — Firebase Web API key

### What GitHub flagged

GitHub detected a Google/Firebase **Web API key** (`AIzaSy…`) in committed [`firebase-applet-config.json`](../firebase-applet-config.json). That pattern is what secret scanning matches.

### Accurate risk model (do not over- or under-react)

| Fact | Implication |
|------|-------------|
| Firebase **client** config (including the Web API key) is designed to ship in browsers / mobile apps | This is **not** the same class of secret as a service-account JSON, `GEMINI_API_KEY`, or Stripe `sk_` / `rk_` |
| The key alone must **not** be the sole security control | **Firestore / Storage security rules** and **Firebase Auth** decide who can read/write data |
| An **unrestricted** Web API key can still be abused | Callers can burn quota / hit enabled Google APIs from other origins if referrer + API restrictions are missing |
| Project IDs, `authDomain`, `appId`, `messagingSenderId`, OAuth **client** IDs | Public identifiers, not “passwords”; still do not put **prod** service accounts in git |

**Bottom line:** Treat the alert seriously enough to **restrict + rotate** and stop committing live keys; do not treat rotating the Web API key as a substitute for locking down rules and Auth.

### In-repo remediation (done)

- Live `apiKey` removed from [`firebase-applet-config.json`](../firebase-applet-config.json) (empty placeholder). Non-secret demo project identifiers remain for local defaults.
- Client requires `VITE_FIREBASE_API_KEY` in `.env.local` (gitignored) — see [`.env.example`](../.env.example) and [`src/firebase.ts`](../src/firebase.ts).
- We **do not rewrite git history** unless you explicitly ask. History still contains the old key → **Console rotation/restriction is mandatory** (see checklist below). Closing the GitHub alert after rotate + current-tree fix is the normal path; history purge is optional and disruptive.

### App Check (recommended)

Enable [Firebase App Check](https://firebase.google.com/docs/app-check) (e.g. reCAPTCHA Enterprise / v3 for web) so backend Firebase products accept requests only from your attested app. Pair with tight security rules — App Check complements rules; it does not replace them.

### You must do this in Google Cloud / Firebase Console

Agents cannot revoke GCP keys without your Console access. Complete **[Firebase Web API key — rotate & restrict](#firebase-web-api-key--rotate--restrict)** below, then mark the GitHub alert resolved / dismissed with a note that the key was rotated and removed from `HEAD`.

## Never do this

- Paste Stripe Dashboard email/password into chat or agent prompts.
- Commit `.env`, `.env.local`, service-account JSON, or real `sk_` / `rk_` / `GEMINI_API_KEY` / live `AIzaSy…` Web API keys.
- Hand agents full Stripe admin credentials. Use **restricted API keys** and Cursor’s Stripe MCP **OAuth** instead.

## Preferred secret stores

| Secret | Local | Hosted (App Hosting / Cloud Run) |
|--------|--------|-----------------------------------|
| `GEMINI_API_KEY` | `.env.local` (gitignored) or 1Password Developer Environments mount | App Hosting / Cloud Run secret env |
| `STRIPE_SECRET_KEY` | Same — prefer **restricted** key (`rk_…`), test mode for local/staging | Same; live keys only on prod |
| `STRIPE_WEBHOOK_SECRET` | Same | Per-endpoint webhook signing secret |
| Firebase client `VITE_FIREBASE_*` | **Required locally:** `.env.local` (or 1Password mount). Demo JSON has project IDs only — **no** committed Web API key | Build-time / hosting env (`VITE_FIREBASE_API_KEY` etc.) — never service accounts in the browser |

### 1Password (recommended locally)

On macOS/Linux with the 1Password app + Developer Environments:

1. Keep real values only in a 1Password Environment (or vault item).
2. Mount a local `.env` / `.env.local` via 1Password so the filesystem path is a live mount, not a committed file.
3. Never commit the mount path contents; `.gitignore` must ignore `.env*` except `.env.example`.

If 1Password MCP is unavailable in Cursor, create/mount Environments from the 1Password app or CLI; the workflow is the same.

### App Hosting / Cloud Run

Inject `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and build-time `VITE_FIREBASE_*` as platform secrets/env. Do not bake server secrets into the image or Vite production client bundles (`GEMINI_API_KEY` must stay server-only in prod).

## Stripe access model

| Method | Use for | Avoid |
|--------|---------|--------|
| **Restricted API keys** (`rk_`) | App server, CI, agents with least privilege | Long-lived unrestricted `sk_live_` in repos or chat |
| **Cursor Stripe MCP OAuth** | Dashboard-linked tooling inside Cursor | Email/password “login” for MCP |
| **Webhook signing secret** | Verifying `stripe` events on the server | Sharing the secret in client code |
| **Dashboard password** | Human operators only, with 2FA | Agents, MCP, CI, docs, chat |

Stripe MCP status `needsAuth` means complete Cursor’s OAuth / plugin connect flow — **not** Dashboard password login.

Staging = Stripe **test** mode; production (`guardentra-prod` / `main`) = **live** mode only.

## App identity (users)

- **Customer and staff app identity:** Firebase Authentication (email/password, Google; anonymous only for Vendor Portal evidence). See `docs/ARCHITECTURE_FOUNDATION.md` § Auth.
- **Server routes:** verify Firebase ID tokens (`Authorization: Bearer …`); do not invent a parallel password store for API access.
- **Enterprise later:** SAML/OIDC (Firebase Identity Platform / SSO) — not a substitute for API key vaulting.
- **Billing identity:** Stripe Customer IDs on user/org docs; never store card PANs or Dashboard passwords in Firestore.

## Repo conventions

- Templates only: [`.env.example`](../.env.example) (empty placeholders).
- Copy to **`.env.local`** (gitignored) or use a 1Password mount.
- Ignore: `.env`, `.env.local`, `*.pem`, `*credentials*.json`, `*serviceAccount*.json` (see [`.gitignore`](../.gitignore)).
- Committed [`firebase-applet-config.json`](../firebase-applet-config.json) is **demo project identifiers only** (no live Web API key). Not a substitute for prod secrets or service accounts.

## Firebase Web API key — rotate & restrict

Complete in **Google Cloud Console** / **Firebase Console** for project `guardentra-7f582` (and any other project that used the exposed key):

1. **Identify the key**  
   Firebase Console → Project settings → Your apps → Web app → note the current Web API key, **or**  
   Google Cloud Console → APIs & Services → Credentials → API keys → find the Browser key used by the Firebase web app.

2. **Restrict the key (do this even if you keep using the same key string temporarily)**  
   - **Application restrictions:** HTTP referrers — allow only your real origins, e.g. `http://localhost:*`, `http://127.0.0.1:*`, staging/prod App Hosting / custom domains (`https://guardentra.com/*`, etc.).  
   - **API restrictions:** restrict to APIs the client actually needs (typically Identity Toolkit, Token Service, Firestore, Storage, and any others your web SDK calls — not “Don’t restrict”).

3. **Rotate (recommended after git exposure)**  
   - Create a **new** browser API key (or regenerate if the Console offers it for that credential).  
   - Put the **new** value only in `.env.local` / App Hosting secrets as `VITE_FIREBASE_API_KEY` — never commit it.  
   - Update every deployed environment that embeds the old key.  
   - **Delete / disable** the old unrestricted key once clients are updated.

4. **Verify Auth & rules**  
   - Auth → Authorized domains includes only intended hosts.  
   - Firestore / Storage rules deny unauthenticated access except intentional portal paths.  
   - Prefer enabling **App Check** (see above).

5. **GitHub**  
   - Confirm `HEAD` on `dev`/`main` has no `AIzaSy…` in the tree (`rg 'AIzaSy' .`).  
   - In the secret scanning alert: mark as remediated after rotation (do **not** force-push history rewrite unless you explicitly choose that path).

6. **Optional history purge**  
   Only if compliance requires removing the blob from all commits: coordinate a history rewrite + force-push with the team. Default: **rotate and leave history**.

## Checklist after any accidental exposure

- [ ] Rotate the exposed password / key in the provider console.
- [ ] Revoke any API keys that appeared in chat or a committed file.
- [ ] Restrict replacement Firebase Web API keys (HTTP referrer + API allowlist).
- [ ] Confirm git status shows no `.env*` or credential JSON staged; no live `AIzaSy…` in tracked files.
- [ ] Re-auth Stripe MCP via OAuth if needed (no password).
- [ ] Prefer a new restricted key with minimal permissions for local/dev agents.
