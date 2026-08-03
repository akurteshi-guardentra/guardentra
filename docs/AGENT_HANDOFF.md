# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-03T12:15:00Z
- **Agent:** Cursor
- **Branch / SHA:** `dev` (dig worktree, uncommitted KI#6 close + sync); tip before this chunk `903032d` / `origin/dev` @ `adf4b49`; `origin/main` @ `6c4bd99`
- **Doing now:** Took over after Claude token limit — verified Claude's invite fix on Windows; closing KI#6 as audited.
- **Done this session (Cursor / Windows):**
  - Synced `origin/main` into dig (`903032d`)
  - Verified on Windows: lint clean, vitest **72/72**, firestore-rules **19/19** (includes Claude's #21/#22 cases)
  - KI#6 audited and moved to Resolved (Firestore-live role model correct; custom claims deferred)
- **Done by Claude (landed before takeover):**
  - KI#5 complementary hook-level tests
  - Task #27: invite join batch fix (KI#21) + admin-only org settings (KI#22) — on `main` @ `6c4bd99`
- **Blocked / next:**
  - Fill `.env.local` (`GEMINI_API_KEY`, `VITE_FIREBASE_API_KEY`) — still empty on Windows
  - Only open known-issue left: **#12** (hard caps via Admin SDK) — parked architecture change
  - Push this dig tip (sync + KI#6 docs) then optionally merge to `main`
- **Do not touch:**
  - `.env.local` / secrets (never commit)

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
3. Cursor watcher (5m): fetch both worktrees, report SHAs / dirty state; if this file is missing or `Last-Updated` is older than **15 minutes**, flag *Claude may be stalled — ready to take over*.
