# Legacy guardentra-7f582 hardening (owner-approved preparation, 2026-10-31)

**Scope:** only the legacy project `guardentra-7f582` and its `(default)` Firestore database. Never point these scripts or rules at `guardentra-prod` or staging.

**Status: PREPARED, NOT RUN.** Each step needs its own explicit owner go. Run them in order.

**Why:** the owner-run read-only checks on 2026-10-31 found:
- anonymous sign-in is ON and email self sign-up is open, so anyone can get a token;
- there is no PITR, no backup and no delete protection on the real legacy data;
- the live rules are Option A (`0f53902f…`, sha `a0645160…`), which allows cross-tenant writes W9, W10 and W11.

| Step | Script | Changes | Undo |
|---|---|---|---|
| 1 | `01-backup-legacy.ps1` | Creates a new private bucket. Runs a Firestore export of `(default)` and copies the Storage files into it | Delete the backup bucket in the console |
| 2 | `02-anonymous-signin.ps1` | Auth `signIn.anonymous.enabled` = false. Email/password and Google are untouched | `02-anonymous-signin.ps1 -Rollback` |
| 3 | `03-deploy-option-a1.ps1` | `cloud.firestore` → Option A.1 (`firestore.rules.legacy-option-a1`, sha `1a4c6e1e…`) | `04-rollback-option-a1.ps1` (back to `0f53902f…`) |

Every script stops unless the live state matches what was verified. Every script asks you to type the project name before changing anything, and reads the result back.

## Option A.1 (rules)
- **What it is:** Option A plus three back-ports from the RC rules. Diff against `firestore.rules.prod-option-a.baseline` (the exact live text).
- **W11:** `assessment_responses` / `evidence` create are bound to the caller's own org, and any `assessmentId` must be in the same org.
- **W9:** `organizationId` is immutable on member updates (16 collections).
- **W10:** a child's `vendorId` / `assessmentId` must exist in the same org (`existsAfter`, so same-batch creates work), and re-parenting is denied.

**Tests** (Firestore emulator, from the repo root):
```
npx firebase emulators:exec --only firestore --project demo-guardentra-legacy-a1 "node ops/legacy-hardening/legacy-option-a1.test.mjs"
npx firebase emulators:exec --only firestore --project demo-guardentra-legacy-a1 "node ops/legacy-hardening/legacy-option-a1.test.mjs ops/legacy-hardening/firestore.rules.prod-option-a.baseline"
npx firebase emulators:exec --only firestore --project demo-guardentra-option-a "node ops/legacy-hardening/option-a.compat.test.mjs"
```
**Results (2026-10-31):**
- A.1: 28/28 negative denied, 32/32 regression pass.
- Live Option A baseline: 0/28 denied (all gaps reproduced), 32/32 regression pass.
- Compat suite on A.1: 14/14.

**Not covered:**
- Existing legacy assessments whose `vendorId` points to a deleted vendor. Member updates to those would be denied.
- Intra-tenant gaps W1-W8. Those are the 7b914ee client's normal write paths.
- `vendor_triage` / `vendor_invites` `vendorId` binding, which is limited to the caller's own tenant.
