# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-05T16:25:00Z
- **Agent:** Cursor
- **Branch / SHA:** `main` @ `7a50b34`+ (correlation + Under Review)
- **Doing now:** Idle after vendor↔assessment correlation hardening.
- **Done this session:**
  - FastTrack triage + exceptions review + decision terminal
  - Status chips: Sent → In Progress → Under Review (not Completed on submit); risk chip matches filter
  - Custom questionnaire tab disabled until real editor exists
- **Blocked / next:**
  - **Manual (user):** Firebase Console Support email → `support@guardentra.com`
  - **Manual:** Trigger Email extension for real vendor mail; `VITE_STRIPE_PRICE_*` if checkout needed
  - Post-ship E2E smoke: vendor → triage → assessment → portal → submit → exceptions review → decide
  - Later: custom questionnaires, AI evidence citations, scheduled reminders, PDF polish, legacy empty-assessment recovery
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
