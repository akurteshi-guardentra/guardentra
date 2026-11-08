# P0 (owner decision 2026-10-31): lock the legacy AI Studio named database with deny-all
# rules. Only touches release cloud.firestore/<named db> in guardentra-7f582.
# Windows PowerShell 5.1.
#   .\05-lock-ai-studio-db.ps1            lock (checks live state first, asks to confirm)
#   .\05-lock-ai-studio-db.ps1 -Rollback  put the July rules (546970cd) back

param([switch]$Rollback)

$ErrorActionPreference = 'Stop'
$Project = 'guardentra-7f582'
$Db = 'ai-studio-guardentra-0c572bb5-3c5a-4cab-8963-fb0921691f79'
$OldRuleset = "projects/$Project/rulesets/546970cd-d45f-48c0-85c3-5cf73c0016b2"
$OldLf = 'f6fde115e5351b672b3ae7cff6cc8c2d3d165926aef91f318ffb5d0333c2d326'  # 59d1485
$NewLf = '3f98719198de4433d1005c41db1b937890518d0033cc50ea87b761947af67335'  # deny-all

function Get-Sha256Hex([string]$text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  (($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($text)) | ForEach-Object { $_.ToString('x2') }) -join '')
}
function Lf([string]$t) { $t -replace "`r`n", "`n" }
function Send-Json($method, $uri, $obj) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 8))
  Invoke-RestMethod -Method $method -Headers $h -ContentType 'application/json; charset=utf-8' -Body $bytes -Uri $uri
}

$token = (& gcloud auth print-access-token).Trim()
$h = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Project }
$api = 'https://firebaserules.googleapis.com/v1'
$releaseName = "projects/$Project/releases/cloud.firestore/$Db"

if ($Rollback) {
  $typed = Read-Host "Type the database name ($Db) to restore the July rules"
  if ($typed -ne $Db) { throw "Not confirmed. Nothing changed." }
  $null = Send-Json Patch "$api/$releaseName" @{ release = @{ name = $releaseName; rulesetName = $OldRuleset }; updateMask = 'rulesetName' }
  $after = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$releaseName"
  Write-Host "Release now points at $($after.rulesetName) (updated $($after.updateTime))."
  return
}

# 1. Local file
$newContent = Lf (Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'firestore.rules.ai-studio-deny-all'))
if ((Get-Sha256Hex $newContent) -ne $NewLf) { throw "Rules file hash does not match the reviewed file. Stopping." }
Write-Host "1/5 Rules file OK (deny-all)."

# 2. Live state must be what we verified on 2026-10-30
$rel = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$releaseName"
if ($rel.rulesetName -ne $OldRuleset) { throw "Live release now points at $($rel.rulesetName), not $OldRuleset. Stopping; nothing changed." }
$old = Invoke-RestMethod -Method Get -Headers $h -Uri "$api/$($rel.rulesetName)"
if ((Get-Sha256Hex (Lf $old.source.files[0].content)) -ne $OldLf) { throw "Live rules text is not the expected July text. Stopping; nothing changed." }
Write-Host "2/5 Live state is as expected ($($rel.rulesetName))."

# 3. Confirm
$typed = Read-Host "3/5 Type the project name ($Project) to lock the AI Studio database"
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
  release = $releaseName
  previousRuleset = $rel.rulesetName
  newRuleset = $after.rulesetName
  releaseUpdateTime = $after.updateTime
  liveSha256Lf = $liveLf
  matchesReviewedFile = ($liveLf -eq $NewLf -and $after.rulesetName -eq $rs.name)
  rollback = '.\05-lock-ai-studio-db.ps1 -Rollback'
}
$result | Format-List
if ($result.matchesReviewedFile) { Write-Host "5/5 DONE. AI Studio database is locked. Paste the lines above into the chat." }
else { Write-Host "5/5 WARNING: read-back did not match. Paste the lines above into the chat; consider -Rollback." }
