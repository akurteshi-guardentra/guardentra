# Run the post-release Playwright suites from the owner's PC (Windows PowerShell 5.1+).
#   cd <repo>\e2e
#   .\Run-PostReleaseQa.ps1 -Target staging -ExpectSha <40-char sha>
#   .\Run-PostReleaseQa.ps1 -Target prod -ExpectSha <40-char sha>          # read-only smoke only
#   .\Run-PostReleaseQa.ps1 -Target staging -Suite regression               # prompts for the synthetic staging admin
# The password is read with Read-Host -AsSecureString and is only put in this process's
# environment for the run. Nothing is written to disk except test-results\ and playwright-report\.
param(
  [Parameter(Mandatory = $true)][ValidateSet('staging', 'prod')][string]$Target,
  [ValidatePattern('^([0-9a-f]{40})?$')][string]$ExpectSha = '',
  [ValidateSet('smoke', 'regression', 'all')][string]$Suite = 'smoke'
)
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

if ($Target -eq 'prod' -and $Suite -ne 'smoke') {
  throw 'Prod runs the read-only smoke suite only. Signed-in prod checks need a separate owner OK.'
}
if (-not (Test-Path node_modules)) { npm ci; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
npx playwright install chromium
if ($LASTEXITCODE) { exit $LASTEXITCODE }

$env:E2E_TARGET = $Target
$env:E2E_EXPECT_SHA = $ExpectSha
try {
  if ($ExpectSha) {
    node scripts/wait-for-release.mjs --timeout-min 45
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
  }
  $projects = switch ($Suite) { 'smoke' { @('smoke') } 'regression' { @('regression') } 'all' { @('smoke', 'regression') } }
  if ($projects -contains 'regression') {
    $env:E2E_ADMIN_EMAIL = Read-Host 'Synthetic staging admin email'
    $sec = Read-Host 'Password' -AsSecureString
    $env:E2E_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  }
  $pwArgs = @('playwright', 'test') + ($projects | ForEach-Object { "--project=$_" })
  npx @pwArgs
  $code = $LASTEXITCODE
  node scripts/summary.mjs test-results/results.json "$Suite on $Target"
  exit $code
}
finally {
  Remove-Item Env:E2E_ADMIN_EMAIL, Env:E2E_ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
