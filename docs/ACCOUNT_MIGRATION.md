# Decommissioning `akurteshi@guardentra.com` in favour of `admin@guardentra.com`

Goal: `admin@` owns and accesses everything, and nothing depends on `akurteshi@` any more.

**Target end state (decided):** every sign-in — Firebase Console, Google Cloud Console,
the Firebase CLI, the app itself — happens as `admin@`. The single permitted exception is
**git commit authorship**, which may keep showing `akurteshi@`.

That exception is safe, and the reason matters: a git author email is **metadata written
into the commit, not a credential**. It grants no access to anything and is never checked
by GitHub, Google or Firebase. Anyone can set any value with `git config`. So leaving it
alone — or continuing to commit as `akurteshi@` — has no security consequence at all.

Do not confuse it with the **GitHub account used to push**, which is real access and is
covered in Phase 4.

Work through this in order and tick the boxes. The phases are sequenced deliberately —
running the decommission before the billing and app-data phases is how people lock
themselves out, break a live API key, or orphan their own test data.

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
| **The app's own user + organization** | `akurteshi@` as a Guardentra user | Invite `admin@` into the existing org, or start fresh — see Phase 5 |

---

## First, one decision that changes everything below

**Are you keeping project `guardentra-7f582` and changing who owns it, or creating a brand
new project under `admin@`?**

**Keep the project (strongly recommended).** Ownership is just IAM — the project, its
Firestore data, Auth users, Storage objects and project ID all stay exactly as they are.
Almost nothing in this repo changes. This is what the rest of this document assumes.

**Create a new project.** Everything below still applies, *plus* you would have to
regenerate every identifier in `firebase-applet-config.json`, issue a new Web API key, and
migrate all Firestore and Storage data across projects by hand — there is no built-in
"move project data" operation. Auth users cannot be exported with their passwords intact
without the Identity Toolkit export/import dance, and every existing vendor portal link
would break. Only do this if you have a hard requirement that the project ID itself change.

---

## Repository inventory — what in this repo is actually affected

Audited across all source, config, tests and docs.

### Needs updating

| File | What | When |
|------|------|------|
| `.env.local` *(gitignored, local only)* | `GEMINI_API_KEY` — the new key from Phase 2 | Always |
| GitHub repository secret | `GEMINI_API_KEY` via `gh secret set` | Always |
| Google Secret Manager | all four secrets | Once an App Hosting backend exists |
| [`.firebaserc`](../.firebaserc) | `dev`/`staging`/`prod` are placeholders for projects that do not exist yet | Only when you create those projects |
| [`firebase-applet-config.json`](../firebase-applet-config.json) | `projectId`, `appId`, `authDomain`, `storageBucket`, `messagingSenderId`, `oAuthClientId` — all bound to project `967769575761` | **Only if you create a new project.** Unchanged if you keep `guardentra-7f582` |
| `.env.local` → `VITE_FIREBASE_API_KEY` | project-specific Web API key | **Only if you create a new project** |

### Needs no change at all

