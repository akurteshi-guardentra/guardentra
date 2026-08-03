# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-03T13:38:16Z
- **Agent:** Cursor
- **Branch / SHA:** `dev` @ `e5d42c9` (+ local docs close for KI#23); `origin/main` was `e5d42c9`
- **Doing now:** Idle after rules deploy confirmation.
- **Done this session:**
  - KI#6 closed; KI#23 **deployed** to `guardentra-7f582` (Windows: Deploy complete)
  - KI#12 parked
- **Blocked / next:**
  - Fill `.env.local`: `GEMINI_API_KEY`, `VITE_FIREBASE_API_KEY` (still empty on Windows)
  - Optional live smoke: invite join + member cannot edit org name
  - **KI#12** still parked (hard caps)
- **Do not touch:**
  - `.env.local` / secrets (never commit)

## Follow-ups (remaining)

1. **`.env.local` keys** — Firebase Console → `guardentra-7f582` → Project settings → Web API key → `VITE_FIREBASE_API_KEY`; Gemini key → `GEMINI_API_KEY`.
2. Optional smoke after keys: `npm run dev` + invite/member org-settings check.

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
