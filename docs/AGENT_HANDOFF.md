# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-03T12:04:00Z
- **Agent:** Cursor
- **Branch / SHA:** `dev` @ `29fba0f` (dig worktree); `main` @ `46464df` (`origin/main`)
- **Doing now:** Armed Claude-parallel watcher (this file + 5m Cursor loop).
- **Done this session (Cursor / Windows):**
  - Windows closeout: JDK 21, emulator JARs, firestore-rules 12/12, storage-rules 14/14
  - `cross-env` for `npm test` shipped to `main`
  - KI#5 promote/retry unit coverage; complementary hook-level tests also landed from the parallel session
  - Added `docs/AGENT_HANDOFF.md` + watcher loop
  - Open known-issues remaining: **#6**, **#12**
- **Blocked / next:**
  - Fill `.env.local` on each machine (`GEMINI_API_KEY`, `VITE_FIREBASE_API_KEY`) — scaffold exists, keys empty on Windows
  - Next product work when ready: KI#6 (token/role audit) or KI#12 (hard caps) — both parked by design
  - Say **take over** in Cursor when Claude tokens die; say **stop the watcher** to kill the 5m loop
- **Do not touch:**
  - `.env.local` / secrets (never commit)
  - Areas the other agent lists here while actively editing them

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
3. Cursor watcher (5m): fetch both worktrees, report SHAs / dirty state; if this file is missing or `Last-Updated` is older than **15 minutes**, flag *Claude may be stalled — ready to take over*.
