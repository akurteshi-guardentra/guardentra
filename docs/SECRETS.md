# Secrets & identity (Guardentra)

How we store credentials so agents and git never see Dashboard passwords or live API keys in chat or the repo.

## Immediate action (chat-exposed credentials)

If a Stripe Dashboard password (or any admin password) was pasted into Cursor chat:

1. **Rotate it now** in the Stripe Dashboard (Profile → Security / change password). You must do this yourself — agents cannot safely rotate Dashboard passwords without Dashboard login, which we will not do.
2. Enable **2FA** on the Stripe account if it is not already on.
3. Do **not** paste the old or new password into chat, tickets, `.env` files that might be shared, or docs.
4. Prefer disconnecting any agent session that saw the password and treating chat history as compromised for that secret.

## Never do this

- Paste Stripe Dashboard email/password into chat or agent prompts.
- Commit `.env`, `.env.local`, service-account JSON, or real `sk_` / `rk_` / `GEMINI_API_KEY` values.
- Hand agents full Stripe admin credentials. Use **restricted API keys** and Cursor’s Stripe MCP **OAuth** instead.

## Preferred secret stores

| Secret | Local | Hosted (App Hosting / Cloud Run) |
|--------|--------|-----------------------------------|
| `GEMINI_API_KEY` | `.env.local` (gitignored) or 1Password Developer Environments mount | App Hosting / Cloud Run secret env |
| `STRIPE_SECRET_KEY` | Same — prefer **restricted** key (`rk_…`), test mode for local/staging | Same; live keys only on prod |
| `STRIPE_WEBHOOK_SECRET` | Same | Per-endpoint webhook signing secret |
| Firebase client `VITE_FIREBASE_*` | `.env.local` (optional; demo JSON is fallback) | Build-time / hosting env — not service accounts in the browser |

### 1Password (recommended locally)

On macOS/Linux with the 1Password app + Developer Environments:

1. Keep real values only in a 1Password Environment (or vault item).
2. Mount a local `.env` / `.env.local` via 1Password so the filesystem path is a live mount, not a committed file.
3. Never commit the mount path contents; `.gitignore` must ignore `.env*` except `.env.example`.

If 1Password MCP is unavailable in Cursor, create/mount Environments from the 1Password app or CLI; the workflow is the same.

### App Hosting / Cloud Run

Inject `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` as platform secrets. Do not bake them into the image or Vite production client bundles (`GEMINI_API_KEY` must stay server-only in prod).

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
- Committed [`firebase-applet-config.json`](../firebase-applet-config.json) is **demo client config** only — not a substitute for prod secrets or service accounts.

## Checklist after any accidental exposure

- [ ] Rotate the exposed password / key in the provider console.
- [ ] Revoke any API keys that appeared in chat or a committed file.
- [ ] Confirm git status shows no `.env*` or credential JSON staged.
- [ ] Re-auth Stripe MCP via OAuth if needed (no password).
- [ ] Prefer a new restricted key with minimal permissions for local/dev agents.
