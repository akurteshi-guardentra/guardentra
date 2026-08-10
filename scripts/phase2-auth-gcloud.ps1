# Phase 2 — gcloud auth without browser auto-launch / Cloud Shell
# Usage: powershell -File scripts/phase2-auth-gcloud.ps1
# Opens URL for phone/other browser; paste verification code into THIS window.

$ErrorActionPreference = "Stop"
$gcloud = @(
  "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
  "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $gcloud) { throw "gcloud not found. Install Google Cloud SDK first." }
$gsutil = Join-Path (Split-Path $gcloud) "gsutil.cmd"

Write-Host "=== Guardentra gcloud auth (no-launch-browser) ==="
Write-Host "1) Open the printed URL on your phone or another machine"
Write-Host "2) Sign in (admin@guardentra.com)"
Write-Host "3) Paste the verification code back into this window"
Write-Host ""

& $gcloud auth login --no-launch-browser --update-adc --account=admin@guardentra.com
if ($LASTEXITCODE -ne 0) { throw "gcloud auth login failed (exit $LASTEXITCODE)" }

& $gcloud auth application-default set-quota-project guardentra-7f582
& $gcloud config set project guardentra-7f582

Write-Host ""
Write-Host "Verifying WIF provider + TF state bucket..."
& $gcloud iam workload-identity-pools providers describe github-provider `
  --project=guardentra-7f582 --location=global `
  --workload-identity-pool=github-pool `
  --format="yaml(name,state,attributeCondition)"
& $gsutil ls -b gs://guardentra-tfstate-eu-staging

Write-Host ""
Write-Host "OK - gcloud auth + WIF/bucket verify complete."
