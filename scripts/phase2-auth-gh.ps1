# Phase 2 — GitHub CLI device login + set GCP Actions vars
# Usage: powershell -File scripts/phase2-auth-gh.ps1
# Open https://github.com/login/device on phone; enter the one-time code this prints.

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\GitHub CLI;" + $env:Path
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "gh not found. Install GitHub CLI (winget install GitHub.cli)."
}

$REPO = "akurteshi-guardentra/guardentra"
$PROJECT_ID = "guardentra-7f582"
$PROJECT_NUMBER = "967769575761"

Write-Host "=== Guardentra gh device auth ==="
Write-Host "1) Copy the one-time code printed below"
Write-Host "2) Open https://github.com/login/device on phone/browser"
Write-Host "3) Approve access (repo + variables scopes)"
Write-Host ""

gh auth login --hostname github.com --git-protocol https --web
if ($LASTEXITCODE -ne 0) { throw "gh auth login failed (exit $LASTEXITCODE)" }

Write-Host "Setting GitHub Actions variables on $REPO ..."
gh variable set GCP_PROJECT_ID --body $PROJECT_ID --repo $REPO
gh variable set GCP_PROJECT_NUMBER --body $PROJECT_NUMBER --repo $REPO
gh variable list --repo $REPO

Write-Host ""
Write-Host "OK - GitHub Actions GCP vars set."
