# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-05T14:30:00Z
- **Agent:** Cursor
- **Branch / SHA:** `main` (commit after this handoff)
- **Doing now:** Idle after spine UX + framework packs ship.
- **Done this session:**
  - Framework packs already on main (`db30a76`…)
  - Spine UX Phase A–C:
    - Portal secondary Auth (`portalAuth`) + AuthContext skip `portal_*` bootstrap
    - Assessments: block Copy/Remind for `local_asm_*`, toasts, review empty-state, create toast
    - Promote remaps `vendorId` local → cloud
    - Slim Dashboard (vendors / pending assessments / Audit Lab; Quick Start when vendorCount === 0)
    - Onboarding: per-uid flag + opt-in sample seed
    - Audit Lab / Settings select contrast; Settings honesty; Pricing Stripe env gate; Docs spine CTAs
- **Blocked / next:**
  - **Manual (user):** Firebase Console Support email → `support@guardentra.com`
  - **Manual:** Trigger Email extension for real vendor mail; `VITE_STRIPE_PRICE_*` if checkout needed
  - Post-ship E2E smoke on guardentra.com (vendor → assessment → portal incognito → review)
- **Do not touch:**
  - `.env.local` / secrets (never commit)
  - KI#12 unless explicitly un-parked

## Follow-ups (remaining)

1. Firebase Support email in Console
2. Smoke: create vendor → assessment → copy portal → incognito answers → Review
3. Assessment residuals backlog (overdue from dueAt, completedAt/sentAt, charter)

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev`/`main` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
