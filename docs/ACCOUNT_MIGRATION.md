# Migrating from `akurteshi@guardentra.com` to `admin@guardentra.com`

Work through this in order and tick the boxes. The phases are sequenced deliberately —
doing Phase 5 before Phase 2 is how people lock themselves out or break a live API key.

**The rule that prevents every disaster here: _add and verify the new account before
removing the old one._** Never remove `akurteshi@` from anything until `admin@` has been
confirmed working on it. If you remove the last Owner of a Google Cloud project, only
Google support can restore your access.

Nothing in this file is something Claude can do for you — it all needs your password and
2FA, and it changes account and billing settings. Claude can verify the result afterward.

## What you are actually migrating

| System | Current holder | Migrates how |
|--------|----------------|--------------|
| Google Cloud / Firebase project `guardentra-7f582` | `akurteshi@` | IAM grant — the project does **not** move or get recreated |
| Cloud Billing account | unknown — check in Phase 2 | Re-link the project to the enterprise billing account |
| Gemini API key | unknown project — find it in Phase 2 | Reissue under the correctly-billed project |
| Firebase CLI on this machine | `akurteshi@` (token expired) | `firebase logout` / `login` |
| GitHub repo `akurteshi-guardentra/guardentra` | `akurteshi-guardentra` | Separate system — repo transfer, optional |
| Git commit identity | `a1400098@unet.univie.ac.at` | `git config` — a third identity, unrelated to either |
| Stripe, domain, Workspace | separate accounts | Each has its own owner/admin transfer |

---

## Phase 1 — Google Cloud IAM (do this first, everything depends on it)

Firebase Console has no separate permission system; it reads Google Cloud IAM. Granting
here fixes both at once.

- [ ] Sign in to <https://console.cloud.google.com> as **`akurteshi@guardentra.com`** —
      the account that currently has access. `admin@` cannot grant itself access to a
      project it cannot see; "project doesn't exist" is simply how Google words
      "you have no permission on this".
- [ ] Select project **`guardentra-7f582`** in the picker.
- [ ] Confirm `akurteshi@` actually holds **Owner** (IAM & Admin → IAM). An *Editor*
      cannot modify IAM — if that is the case, find who holds Owner and have them do it.
- [ ] Note the **parent organization** at IAM & Admin → Settings. If it shows no org, the
      project sits outside `guardentra.com` and Workspace super-admin rights on `admin@`
      give you nothing over it. That also affects whether enterprise billing can attach.
- [ ] IAM & Admin → IAM → **+ Grant access** → principal `admin@guardentra.com` →
      role **Owner** → Save.
- [ ] Sign in as `admin@` and confirm the project is visible in both
      <https://console.cloud.google.com> and <https://console.firebase.google.com>,
      including Firestore data and Authentication users.

**Do not remove `akurteshi@` yet.** That is Phase 6.

---

## Phase 2 — Billing and the Gemini API key

These are one phase because they are almost certainly the same problem.

The app currently fails every AI call with `429 RESOURCE_EXHAUSTED — prepayment credits
are depleted`. A Gemini API key belongs to a Google Cloud project, and that project bills
to a specific billing account. If the key was created through AI Studio under a throwaway
project with no enterprise billing, it has its own small quota — exhausted exactly as
observed — while the enterprise credits sit unused on `admin@`.

- [ ] Find which project owns the key. In each project you can see:
      **APIs & Services → Credentials** → look for an API key matching the one in
      `.env.local`. Expect it to be in an auto-created project, often named something
      like *Generative Language Client* or *My First Project*.
- [ ] Check that project's billing: **Billing** → is a billing account linked, and is it
      the enterprise one?
- [ ] Check where the enterprise billing account lives — it may be owned by `admin@` and
      simply never linked to this project. Billing has **its own** IAM, separate from
      project IAM.
