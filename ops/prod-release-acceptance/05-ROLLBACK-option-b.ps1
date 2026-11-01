# ROLLBACK (CHANGES PROD, owner-gated): point guardentra-prod cloud.firestore back at Option A
# ruleset 2a30bd60-c037-45e5-ae47-6ab164e2e881 (works for both the RC and the old 29171a6 client).
# RUNBOOK.md section 6 step 1. Prepared 2026-10-31, NOT RUN. Windows PowerShell 5.1.
#   .\05-ROLLBACK-option-b.ps1
# Does not go back to the pre-emergency ruleset 2e9c308d (that would reopen the P0).

$ErrorActionPreference = 'Stop'
$Proj = 'guardentra-prod'
$Target = "projects/$Proj/rulesets/2a30bd60-c037-45e5-ae47-6ab164e2e881"
$TargetLf = 'a06451608dc61a810a9e19e4cc926e7585e5a4b48fa091194b13d13c65e71747'
function Get-Sha256Hex([string]$text) { $sha = [Security.Cryptography.SHA256]::Create(); (($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text)) | ForEach-Object { $_.ToString('x2') }) -join '') }

$token = (& gcloud auth print-access-token).Trim()
$hdr = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Proj }
$api = 'https://firebaserules.googleapis.com/v1'
$releaseName = "projects/$Proj/releases/cloud.firestore"

$cur = Invoke-RestMethod -Method Get -Headers $hdr -Uri "$api/$releaseName"
if ($cur.rulesetName -eq $Target) { Write-Host "Already on Option A ($Target). Nothing to do."; return }
$tgt = Invoke-RestMethod -Method Get -Headers $hdr -Uri "$api/$Target"
if ((Get-Sha256Hex ($tgt.source.files[0].content -replace "`r`n", "`n")) -ne $TargetLf) { throw 'Target ruleset text is not the expected Option A text. Nothing changed.' }
Write-Host "Live now: $($cur.rulesetName). Target: $Target (Option A, text verified)."

$typed = Read-Host "Type the project name ($Proj) to roll back to Option A"
if ($typed -ne $Proj) { throw 'Not confirmed. Nothing changed.' }

$body = [Text.Encoding]::UTF8.GetBytes((@{ release = @{ name = $releaseName; rulesetName = $Target }; updateMask = 'rulesetName' } | ConvertTo-Json -Depth 4))
$null = Invoke-RestMethod -Method Patch -Headers $hdr -ContentType 'application/json; charset=utf-8' -Body $body -Uri "$api/$releaseName"
$after = Invoke-RestMethod -Method Get -Headers $hdr -Uri "$api/$releaseName"
Write-Host "Release now points at $($after.rulesetName) (updated $($after.updateTime)); previous was $($cur.rulesetName)."
if ($after.rulesetName -eq $Target) { Write-Host 'DONE. Paste the lines above into the chat.' } else { Write-Host 'WARNING: read-back does not match. Paste the lines above into the chat.' }