- **All application source** — `src/**`, `server/**`. Nothing hardcodes an account or
  project; everything reads from `firebase-applet-config.json` and environment variables.
  Verified by search: no `akurteshi`, no `atdhee`, no personal email anywhere in code. The
  old `isAtIdhee` rules bypass and the hardcoded admin-bypass button were both removed
  earlier (`KNOWN_ISSUES.md` #9).
- **`firestore.rules` / `storage.rules`** — no account references; they key off
  `request.auth.uid` and org membership.
- **`src/tests/storage.rules.test.mjs`** — runs against its own throwaway emulator project
  `demo-guardentra-storage-rules`. Completely independent of your real project and
  unaffected by any of this.
- **`src/tests/portal.smoke.mjs`** — reads the project from `firebase-applet-config.json`
  and takes assessment IDs as arguments, so it follows whatever you configure. You will
  need *new* assessment IDs after Phase 5 if you start a fresh org.
- **`vitest` / `jest` suites** — fully mocked, never touch a real project.
- **`apphosting.yaml`** — references secret *names*, never values.
- **`Dockerfile`, `.github/workflows/ci.yml`** — no account or project references.

**In short: if you keep the project, the only repo-side change is the Gemini API key.**
Everything else is console work.

---

## Phase 1 — Google Cloud IAM (do this first, everything depends on it)

Firebase Console has no separate permission system; it reads Google Cloud IAM. Granting
here fixes both at once.

> **Trap — two different "Users" screens in Firebase Console.**
>
> | Screen | What it is |
> |--------|------------|
> | **Authentication → Users** | your *application's* end users — the vendors and org members who sign into Guardentra. Adding an account here grants **no** administrative access to anything. |
> | **⚙️ Project settings → Users and permissions** | project members. This one **is** Google Cloud IAM, and is what grants ownership. |
>
> Adding `admin@` under Authentication does nothing for ownership. It is a useful step,
> but it belongs to Phase 5, not this one.

**Firestore, Storage and "the backend" cannot be owned separately.** They live inside the
project, there is no per-service ownership, and nothing needs migrating individually. One
project-level Owner grant covers Firestore, Storage, Authentication and every service you
add later.

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
- [ ] **Commit identity — deliberately exempt.** It is currently
      `a1400098@unet.univie.ac.at`, a university address belonging to neither account.
      Per the target end state above, commit authorship may stay as-is or use
      `akurteshi@`; a commit author is metadata, not a credential, and grants nothing.
      Change it only if you want the history to read consistently:

```bash
git config user.email admin@guardentra.com
git config user.name "Atdhe Kurteshi"
```

  (Add `--global` to apply outside this repo. Past commits keep the old address either
  way — rewriting history is not worth it for a cosmetic field.)

---

## Phase 5 — The app's own user records (easy to miss, expensive to get wrong)

Everything above is infrastructure. This phase is **application data**, and it is the one
that quietly breaks things if you skip it.

`akurteshi@guardentra.com` has almost certainly signed into Guardentra itself during
development. If so, Firebase Auth holds a user for it, and Firestore holds a
`users/{uid}` document plus an `organizations/{orgId}` that this account created and is
`admin` of. **Every vendor, assessment and piece of evidence created during testing hangs
off that organization** — including the assessments used for the portal smoke tests.

Deleting or disabling that Auth user without acting first orphans the whole org: the data
survives in Firestore but no one can reach it, because access is granted by
`users/{uid}.organizationId` matching the document's `organizationId`.

Decide which you want:

**Option A — keep the org, move `admin@` into it (recommended if the test data matters).**
Use the teammate invite flow already in the product:

- [ ] Sign into the app as `akurteshi@`, go to **Settings → Team**, invite
      `admin@guardentra.com` with the **admin** role.
- [ ] Sign in as `admin@` and accept. `bootstrapUserProfile` in
      [`src/lib/orgBootstrap.ts`](../src/lib/orgBootstrap.ts) puts the new user into the
      *existing* org rather than creating a fresh one.
- [ ] Confirm `admin@` sees the same vendors and assessments.
- [ ] Only then delete the `akurteshi@` user in Firebase Console → Authentication.

**Option B — start clean (fine if the test data is disposable).**

- [ ] Sign in as `admin@`, let it create its own org through onboarding.
- [ ] Delete the `akurteshi@` Auth user and, if you want the storage back, its
      `organizations/{orgId}` document and the vendors/assessments referencing it.
- [ ] Accept that the existing test assessments become unreachable.

Either way:

- [ ] Firebase Console → Authentication → Users: confirm `akurteshi@` is gone at the end.
- [ ] Check Firestore `users` for a stale document with that email.

---

## Phase 6 — Everything else

- [ ] **Stripe** — separate account entirely. Transfer ownership or add `admin@` as an
      administrator. Keys in `.env.example` are still unset, so nothing is live yet.
- [ ] **Domain `guardentra.com`** — check the registrar account holder.
- [ ] **Google Workspace** — if `admin@` is the super-admin, confirm `akurteshi@` retains
      only what it should after this migration.
- [ ] **Firebase Extensions** — the Trigger Email extension from `ENVIRONMENTS.md` isn't
      installed yet; install it under the migrated project when you get to it.

---

## Phase 7 — Decommission `akurteshi@` (only after everything above is verified)

Goal is that nothing depends on `akurteshi@` any more. Work through it as a sweep, because
the account can be referenced in places that never show up in a single console screen.

- [ ] Re-verify `admin@` can do everything: read Firestore, see Auth users, deploy rules,
      run a build. If any of these fail, stop — do not remove anything yet.
- [ ] **Google Cloud IAM** → remove `akurteshi@` from IAM & Admin → IAM. Do this step
      *signed in as `admin@`*, not as `akurteshi@`: if `admin@` can edit IAM, that proves
      it genuinely holds Owner. If it cannot, the grant did not work — and you have
      learned that while `akurteshi@` still has access to fix it.
- [ ] **Billing** → remove it from the billing account's IAM (separate list).
- [ ] **Organization-level IAM** → if `guardentra.com` is a Cloud organization, switch the
      resource picker at the top of the IAM page from the project to the **organization**
      and check there too. An org-level role **inherits into every project**, so the
      project stays visible to `akurteshi@` no matter how often you remove the
      project-level binding.
- [ ] Verify in an **incognito window or separate browser profile** — Google caches
      signed-in sessions, and a stale tab will keep showing a project you no longer have
      access to. Signed in as `akurteshi@`, the project should be absent from the picker.
- [ ] **Firebase Auth** → confirm the app user is gone (Phase 5).
- [ ] **Service accounts** → IAM & Admin → Service Accounts. Any created by `akurteshi@`
      keep working after the human account goes, but check for keys you no longer want.

> ### ⛔ Do not delete service accounts
>
> The IAM list mixes people and machines. **Delete only principals that are a person's
> email address.** Anything ending in `.gserviceaccount.com` is infrastructure owned by
> the project, not by `akurteshi@`, and it keeps working unchanged once `admin@` is Owner
> — service accounts were never held by a person, so they do not change hands.
>
> | Principal | Deleting it breaks |
> |-----------|--------------------|
> | `firebase-adminsdk-…@guardentra-7f582.iam.gserviceaccount.com` | `createCustomToken()` in `server/routes/portal.ts` — **every vendor portal link stops working** |
> | `<project-number>-compute@developer.gserviceaccount.com` | App Hosting / Cloud Run run the backend *as* this identity — the app cannot start |
> | `firebase-hosting@…`, `service-<n>@gcp-sa-*.iam.gserviceaccount.com` | Google-managed service agents. Mostly undeletable; the rest auto-recreate, usually after something has already failed |
>
> In this migration exactly **one** row gets removed: `akurteshi@guardentra.com` — from
> project IAM, and again from the billing account's separate IAM list.
- [ ] **API keys** → APIs & Services → Credentials. The old Gemini key should already be
      deleted from Phase 2.
- [ ] **OAuth consent screen** → APIs & Services → OAuth consent screen. The support and
      developer contact emails often still say `akurteshi@`. Note
      [`firebase-applet-config.json`](../firebase-applet-config.json) carries an
      `oAuthClientId` — the client itself is fine, only the contact metadata needs changing.
- [ ] **GitHub** → if the repo stays on `akurteshi-guardentra`, you have *not* finished
      decommissioning. Transferring is the only way to fully detach; remember repository
      secrets do not transfer and `GEMINI_API_KEY` must be re-added.
- [ ] **Git identity** → Phase 4. Past commits keep the old author; that is normal and not
      worth rewriting history for.
- [ ] Shut down the genuinely unused projects: IAM & Admin → **Settings → Shut down**.

### What cannot be moved, and does not matter

- The project **creator** is immutable metadata. `guardentra-7f582` will always record
  that `akurteshi@` created it. This grants no access once IAM is removed.
- Commit authorship in existing git history.

Neither is a security issue — they are records, not permissions.

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
- [ ] Signing into the app as `admin@` shows the vendors and assessments you expect
- [ ] `akurteshi@` appears in **no** IAM list, **no** billing IAM list, and **not** in
      Firebase Authentication
- [ ] Nothing still works only because you are signed in as `akurteshi@` somewhere —
      sign out of it everywhere and confirm the app, console and CLI all still function
