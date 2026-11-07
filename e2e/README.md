# Post-release QA (Playwright)

Automated checks that run after a release reaches staging or production.
Kept in its own package (Playwright 1.56.1, same as the PC harness) so the app's `npm ci` is unchanged.

## Suites

| Suite | Where | What it does | Writes data? |
|---|---|---|---|
| `smoke` (S1-S12) | staging, prod | `/api/health` environment, project and `sourceSha`; unknown `/api` is JSON 404; security headers; `security.txt`; CORS (foreign origin refused, app origin allowed); bundle isolation; landing and `/login` render with no errors; signed-out `/dashboard` goes to `/login`; a bogus portal link is refused | No. GET requests and signed-out page loads only |
| `regression` (R1-R5) | staging only | Signs in as one fixed synthetic staging admin and opens dashboard, vendors, assessments, triage and settings. Fails on runtime errors, "Missing or insufficient permissions" or an error panel | No. It clicks nothing that creates, sends or saves |
| `journey` (planned) | staging only | Full #124 journey A1-A17, self-cleaning. To be ported from the PC harness (`e2e124-20261101b`, s01-s14) | Yes, synthetic data, deleted at the end |

**Bundle isolation** reads the inlined `VITE_FIREBASE_*` values in every chunk, in any quote style
including backtick template literals, and strips a trailing `\r\n`. A bare `guardentra-staging` or
`guardentra-7f582` string is not a failure: the source names both on purpose. See `lib/bundle.mjs`
and its unit tests (`npm run test:unit`).

## When it runs

- **After every staging promote**: `promote-staging` in `ci.yml` pushes `deploy/staging`, which starts
  `.github/workflows/post-release-qa.yml`. It waits for staging `/api/health` to report the pushed SHA
  (up to 45 min), then runs smoke and regression. Results are in the run's summary.
- **After a prod rollout**: run the workflow by hand with target `prod` and the released SHA, or from the PC:

```powershell
cd C:\Users\Admin\repos\guardentra\e2e
.\Run-PostReleaseQa.ps1 -Target prod -ExpectSha <40-char sha>
.\Run-PostReleaseQa.ps1 -Target staging -Suite all     # prompts for the synthetic staging admin
```

## Safety rules built in

- Only three hosts are allowed (`lib/targets.mjs`): staging, `guardentra.com`, and loopback. Anything else stops before a browser starts.
- Prod is read-only. The signed-in suite refuses to load for prod, the workflow skips it for prod, and the PowerShell runner refuses it.
- Traces and videos are off everywhere, because they record typed passwords and the repo is public.
  Smoke failure screenshots (signed-out pages) are kept 7 days. Signed-in runs upload nothing.
- Credentials exist only as `staging-e2e` environment secrets (`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`). The regression job stays off until repo variable `E2E_REGRESSION_ENABLED` is `true`.
  Without them the regression tests show as SKIPPED, never as passed.

## Checking the suites locally

```bash
npm run build && NODE_ENV=production APP_ENV=production GOOGLE_CLOUD_PROJECT=demo-guardentra-local \
  FIREBASE_STORAGE_BUCKET=demo-guardentra-local.appspot.com node dist/server.cjs &
cd e2e && npm ci && E2E_TARGET=local E2E_LOCAL_PROJECT=demo-guardentra-local npx playwright test --project=smoke
```
