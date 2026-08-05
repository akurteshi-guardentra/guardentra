# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-05T18:55:00Z
- **Agent:** Cursor
- **Branch / SHA:** `main` @ (pending commit — portal/tracker lifecycle tests)
- **Doing now:** Idle after portal/tracker lifecycle integration tests.
- **Done this session:**
  - Extracted pure `assessmentLifecycle.ts` helpers (create / autosave / submit / org decision)
  - Wired AssessmentWizard, VendorPortal, Assessments to those helpers
  - Vitest integration-style coverage: create → autosave In Progress → submit Under Review (not Completed) → Approve / Remediate / Reject + vendor chips
  - Prior: empty-assessment recovery, FastTrack triage, exceptions, status chips, custom stub disabled
- **Blocked / next:**
  - **Manual (user):** Firebase Console Support email → `support@guardentra.com`
  - **Manual:** Trigger Email extension for real vendor mail; `VITE_STRIPE_PRICE_*` if checkout needed
  - Post-ship E2E smoke: vendor → triage → assessment → portal → submit → exceptions review → decide
  - Later: custom questionnaires, AI evidence citations, scheduled reminders, PDF polish
  - Assessment residuals (completedAt/sentAt display) if still needed
- **Do not touch:**
  - `.env.local` / secrets (never commit)
  - KI#12 unless explicitly un-parked

## Follow-ups (remaining)

1. Firebase Support email in Console
2. Smoke: create vendor → FastTrack triage → assessment → portal → Review → decision
3. Assessment residuals (completedAt/sentAt display)
4. Push `main` when ready (local ahead of origin)

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev`/`main` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
