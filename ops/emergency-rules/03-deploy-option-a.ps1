# P0 emergency Firestore rules deploy (Option A), owner-approved 2026-10-31 for the
# (default) database of guardentra-prod and guardentra-7f582 only.
# Windows PowerShell 5.1. Run once per project:
#   .\03-deploy-option-a.ps1 -Project guardentra-prod
#   .\03-deploy-option-a.ps1 -Project guardentra-7f582
#
# What it does, in order (stops at the first problem):
#   1. Checks the rules file next to this script is the reviewed one (hash).
#   2. Checks the project's live cloud.firestore release still points at the expected
#      old ruleset with the expected old text. If anything changed since 2026-10-30, it stops.
#   3. Asks you to type the project name to confirm.
#   4. Creates a new ruleset from the file and points cloud.firestore at it.
#   5. Reads the release back and checks the live text equals the file.
# It does not touch data, Storage, the named ai-studio database, or any app.
# Undo: .\04-rollback.ps1 -Project <same project>

param([Parameter(Mandatory = $true)][ValidateSet('guardentra-prod', 'guardentra-7f582')][string]$Project)

$ErrorActionPreference = 'Stop'
$Expected = @{
  'guardentra-prod'  = 'projects/guardentra-prod/rulesets/2e9c308d-9889-4b16-8d55-63b4c77e5ce4'
  'guardentra-7f582' = 'projects/guardentra-7f582/rulesets/c12a5117-1675-4775-b25b-ca463b36e7dc'
}
$OldLf = '873071e1b3a193d3d1416afe694cd4bfbcfd49caf4c04deb76d2b682db377c84'  # 85f718d
$NewLf = 'a06451608dc61a810a9e19e4cc926e7585e5a4b48fa091194b13d13c65e71747'  # option-a, reviewed + emulator-tested

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

# 1. Local file
$file = Join-Path $PSScriptRoot 'firestore.rules.prod-option-a'
$newContent = Lf (Get-Content -Raw -Encoding UTF8 $file)
if ((Get-Sha256Hex $newContent) -ne $NewLf) { throw "Rules file hash does not match the reviewed file. Stopping." }
Write-Host "1/5 Rules file OK (reviewed version)."

$token = (& gcloud auth print-access-token).Trim()
$h = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Project }
$api = 'https://firebaserules.googleapis.com/v1'
$releaseName = "projects/$Project/releases/cloud.firestore"

# 2. Live state must be exactly what we verified on 2026-10-30
$rel = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$releaseName"
if ($rel.rulesetName -ne $Expected[$Project]) { throw "Live release now points at $($rel.rulesetName), not the expected $($Expected[$Project]). Stopping; nothing changed." }
$old = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$($rel.rulesetName)"
if ((Get-Sha256Hex (Lf $old.source.files[0].content)) -ne $OldLf) { throw "Live rules text is not the expected old text. Stopping; nothing changed." }
Write-Host "2/5 Live state is as expected ($($rel.rulesetName))."

# 3. Confirm
$typed = Read-Host "3/5 Type the project name ($Project) to deploy the new rules"
if ($typed -ne $Project) { throw "Not confirmed. Nothing changed." }

# 4. Create ruleset and release it
$rs = Send-Json Post "$api/projects/$Project/rulesets" @{ source = @{ files = @(@{ name = 'firestore.rules'; content = $newContent }) } }
Write-Host "4/5 Created ruleset $($rs.name). Releasing..."
$null = Send-Json Patch "$api/$releaseName" @{ release = @{ name = $releaseName; rulesetName = $rs.name }; updateMask = 'rulesetName' }

# 5. Read back
Start-Sleep -Seconds 3
$after = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$releaseName"
$live = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$($after.rulesetName)"
$liveLf = Get-Sha256Hex (Lf $live.source.files[0].content)
$result = [ordered]@{
  project = $Project
  previousRuleset = $rel.rulesetName
  newRuleset = $after.rulesetName
  releaseUpdateTime = $after.updateTime
  liveSha256Lf = $liveLf
  matchesReviewedFile = ($liveLf -eq $NewLf -and $after.rulesetName -eq $rs.name)
  rollback = ".\04-rollback.ps1 -Project $Project"
}
$result | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out "$Project-deploy.json")
$result | Format-List
if ($result.matchesReviewedFile) { Write-Host "5/5 DONE. New rules are live. Paste the lines above into the chat." }
else { Write-Host "5/5 WARNING: read-back did not match. Paste the lines above into the chat; consider running the rollback." }
