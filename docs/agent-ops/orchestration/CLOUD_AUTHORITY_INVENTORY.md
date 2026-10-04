# GuardEntra cloud authority inventory (#116)

This helper is a read-only bridge for the Owner-local Windows runner.

Targets:
- staging: `guardentra-staging`
- production: `guardentra-prod`

It records only sanitized resource metadata required to route #72, #73 and #74:
- project read state
- principal classification only (user/service-account/unknown; never the raw account identifier)
- Cloud Tasks queue names/states
- scanner-related Compute names/zones/status
- Cloud SQL names/region/state/version
- matching Secret Manager names only, never payloads
- Firebase Trigger Email instance id/state/ref/version

Commands are allowlisted. Mutating gcloud/firebase commands are refused.

The persistent runner invokes this inventory at most once every 15 minutes and publishes a changed, redacted summary to Issue #116 when checkpoint publishing is enabled.

Manual snapshot:

```powershell
.\scripts\guardentra.ps1 cloud-inventory all
```

To validate locally without publishing:

```powershell
.\scripts\guardentra.ps1 cloud-inventory all -NoPublish
```

A project permission failure is reported as `read_refused`; it is never interpreted as resource absence. Stale local authentication is reported as `auth_required`.
