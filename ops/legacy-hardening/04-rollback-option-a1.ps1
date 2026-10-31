# Undo 03-deploy-option-a1.ps1: point guardentra-7f582 cloud.firestore back at Option A
# (ruleset 0f53902f..., live 2026-10-31 09:03Z). Windows PowerShell 5.1.   .\04-rollback-option-a1.ps1

$ErrorActionPreference = 'Stop'
$Project = 'guardentra-7f582'
$Previous = 'projects/guardentra-7f582/rulesets/0f53902f-dc7f-458e-90d1-9ec705a32b08'
$token = (& gcloud auth print-access-token).Trim()
$h = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Project }
$api = 'https://firebaserules.googleapis.com/v1'
$releaseName = "projects/$Project/releases/cloud.firestore"

$typed = Read-Host "Type the project name ($Project) to roll back to $Previous"
if ($typed -ne $Project) { throw 'Not confirmed. Nothing changed.' }

$body = [System.Text.Encoding]::UTF8.GetBytes((@{ release = @{ name = $releaseName; rulesetName = $Previous }; updateMask = 'rulesetName' } | ConvertTo-Json -Depth 4))
$null = Invoke-RestMethod -Method Patch -Headers $h -ContentType 'application/json; charset=utf-8' -Body $body -Uri "$api/$releaseName"
$after = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$releaseName"
Write-Host "Release now points at $($after.rulesetName) (updated $($after.updateTime))."
