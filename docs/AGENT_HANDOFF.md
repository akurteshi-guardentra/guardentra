# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-05T19:05:00Z
- **Agent:** Cursor
- **Branch / SHA:** `main` @ tip after residuals + push
- **Doing now:** Idle after residuals display + production build verify.
- **Done this session:**
  - Assessment tracker/review shows `sentAt` / `completedAt` timeline under Due
  - `npm run lint` clean; vitest **104/104**; `npm run build` succeeds (client + `dist/server.cjs`)
  - Pushed unpushed main commits (lifecycle, empty recovery, exceptions, etc.)
- **Blocked / next:**
  - **Manual (user):** Firebase Console Support email → `support@guardentra.com`
  - **Manual:** Trigger Email extension for real vendor mail; `VITE_STRIPE_PRICE_*` if checkout needed
  - Post-ship E2E smoke: vendor → FastTrack triage → assessment → portal (incognito) → Review → decision
  - Later: custom questionnaires, AI evidence citations, scheduled reminders, PDF polish
- **Do not touch:**
  - `.env.local` / secrets (never commit)
  - KI#12 unless explicitly un-parked

## Follow-ups (remaining)

1. Firebase Support email in Console
2. Smoke on guardentra.com after App Hosting rolls
3. Ops: Trigger Email + Stripe price env

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev`/`main` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
