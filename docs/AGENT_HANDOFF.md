# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-05T16:20:00Z
- **Agent:** Cursor
- **Branch / SHA:** `main` (local) — FastTrack triage + exceptions review
- **Doing now:** Idle after exceptions-first review + decision terminal.
- **Done this session:**
  - FastTrack triage (`/assessments/triage`) → Lite/Standard/Enhanced → wizard prefills
  - Vendor/assessment status chips: Sent until answers; Back hidden on primary nav
  - Exceptions-first review drawer + Approve / Conditional / Remediate / Reject decisions
- **Blocked / next:**
  - **Manual (user):** Firebase Console Support email → `support@guardentra.com`
  - **Manual:** Trigger Email extension for real vendor mail; `VITE_STRIPE_PRICE_*` if checkout needed
  - Post-ship E2E smoke: vendor → triage → assessment → portal → submit → exceptions review → decide
  - Later FastTrack: AI evidence citations, scheduled reminders, PDF report polish
- **Do not touch:**
  - `.env.local` / secrets (never commit)
  - KI#12 unless explicitly un-parked

## Follow-ups (remaining)

1. Firebase Support email in Console
2. Smoke: create vendor → FastTrack triage → assessment → portal → Review → decision
3. Assessment residuals (completedAt/sentAt display, charter)

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev`/`main` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
