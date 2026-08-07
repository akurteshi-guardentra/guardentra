# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-07T13:10:00Z
- **Agent:** Cursor
- **Branch / SHA:** `main` (invite email honesty + Trigger Email docs)
- **Doing now:** Idle after Invite Vendor queue honesty + ENVIRONMENTS Trigger Email checklist.
- **Done this session:**
  - Invite Vendor awaits `/api/notify/mail` and shows ok/warn banner (no silent `sendEmailBestEffort`)
  - Expanded `docs/ENVIRONMENTS.md` Trigger Email diagnose/install checklist
  - UI density polish + triage blank-page fix already on live earlier
- **Blocked / next:**
  - **Manual (user):** Firebase Console → Extensions → install/configure **Trigger Email** (`firestore-send-email`) on `guardentra-7f582` with SMTP/SendGrid; From prefer `support@guardentra.com`
  - **Manual (user):** `npm run firebase:reauth` (CLI credentials expired — cannot list extensions from agent)
  - Retest Invite → `akurteshi@guardentra.com` after extension is Active
- **Do not touch:**
  - `.env.local` / secrets (never commit)
  - KI#12 unless explicitly un-parked

## Follow-ups (remaining)

1. Install Trigger Email + SMTP on `guardentra-7f582` (see `docs/ENVIRONMENTS.md`)
2. `npm run firebase:reauth` (interactive, once)
3. Firebase Support email in Console → `support@guardentra.com`
4. `VITE_STRIPE_PRICE_*` if self-serve checkout needed

## Verify live (no CLI)

```bash
npm run verify:live
```
