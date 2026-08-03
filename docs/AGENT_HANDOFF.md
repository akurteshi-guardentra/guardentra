# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-03T14:10:00Z
- **Agent:** Cursor
- **Branch / SHA:** `dev` @ tip after this handoff commit (feature `84c6467` already on `origin/main` + live App Hosting)
- **Doing now:** Idle — verified live web + closed stale KI#1 wording.
- **Done this session:**
  - Confirmed no intentional uncommitted WIP in `guardentra` / `guardentra-dev`
  - Verified App Hosting backend `guardentra` on `guardentra-7f582` already serves `support@guardentra.com` (JS bundle contains the string; backend `updateTime` 2026-08-03T13:58:44Z)
  - Clarified KI#1 resolved text (storage rules were deployed with #16/#17/#18; left-over “not yet deployed” was stale)
  - Local `main` fast-forwarded to `origin/main` @ `4a2880e` before this commit
- **Blocked / next:**
  - **Manual (user):** Firebase Console **Support email** → `support@guardentra.com` (see Follow-ups) — still cannot be set from git
  - Optional smoke: Landing footer / Settings / Pricing Gov mailto links on live URL
  - **Next product work:** KI#12 hard caps (parked architecture) — only when nothing smaller remains
- **Do not touch:**
  - `.env.local` / secrets (never commit)
  - KI#12 unless explicitly un-parked

## Follow-ups (remaining)

1. **Firebase project Support email (Console only)** — for each Firebase project you use (`guardentra-7f582` demo, plus `guardentra-dev` / staging / prod when live):
   - Firebase Console → ⚙️ **Project settings** → **General** → **Public settings** → **Support email** → set to `support@guardentra.com` (must be a Google account that can access the project, or an authorized address shown in the picker).
   - Optional (OAuth branding): Google Cloud Console → **APIs & Services** → **OAuth consent screen** → **User support email** → same address.
   - This cannot be set from app code; the agent did not change Console.
2. Optional smoke: open https://guardentra--guardentra-7f582.us-central1.hosted.app Landing footer / Settings → Product support / Pricing Gov “Contact Sales” and confirm `mailto:support@guardentra.com`.

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
