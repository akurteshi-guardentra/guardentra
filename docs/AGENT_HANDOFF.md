# Agent handoff

Living status for parallel Claude + Cursor sessions. Update and **push** at the end of every meaningful chunk of work so the other machine can `git fetch` and continue without a long paste.

---

- **Last-Updated:** 2026-08-04T10:45:00Z
- **Agent:** Cursor
- **Branch / SHA:** local worktree (framework pack versioning — commit when asked)
- **Doing now:** Idle after framework version management implementation.
- **Done this session:**
  - Framework version management (Phases 0–4):
    - Unified onboarding FrameworkIds with vendor catalog (`nist_csf_2`, etc.); `frameworkId` on compliance docs; org `frameworkPackDefaults`
    - Durable `controlKey` on bank + snapshots; assessments stamp `frameworkPackIds` + `questionBankVersion`
    - Portal no longer rebuilds from live bank when snapshot missing
    - `FRAMEWORK_PACKS` with NIST 1.1/2.0 and ISO 2013/2022 side-by-side
    - Settings `FrameworkPacksCard` + Assessments upgrade banner; rebaseline helper; `/api/ai/framework-map`
  - Docs: `ARCHITECTURE_FOUNDATION.md`, `PRODUCT_FOCUS.md`, `PRODUCT_ROADMAP_2026.md`, this handoff
- **Blocked / next:**
  - **Manual (user):** Firebase Console Support email → `support@guardentra.com`
  - Spine UX plan (portal auth / dashboard slim) still separate if not yet shipped
  - Optional: commit + push this framework pack work
- **Do not touch:**
  - `.env.local` / secrets (never commit)
  - KI#12 unless explicitly un-parked

## Follow-ups (remaining)

1. **Firebase project Support email (Console only)** — for each Firebase project you use (`guardentra-7f582` demo, plus `guardentra-dev` / staging / prod when live):
   - Firebase Console → ⚙️ **Project settings** → **General** → **Public settings** → **Support email** → set to `support@guardentra.com`
2. Optional smoke: create assessment → confirm `frameworkPackIds` on doc → Settings pack pins → portal uses snapshotted `controlKey`s

## Protocol

1. End of chunk → rewrite the fields above → commit on `dev` → `git push origin HEAD`.
2. Other agent → `git fetch` → read this file → continue **Blocked / next**.
