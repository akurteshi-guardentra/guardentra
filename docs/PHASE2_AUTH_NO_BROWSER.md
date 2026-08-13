# Interactive auth helpers for Phase 2 (no Cloud Shell required).
# Prefer these when default `gcloud auth login` / browser auto-launch fails.

## Google Cloud (paste-code flow)

Do **not** need Cloud Shell. Works on phone browser + this PC terminal.

```powershell
# From an interactive PowerShell window (not the agent):
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" auth login --no-launch-browser --update-adc --account=admin@guardentra.com
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" auth application-default set-quota-project guardentra-7f582
& "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" config set project guardentra-7f582
```

Or: `powershell -File scripts/phase2-auth-gcloud.ps1`

## GitHub CLI (device code — phone OK)

```powershell
# Prints a one-time code + https://github.com/login/device
gh auth login --hostname github.com --git-protocol https --web
gh variable set GCP_PROJECT_ID --body guardentra-7f582 --repo akurteshi-guardentra/guardentra
gh variable set GCP_PROJECT_NUMBER --body 967769575761 --repo akurteshi-guardentra/guardentra
```

Or: `powershell -File scripts/phase2-auth-gh.ps1`

## Why default login "does not work"

- `gcloud auth login` (without flags) tries to open a local browser and listen on `localhost:8085`. That fails if no usable browser / redirect is blocked. It is **not** Cloud Shell.
- Agent terminals cannot accept the pasted Google verification code (EOF). Use an interactive window or the scripts above.
