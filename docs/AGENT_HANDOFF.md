# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-06T13:30:00Z
- **Agent:** Cursor
- **Branch / SHA:** `main` @ `1ff0faa` (+ local verify scripts pending commit)
- **Doing now:** App Hosting verify playbook landed (`npm run verify:live`).
- **Done this session:**
  - Confirmed polish is **live** on guardentra.com via CDN string probe
  - Added `scripts/verify-live-deploy.mjs`, `npm run verify:live`, `npm run firebase:reauth`
  - Documented verify steps in `docs/ENVIRONMENTS.md`
  - Drafted next visible UX work in `docs/VISIBLE_UX_PASS.md`
- **Blocked / next:**
  - **Manual (user):** `npm run firebase:reauth` once (browser) so CLI rollout list works again
  - **Manual (user):** Firebase Console Support email → `support@guardentra.com`
  - Next product: visible Vendors/Assessments UX pass (`docs/VISIBLE_UX_PASS.md`)
  - Manual: Trigger Email extension; `VITE_STRIPE_PRICE_*` if checkout needed
- **Do not touch:**
  - `.env.local` / secrets (never commit)
  - KI#12 unless explicitly un-parked

## Follow-ups (remaining)

1. `npm run firebase:reauth` (interactive, once)
2. Visible UX pass per `docs/VISIBLE_UX_PASS.md`
3. Firebase Support email in Console
4. Ops: Trigger Email + Stripe price env

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev`/`main` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
3. After every `main` push → `npm run verify:live` (do not rely on expired Firebase CLI).
