# Issue #88 correction cycle 3 — PR #89 review BLOCKER/HIGH

- Packet ID: issue-88-correction-3
- Updated UTC: 2026-10-01
- GitHub issue: https://github.com/akurteshi-guardentra/guardentra/issues/88
- PR under review: https://github.com/akurteshi-guardentra/guardentra/pull/89
- Reviewed HEAD (unchanged until Owner commit grant): `02f0a1c8c3887f1f7d75400e8c6604ef99491b73`
- Feature branch: `tooling/agent-control-plane-88`
- Scope amendment: #9C correction cycle 3 (allowed paths include `.github/workflows/ci.yml`)
- Prior content digest `f8c1774f…` is obsolete after the path-normalization fix below; do not reuse that commit grant

## Findings addressed

| Finding | Correction |
|---|---|
| PS 5.1 `gh pr list` JSON `[]` → `$null` → `@($null).Count=1` crashes `push-and-pr` | `ConvertFrom-GuardentraOpenPrListJson` + `Get-GuardentraOpenPrsForBranch` treat `[]`/`$null`/blank as Count 0 |
| Regression only mocked `@()` | Tests feed literal JSON string `[]` through the parser and through the no-existing-PR push-and-pr path |
| GitHub CI does not run dispatcher suite | `.github/workflows/ci.yml` adds Windows `dispatcher` job running `scripts/guardentra/tests/Run-Tests.ps1` via Windows PowerShell |
| Commit gate: `TrimStart('./')` strips leading `.` from `.github/…` so authorized `ci.yml` fails allowlist | `Test-GuardentraPathAllowed` strips only literal `./` prefix; regression tests cover hidden-path + traversal cases |

## Boundaries preserved

- Owner-grant / live revalidation / nonce replay unchanged
- Worktree binding unchanged
- No merge/deploy autonomy
- No product/Firebase/IAM/secrets changes
- Existing `verify` job behavior unchanged (additive Windows job only)

## Stop boundary

STOP BEFORE COMMIT. No commit, push, PR update, merge, or deployment is authorized by this amendment alone.
