# Legacy-only Firestore rules "Option A.1" for guardentra-7f582 (default). Needs a separate owner go.
# Windows PowerShell 5.1, gcloud signed in as the owner.   .\03-deploy-option-a1.ps1
#
# What it does, in order (stops at the first problem):
#   1. Checks the rules file next to this script is the reviewed one (hash).
#   2. Checks the live cloud.firestore release still points at Option A (0f53902f..., sha a0645160...).
#   3. Asks you to type the project name.
#   4. Creates a new ruleset from the file and points cloud.firestore at it.
#   5. Reads the release back and checks the live text equals the file.
# Only guardentra-7f582. Never run against guardentra-prod or staging. Does not touch data,
# Storage, the named ai-studio database or any app.
# Undo: .\04-rollback-option-a1.ps1

$ErrorActionPreference = 'Stop'
$Project = 'guardentra-7f582'
$ExpectedRuleset = 'projects/guardentra-7f582/rulesets/0f53902f-dc7f-458e-90d1-9ec705a32b08'
$OldLf = 'a06451608dc61a810a9e19e4cc926e7585e5a4b48fa091194b13d13c65e71747'  # Option A (live since 2026-10-31 09:03Z)
$NewLf = '1a4c6e1e8c1174cf8c4ccabefd2a28ef2e316fbc0bfd68b20e0fdff5e35176a5'  # Option A.1, emulator-tested

function Get-Sha256Hex([string]$text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  (($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($text)) | ForEach-Object { $_.ToString('x2') }) -join '')
}
function Lf([string]$t) { $t -replace "`r`n", "`n" }
function Send-Json($method, $uri, $obj) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 8))
  Invoke-RestMethod -Method $method -Headers $h -ContentType 'application/json; charset=utf-8' -Body $bytes -Uri $uri
}
$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$newContent = Lf (Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'firestore.rules.legacy-option-a1'))
if ((Get-Sha256Hex $newContent) -ne $NewLf) { throw 'Rules file hash does not match the reviewed file. Stopping.' }
Write-Host '1/5 Rules file OK (reviewed Option A.1).'

$token = (& gcloud auth print-access-token).Trim()
$h = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Project }
$api = 'https://firebaserules.googleapis.com/v1'
$releaseName = "projects/$Project/releases/cloud.firestore"

$rel = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$releaseName"
if ($rel.rulesetName -ne $ExpectedRuleset) { throw "Live release points at $($rel.rulesetName), not $ExpectedRuleset. Stopping; nothing changed." }
$old = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$($rel.rulesetName)"
if ((Get-Sha256Hex (Lf $old.source.files[0].content)) -ne $OldLf) { throw 'Live rules text is not Option A. Stopping; nothing changed.' }
Write-Host "2/5 Live state is Option A as expected."

$typed = Read-Host "3/5 Type the project name ($Project) to deploy Option A.1"
if ($typed -ne $Project) { throw 'Not confirmed. Nothing changed.' }

$rs = Send-Json Post "$api/projects/$Project/rulesets" @{ source = @{ files = @(@{ name = 'firestore.rules'; content = $newContent }) } }
Write-Host "4/5 Created ruleset $($rs.name). Releasing..."
$null = Send-Json Patch "$api/$releaseName" @{ release = @{ name = $releaseName; rulesetName = $rs.name }; updateMask = 'rulesetName' }

Start-Sleep -Seconds 3
$after = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$releaseName"
$live = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$($after.rulesetName)"
$liveLf = Get-Sha256Hex (Lf $live.source.files[0].content)
$result = [ordered]@{
  project = $Project; previousRuleset = $rel.rulesetName; newRuleset = $after.rulesetName
  releaseUpdateTime = $after.updateTime; liveSha256Lf = $liveLf
  matchesReviewedFile = ($liveLf -eq $NewLf -and $after.rulesetName -eq $rs.name)
  rollback = '.\04-rollback-option-a1.ps1'
}
$result | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'option-a1-deploy.json')
$result | Format-List
if ($result.matchesReviewedFile) { Write-Host '5/5 DONE. Option A.1 is live. Paste the lines above into the chat.' }
else { Write-Host '5/5 WARNING: read-back did not match. Paste the lines above; consider the rollback.' }
