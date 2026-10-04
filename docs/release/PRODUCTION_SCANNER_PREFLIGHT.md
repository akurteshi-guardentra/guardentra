# Production scanner manifest preflight (#73)

This gate is repository/config evidence only. It must never be reported as production scanner deployment or live proof.

The current `apphosting.prod.yaml` has the scanner block commented out, so the expected state is:

```
disabled
```

That is safe and truthful.

If scanner variables become active, CI requires a complete production configuration in one change:

- `APP_ENV=production`
- scanner explicitly enabled
- `EVIDENCE_SCANNER_SECRET` as a Secret Manager reference, not a literal
- valid ClamAV host/port
- `cloud_tasks` delivery
- exact production task project
- queue/location
- matching HTTPS target URL and audience
- task service account owned by `guardentra-prod`
- VPC configuration when ClamAV uses an RFC1918 private address
- no test-only `EVIDENCE_SCANNER_MODE`

Passing state `config_ready` means only that the manifest is structurally ready for a separately authorized production rollout.

It does **not** prove:

- production queue exists or is RUNNING
- ClamAV target is reachable
- secret version exists or is accessible
- task OIDC/IAM is correct
- clean sample reaches `clean`
- EICAR reaches `quarantined`
- timeout/failure remains fail-closed
- deployed source SHA matches repository main

Those remain live #73 acceptance evidence.