- [ ] Link project `guardentra-7f582` to the enterprise billing account.
- [ ] Create a **new** Gemini API key inside `guardentra-7f582` (APIs & Services →
      Credentials → Create credentials → API key), with the Generative Language API
      enabled on that project.
- [ ] Restrict the new key (API restrictions → Generative Language API only).
- [ ] Update the key in **all three stores** — they are independent, see
      [`SECRETS.md`](./SECRETS.md):
  - [ ] `.env.local` → `GEMINI_API_KEY=` (local only, gitignored)
  - [ ] GitHub repository secret → `gh secret set GEMINI_API_KEY`
  - [ ] Google Secret Manager → only once an App Hosting backend exists
- [ ] Delete the old key from whichever project held it.

Once this is done, Claude can finally verify the model fallback
(`docs/KNOWN_ISSUES.md` #20) — it has been blocked on this the whole time.

---

## Phase 3 — Firebase CLI on this machine

This also clears the expired-credential error that has been failing every deploy attempt.

```bash
./node_modules/.bin/firebase logout
./node_modules/.bin/firebase login          # sign in as admin@guardentra.com
./node_modules/.bin/firebase projects:list  # guardentra-7f582 must appear
```

- [ ] `projects:list` shows `guardentra-7f582` while logged in as `admin@`.

---

## Phase 4 — GitHub (separate system, nothing above touches it)

The repo is `akurteshi-guardentra/guardentra` and is currently **public**.

- [ ] Decide whether the repo should stay under the `akurteshi-guardentra` account. Given
      the key-rotation history in `SECRETS.md`, also confirm public is intentional.
- [ ] If moving it: Settings → *Transfer ownership*. Note that **repository secrets do not
      transfer** — `GEMINI_API_KEY` must be re-added afterward.
- [ ] Fix the commit identity, which is currently a university address unrelated to either
      account:

```bash
git config user.email admin@guardentra.com
git config user.name "Atdhe Kurteshi"
```

  (Add `--global` to apply outside this repo. Past commits keep the old address; that is
  normal and not worth rewriting history over.)

---

## Phase 5 — Everything else

- [ ] **Stripe** — separate account entirely. Transfer ownership or add `admin@` as an
      administrator. Keys in `.env.example` are still unset, so nothing is live yet.
- [ ] **Domain `guardentra.com`** — check the registrar account holder.
- [ ] **Google Workspace** — if `admin@` is the super-admin, confirm `akurteshi@` retains
      only what it should after this migration.
- [ ] **Firebase Extensions** — the Trigger Email extension from `ENVIRONMENTS.md` isn't
      installed yet; install it under the migrated project when you get to it.

---

## Phase 6 — Cleanup (only after everything above is verified)

- [ ] Re-verify `admin@` can do everything: read Firestore, see Auth users, deploy rules.
- [ ] **Then** remove or downgrade `akurteshi@` in IAM & Admin → IAM.
- [ ] Shut down the genuinely unused projects: IAM & Admin → **Settings → Shut down**.

Deletion is a **soft delete with a 30-day recovery window**, so a mistake is recoverable —
but only if you catch it in time, and the project is unusable meanwhile.

**Never shut down `guardentra-7f582`** — it holds all live data and is referenced in
[`.firebaserc`](../.firebaserc) and
[`firebase-applet-config.json`](../firebase-applet-config.json).

**Do not shut down the project holding the Gemini key** until Phase 2 has moved it.

---

## Final verification

- [ ] `firebase projects:list` as `admin@` shows the project
- [ ] Firebase Console as `admin@` shows Firestore data and Auth users
- [ ] `npm run dev` boots with `[BOOT] GEMINI_API_KEY set: true`
- [ ] `POST /api/ai/generate` returns 200, not 429 — this closes `KNOWN_ISSUES.md` #20
- [ ] `firebase deploy --only firestore:rules,storage` succeeds as `admin@`
- [ ] Only the intended projects remain in the console
