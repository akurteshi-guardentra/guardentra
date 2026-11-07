# DEPLOY (CHANGES PROD, owner-gated G5): release Firestore rules "Option B" on guardentra-prod (default) ONLY.
# RUNBOOK.md section 4 step 7. Prepared 2026-10-31, NOT RUN. Windows PowerShell 5.1, gcloud as the owner.
#   .\04-DEPLOY-option-b.ps1 -ReleaseSha <full 40-char commit prod now serves>
#
# What it does, in order (stops at the first problem):
#   1. Checks firestore.rules.prod-option-b next to this script is the reviewed file (sha256 LF 015062ab...).
#   2. Checks prod /api/health reports sourceSha == -ReleaseSha. Option B breaks the old 29171a6 client
#      (vendor create), so it is refused while prod serves the old build.
#   3. Checks the live cloud.firestore release is Option A (2a30bd60, text a0645160).
#   4. Asks you to type guardentra-prod.
#   5. Creates a ruleset from the file, points cloud.firestore at it, reads it back, writes out\option-b-deploy.json.
# Never run this against guardentra-7f582 (legacy stays on Option A). Storage rules are not touched.
# Undo: .\05-ROLLBACK-option-b.ps1

param([Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ReleaseSha)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Proj = 'guardentra-prod'
$ExpectedRuleset = "projects/$Proj/rulesets/2a30bd60-c037-45e5-ae47-6ab164e2e881"
$OldLf = 'a06451608dc61a810a9e19e4cc926e7585e5a4b48fa091194b13d13c65e71747'  # Option A
$NewLf = '015062abe17653f88aae28eb92996c547f626e90aaf88caa59682c8bfa0a7571'  # Option B, 98/98 RC suite

function Get-Sha256Hex([string]$text) {
  $sha = [Security.Cryptography.SHA256]::Create()
  (($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text)) | ForEach-Object { $_.ToString('x2') }) -join '')
}
function Lf([string]$t) { $t -replace "`r`n", "`n" }
function Send-Json($method, $uri, $obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 8))
  Invoke-RestMethod -Method $method -Headers $hdr -ContentType 'application/json; charset=utf-8' -Body $bytes -Uri $uri
}
$outDir = Join-Path $PSScriptRoot 'out'; New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# 1. File
$newContent = Lf (Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'firestore.rules.prod-option-b'))
if ((Get-Sha256Hex $newContent) -ne $NewLf) { throw 'Rules file hash does not match the reviewed Option B file. Nothing changed.' }
Write-Host '1/5 Option B file OK (015062ab).'

# 2. Prod must already serve the RC release
$health = Invoke-RestMethod -Uri 'https://guardentra.com/api/health' -TimeoutSec 30
if ($health.release.sourceSha -ne $ReleaseSha -or $health.release.projectId -ne $Proj) { throw "guardentra.com reports sourceSha=$($health.release.sourceSha) projectId=$($health.release.projectId), not $ReleaseSha on $Proj. Option B would break the old client. Nothing changed." }
Write-Host "2/5 guardentra.com serves $ReleaseSha."

$token = (& gcloud auth print-access-token).Trim()
$hdr = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Proj }
$api = 'https://firebaserules.googleapis.com/v1'
$releaseName = "projects/$Proj/releases/cloud.firestore"

# 3. Live rules must be Option A
$rel = Invoke-RestMethod -Method Get -Headers $hdr -Uri "$api/$releaseName"
if ($rel.rulesetName -ne $ExpectedRuleset) { throw "Live release points at $($rel.rulesetName), not Option A $ExpectedRuleset. Nothing changed." }
$old = Invoke-RestMethod -Method Get -Headers $hdr -Uri "$api/$($rel.rulesetName)"
if ((Get-Sha256Hex (Lf $old.source.files[0].content)) -ne $OldLf) { throw 'Live rules text is not Option A. Nothing changed.' }
Write-Host '3/5 Live rules are Option A.'

# 4. Confirm
$typed = Read-Host "4/5 Type the project name ($Proj) to release Option B"
if ($typed -ne $Proj) { throw 'Not confirmed. Nothing changed.' }

# 5. Create + release + read back
$rs = Send-Json Post "$api/projects/$Proj/rulesets" @{ source = @{ files = @(@{ name = 'firestore.rules'; content = $newContent }) } }
$null = Send-Json Patch "$api/$releaseName" @{ release = @{ name = $releaseName; rulesetName = $rs.name }; updateMask = 'rulesetName' }
Start-Sleep -Seconds 3
$after = Invoke-RestMethod -Method Get -Headers $hdr -Uri "$api/$releaseName"
$live = Invoke-RestMethod -Method Get -Headers $hdr -Uri "$api/$($after.rulesetName)"
$liveLf = Get-Sha256Hex (Lf $live.source.files[0].content)
$result = [ordered]@{
  project = $Proj; releaseSha = $ReleaseSha
  previousRuleset = $rel.rulesetName; newRuleset = $after.rulesetName; releaseUpdateTime = $after.updateTime
  liveSha256Lf = $liveLf; matchesReviewedFile = ($liveLf -eq $NewLf -and $after.rulesetName -eq $rs.name)
  rollback = '.\05-ROLLBACK-option-b.ps1'
}
$result | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $outDir 'option-b-deploy.json')
$result | Format-List
if ($result.matchesReviewedFile) { Write-Host '5/5 DONE. Option B is live on guardentra-prod. Run smoke Phase B (RUNBOOK 5.2).' }
else { Write-Host '5/5 WARNING: read-back did not match. Paste the lines above into the chat; consider .\05-ROLLBACK-option-b.ps1.' }
