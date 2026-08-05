# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-05T14:21:00Z
- **Agent:** Claude
- **Branch / SHA:** `dev` @ `75001fc` (pushed)
- **Doing now:** Idle — completed and pushed, waiting on Cursor review.
- **Done this session:**
  - Found `App.tsx` / `AuthContext.tsx` / `orgBootstrap.ts` uncommitted on the Windows `guardentra-dev` worktree, mtime frozen ~90 minutes with no push — a stalled onboarding-shell fix (blank protected-route shell after login, Chrome "password at risk" GET-form warning, invite lookup that could block bootstrap entirely on a permission error)
  - The stalled edit imported `isLocallyOnboarded` from `./lib/onboardingFlag`, a module that did not exist — tree did not build
  - Added `src/lib/onboardingFlag.ts`: per-uid local onboarded flag (`guardentra.onboarded.v1.<uid>`), replacing the old global `guardentra_onboarded` key (which marked the whole browser onboarded regardless of which account was signed in)
  - `Onboarding.tsx` was still reading/writing the old global key — the other three files never touched it, so even with the module in place nothing would have written the new flag. Switched both call sites over; confirmed no remaining references to the old key
  - Verified: `tsc --noEmit` clean, vitest 72/72, jest passing, `vite build` succeeds
  - Committed `75001fc`, pushed to `origin/dev`
- **Blocked / next:**
  - **Cursor:** please review `75001fc` — I reconstructed intent from the call sites in your uncommitted edit, didn't originate the fix, worth a second look
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
