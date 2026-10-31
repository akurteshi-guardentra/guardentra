# Undo 03-deploy-option-a.ps1: point cloud.firestore back at the ruleset that was live
# before 2026-10-31. Windows PowerShell 5.1.
#   .\04-rollback.ps1 -Project guardentra-prod   (or guardentra-7f582)

param([Parameter(Mandatory = $true)][ValidateSet('guardentra-prod', 'guardentra-7f582')][string]$Project)

$ErrorActionPreference = 'Stop'
$Previous = @{
  'guardentra-prod'  = 'projects/guardentra-prod/rulesets/2e9c308d-9889-4b16-8d55-63b4c77e5ce4'
  'guardentra-7f582' = 'projects/guardentra-7f582/rulesets/c12a5117-1675-4775-b25b-ca463b36e7dc'
}
$token = (& gcloud auth print-access-token).Trim()
$h = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Project }
$api = 'https://firebaserules.googleapis.com/v1'
$releaseName = "projects/$Project/releases/cloud.firestore"

$typed = Read-Host "Type the project name ($Project) to roll back to $($Previous[$Project])"
if ($typed -ne $Project) { throw "Not confirmed. Nothing changed." }

$body = [System.Text.Encoding]::UTF8.GetBytes((@{ release = @{ name = $releaseName; rulesetName = $Previous[$Project] }; updateMask = 'rulesetName' } | ConvertTo-Json -Depth 4))
$null = Invoke-RestMethod -Method Patch -Headers $h -ContentType 'application/json; charset=utf-8' -Body $body -Uri "$api/$releaseName"
$after = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$releaseName"
Write-Host "Release now points at $($after.rulesetName) (updated $($after.updateTime))."
