# Emergency Firestore rules (P0, 2026-10-30): NOT DEPLOYED

The files here are standalone release candidates for the **live** Firestore rulesets of the production and legacy projects. They are not `firestore.rules`. Nothing in this folder is used by App Hosting, CI or any deploy script.

## Why
A read-only verification on 2026-10-30, run by the owner, found the following.
- `guardentra-prod`:
  - Its `cloud.firestore` release (ruleset `2e9c308d-9889-4b16-8d55-63b4c77e5ce4`, released 2026-08-27) is byte-identical to `85f718d:firestore.rules` (LF sha256 `873071e1…7c84`).
  - That text predates the tenant-binding fixes (#163, #61) and the billing/invite fixes (#211).
  - Its `(default)` DB is empty.
- `guardentra-7f582` (legacy):
  - It runs the same text (ruleset `c12a5117-1675-4775-b25b-ca463b36e7dc`, released 2026-08-15).
  - Its `(default)` DB holds data.

## Files
| File | Target | What |
|---|---|---|
| `firestore.rules.prod-option-a` | `guardentra-prod` (and legacy, if the legacy app is still in use) | The `85f718d` text, plus back-ported protections: profile create bound to a new-org founder or a verified pending invite; org create bound to the founder bootstrap with Starter defaults; billing fields not client-writable; verified email for invite acceptance; invite role allowlist. Everything else is unchanged, so the Aug 27 client keeps working. |
| `firestore.rules.legacy-deny-all` | `guardentra-7f582`, only if the legacy app is unused | Denies all client access. Admin SDK and console access are unaffected. |

## Compatibility with the Aug 27 production client (`29171a6`), from a static review
Still works:
- founder signup batch
- org name/logo and `dataRegion` updates
- `seatCount` / `vendorCount` increments
- client vendor and assessment creation
- invite create and revoke (roles `admin` / `member`)
- profile `onboarded` update

**Known break:** the old client's invite-join batch does not send `inviteId`, so invite joins are denied until the app is upgraded. This must be explicitly accepted before any deploy.

## Verification status
- Both files compile in the Firestore emulator.
- Runtime emulator tests of the compatibility and deny cases are **still outstanding** before any deploy.

## Rollback
Re-release the recorded ruleset ID for the project: prod `2e9c308d-9889-4b16-8d55-63b4c77e5ce4`, legacy `c12a5117-1675-4775-b25b-ca463b36e7dc`.

Any deploy needs a separate owner approval per project.
