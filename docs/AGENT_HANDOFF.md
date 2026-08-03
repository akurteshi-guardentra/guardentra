# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-03T13:10:00Z
- **Agent:** Cursor
- **Branch / SHA:** `dev` worktree dirty → commit below; tip was `f4fee40` on `origin/*`
- **Doing now:** Housekeeping for deploy-rules + env plan; Windows has **no** `firebase login`.
- **Done this session:**
  - KI#6 closed + hardened; merged to `main` @ `f4fee40`
  - Windows verify earlier: lint, vitest 72/72, firestore-rules 19/19
  - Claude watcher stopped (tokens out; takeover complete)
  - **KI#12 parked** — hard vendor/seat caps via Admin SDK; revisit when paying customers or abuse risk appears
- **Blocked / next:**
  - See **Follow-ups** below (needs you on this machine)
- **Do not touch:**
  - `.env.local` / secrets (never commit)

## Follow-ups (user / next session)

1. **Firebase CLI on Windows** — run `npx firebase login` (browser), then:
   ```bash
   npx firebase deploy --only firestore:rules --project guardentra-7f582
   ```
   Ships KI#6 role/orgId freeze + KI#21/#22 invite/org-settings rules that are in git but **not live** yet.
2. **`.env.local` keys** (both worktrees; gitignored):
   - `VITE_FIREBASE_API_KEY` — Firebase Console → `guardentra-7f582` → Project settings → Your apps (Web) → API key
   - `GEMINI_API_KEY` — same project’s Gemini / AI key used for KI#20 live verify
3. **After deploy** — optional smoke: create/join invite path + confirm member cannot edit org name in the live project.
4. **KI#12** — still parked (hard caps). No work until product priority changes.

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next** / **Follow-ups**.
3. Cursor watcher (5m): optional; currently stopped.
