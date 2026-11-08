# Staging guardentra-staging: turn anonymous sign-in OFF (or back ON with -Rollback).
# Needs a separate owner go. Windows PowerShell 5.1, gcloud signed in as the owner.
#   .\03-staging-anonymous-signin.ps1            -> anonymous OFF
#   .\03-staging-anonymous-signin.ps1 -Rollback  -> anonymous ON again (undo)
#
# Why it is safe: the RC (what staging serves) never calls signInAnonymously(). The vendor
# portal gets a server-minted custom token from POST /api/portal/session and signs in with
# signInWithCustomToken (src/pages/VendorPortal.tsx, server/routes/portal.ts). Custom-token
# sign-in does not depend on the anonymous provider. Email/password and Google are NOT changed.
# Existing anonymous accounts are not deleted.
#
# What it does: checks staging is serving the RC and the portal session endpoint answers,
# reads the Auth config, asks you to type the project name, PATCHes only
# signIn.anonymous.enabled, then reads it back. Same shape as legacy PR #235 step 2.

param([switch]$Rollback)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Project = 'guardentra-staging'
$App = 'https://guardentra--guardentra-staging.us-east4.hosted.app'
$want = [bool]$Rollback   # $false = turn off, $true = turn back on
$uri = "https://identitytoolkit.googleapis.com/admin/v2/projects/$Project/config"
$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force -Path $out | Out-Null

# 1. Staging serves the RC (release identity in /api/health exists only on RC builds).
$health = Invoke-RestMethod -Method Get -Uri "$App/api/health"
$sourceSha = "$($health.release.sourceSha)"
Write-Host "1/5 Staging /api/health: environment=$($health.release.environment) project=$($health.release.projectId) sourceSha=$sourceSha"
if ($health.release.environment -ne 'staging' -or $health.release.projectId -ne $Project -or -not $sourceSha) {
  throw 'Staging /api/health is not an RC build for guardentra-staging. Nothing changed.'
}

# 2. The vendor portal's custom-token endpoint is live. A made-up id must give the portal's own 404.
$portalOk = $false
try {
  $null = Invoke-RestMethod -Method Post -Uri "$App/api/portal/session" -ContentType 'application/json' -Body '{"assessmentId":"envfix-probe-does-not-exist"}'
} catch {
  $code = [int]$_.Exception.Response.StatusCode
  $msg = "$($_.ErrorDetails.Message)"
  $portalOk = ($code -eq 404 -and $msg -like '*assessment link is not available*')
  Write-Host "2/5 Portal session probe: HTTP $code $msg"
}
if (-not $portalOk -and -not $want) { throw 'The portal session endpoint did not answer as expected. Nothing changed.' }

# 3. Current Auth config.
$token = (& gcloud auth print-access-token).Trim()
$h = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Project }
$before = Invoke-RestMethod -Method Get -Headers $h -Uri $uri
$cur = [bool]$before.signIn.anonymous.enabled
Write-Host "3/5 Anonymous sign-in is currently: $cur. Email/password: $($before.signIn.email.enabled)."
if ($cur -eq $want) { Write-Host "Already $want. Nothing to do."; return }

$typed = Read-Host "4/5 Type the project name ($Project) to set anonymous sign-in to $want"
if ($typed -ne $Project) { throw 'Not confirmed. Nothing changed.' }

$body = [System.Text.Encoding]::UTF8.GetBytes((@{ signIn = @{ anonymous = @{ enabled = $want } } } | ConvertTo-Json -Depth 5))
$null = Invoke-RestMethod -Method Patch -Headers $h -ContentType 'application/json; charset=utf-8' -Body $body `
  -Uri "${uri}?updateMask=signIn.anonymous.enabled"

$after = Invoke-RestMethod -Method Get -Headers $h -Uri $uri
$result = [ordered]@{
  project = $Project; servingSourceSha = $sourceSha; portalSessionProbeOk = $portalOk
  anonymousBefore = $cur; anonymousAfter = [bool]$after.signIn.anonymous.enabled
  emailPasswordAfter = $after.signIn.email.enabled; matches = ([bool]$after.signIn.anonymous.enabled -eq $want)
  undo = $(if ($want) { '.\03-staging-anonymous-signin.ps1' } else { '.\03-staging-anonymous-signin.ps1 -Rollback' })
}
$result | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'staging-anonymous-signin-result.json')
$result | Format-List
Write-Host '5/5 Then open one real staging vendor portal link to confirm it still loads. Paste the lines above into the chat.'
