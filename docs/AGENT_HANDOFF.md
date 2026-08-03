# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-03T14:00:00Z
- **Agent:** Cursor
- **Branch / SHA:** `dev` @ `0ce7534` (feature `84c6467`); left on `dev` — not merged to `main`
- **Doing now:** Idle after surfacing `support@guardentra.com` in the web app.
- **Done this session:**
  - Canonical support email constant + UI surfaces (Landing footer, Settings, Pricing Gov CTA, UserGuide)
  - Documented Firebase Console support-email path (manual)
- **Blocked / next:**
  - **Manual:** set project Support email in Firebase Console (see Follow-ups)
  - Optional: copy `.env.local` keys into `guardentra-dev` worktree if needed
  - **KI#12** still parked (hard caps)
- **Do not touch:**
  - `.env.local` / secrets (never commit)

## Follow-ups (remaining)

1. **Firebase project Support email (Console only)** — for each Firebase project you use (`guardentra-7f582` demo, plus `guardentra-dev` / staging / prod when live):
   - Firebase Console → ⚙️ **Project settings** → **General** → **Public settings** → **Support email** → set to `support@guardentra.com` (must be a Google account that can access the project, or an authorized address shown in the picker).
   - Optional (OAuth branding): Google Cloud Console → **APIs & Services** → **OAuth consent screen** → **User support email** → same address.
   - This cannot be set from app code; the agent did not change Console.
2. Optional smoke: open Landing footer / Settings → Product support / Pricing Gov “Contact Sales” and confirm `mailto:support@guardentra.com`.

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
