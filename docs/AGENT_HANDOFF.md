# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-03T12:18:00Z
- **Agent:** Cursor
- **Branch / SHA:** `dev` / `origin/dev` @ `04e2c64`; `origin/main` @ `6c4bd99` (dig ahead — merge to main pending)
- **Doing now:** Idle after takeover; KI#6 closed.
- **Done this session (Cursor / Windows):**
  - Took over after Claude tokens died (handoff was stale)
  - Synced main → dig; Windows verify: lint, vitest **72/72**, firestore-rules **19/19**
  - Closed KI#6: audit + harden (`sawCloudProfile` no re-bootstrap; freeze `role`/`organizationId` on user update)
- **Done by Claude (before takeover):**
  - KI#5 hook-level tests; task #27 → KI#21/#22 on `main` @ `6c4bd99`
- **Blocked / next:**
  - Fill `.env.local` (`GEMINI_API_KEY`, `VITE_FIREBASE_API_KEY`)
  - Merge `dev` → `main` for KI#6 (ask Cursor)
  - Only open known-issue: **#12** (hard caps) — parked
  - Deploy updated `firestore.rules` when ready (KI#6 immutability + prior #21/#22 rules)
- **Do not touch:**
  - `.env.local` / secrets (never commit)

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
3. Cursor watcher (5m): fetch both worktrees, report SHAs / dirty state; if this file is missing or `Last-Updated` is older than **15 minutes**, flag *Claude may be stalled — ready to take over*.
