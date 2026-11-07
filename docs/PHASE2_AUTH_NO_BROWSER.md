# Phase 2 interactive authentication — CURRENT SAFETY NOTICE

> **Authentication is not project/change authority. Do not use historical auth helpers
> to select a cloud project or rewrite repository cloud variables.**

The old procedure in this file set gcloud/ADC project state and GitHub Actions variables
to legacy `guardentra-7f582`. Those project-binding actions are quarantined by #130/#136.

If an approved Owner-local packet requires an interactive sign-in because browser
auto-launch is unavailable, perform authentication only in an interactive terminal:

```powershell
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" auth login --no-launch-browser --update-adc
gh auth login --hostname github.com --git-protocol https --web
```

After authentication:

1. Do **not** set a default/quota project from this document.
2. Do **not** set `GCP_PROJECT_ID` / `GCP_PROJECT_NUMBER` repository variables from
   historical values.
3. Return to the current issue-bound packet (#116 for read-only cloud authority, then
   #72/#73/#74/#126 or a newer scoped task).
4. Use explicit project identifiers taken from fresh evidence.
5. Keep tokens, verification codes, ADC files and raw auth output out of GitHub evidence.

Historical scripts `scripts/phase2-auth-gcloud.ps1` and `scripts/phase2-auth-gh.ps1`
are quarantined under #130 and must not be used for current project selection.

Issue #138 tracks this current guidance.
