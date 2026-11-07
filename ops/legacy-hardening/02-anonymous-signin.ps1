# Legacy guardentra-7f582: turn anonymous sign-in OFF (or back ON with -Rollback).
# Needs a separate owner go. Windows PowerShell 5.1, gcloud signed in as the owner.
#   .\02-anonymous-signin.ps1            -> anonymous OFF
#   .\02-anonymous-signin.ps1 -Rollback  -> anonymous ON again (undo)
#
# Why it is safe for the legacy app: 7b914ee never calls signInAnonymously(); the vendor
# portal uses server-minted custom tokens (/api/portal/session). Email/password and Google
# sign-in are NOT changed. Existing anonymous accounts are not deleted.
# What it does: reads the Auth config, checks the current value, asks you to type the
# project name, PATCHes only signIn.anonymous.enabled, then reads it back.

param([switch]$Rollback)

$ErrorActionPreference = 'Stop'
$Project = 'guardentra-7f582'
$want = [bool]$Rollback   # $false = turn off, $true = turn back on
$uri = "https://identitytoolkit.googleapis.com/admin/v2/projects/$Project/config"
$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$token = (& gcloud auth print-access-token).Trim()
$h = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Project }

$before = Invoke-RestMethod -Method Get -Headers $h -Uri $uri
$cur = [bool]$before.signIn.anonymous.enabled
Write-Host "1/4 Anonymous sign-in is currently: $cur. Email/password: $($before.signIn.email.enabled)."
if ($cur -eq $want) { Write-Host "Already $want. Nothing to do."; return }

$typed = Read-Host "2/4 Type the project name ($Project) to set anonymous sign-in to $want"
if ($typed -ne $Project) { throw 'Not confirmed. Nothing changed.' }

$body = [System.Text.Encoding]::UTF8.GetBytes((@{ signIn = @{ anonymous = @{ enabled = $want } } } | ConvertTo-Json -Depth 5))
$null = Invoke-RestMethod -Method Patch -Headers $h -ContentType 'application/json; charset=utf-8' -Body $body `
  -Uri "${uri}?updateMask=signIn.anonymous.enabled"
Write-Host '3/4 Updated. Reading back...'

$after = Invoke-RestMethod -Method Get -Headers $h -Uri $uri
$result = [ordered]@{
  project = $Project; anonymousBefore = $cur; anonymousAfter = [bool]$after.signIn.anonymous.enabled
  emailPasswordAfter = $after.signIn.email.enabled; matches = ([bool]$after.signIn.anonymous.enabled -eq $want)
  undo = $(if ($want) { '.\02-anonymous-signin.ps1' } else { '.\02-anonymous-signin.ps1 -Rollback' })
}
$result | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'anonymous-signin-result.json')
$result | Format-List
Write-Host '4/4 Paste the lines above into the chat.'
