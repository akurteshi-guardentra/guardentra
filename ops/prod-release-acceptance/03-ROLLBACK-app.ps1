# ROLLBACK (CHANGES PROD, owner-gated): re-serve the existing prod build build-2026-08-27-001 (29171a6).
# RUNBOOK.md section 6 step 2. Prepared 2026-10-31, NOT RUN. Windows PowerShell 5.1, gcloud as the owner.
#   .\03-ROLLBACK-app.ps1
#
# What it does, in order (stops at the first problem):
#   1. Refuses if Firestore rules are not Option A (2a30bd60). Option B breaks 29171a6, so run
#      .\05-ROLLBACK-option-b.ps1 first.
#   2. Checks build-2026-08-27-001 still exists, is READY and was built from 29171a6.
#   3. Asks the API to validate the rollout (validateOnly=true; changes nothing).
#   4. Asks you to type guardentra-prod.
#   5. Creates a rollout of that EXISTING build (no rebuild, so the old build's own config is kept),
#      waits for it, reads traffic and /api/health back, writes out\rollback-app-<stamp>.json.
# Never roll back by rebuilding 29171a6 from git: that commit has only apphosting.yaml, and a fresh
# build loses the VITE_* identifiers (blank /login, as on legacy).
# Undo: roll the pinned release forward again (RUNBOOK section 4 step 3).

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Proj = 'guardentra-prod'
$Backend = "projects/$Proj/locations/us-central1/backends/guardentra-prod"
$TargetBuild = "$Backend/builds/build-2026-08-27-001"
$TargetShaPrefix = '29171a6'
$OptionARuleset = "projects/$Proj/rulesets/2a30bd60-c037-45e5-ae47-6ab164e2e881"
$ah = 'https://firebaseapphosting.googleapis.com/v1'

$outDir = Join-Path $PSScriptRoot 'out'; New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$rolloutId = 'rollback-29171a6-' + $stamp.ToLower()

$token = (& gcloud auth print-access-token).Trim()
if (-not $token) { throw 'gcloud is not signed in. Nothing changed.' }
$hdr = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Proj }
function Send-Json($method, $uri, $obj) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 6))
  Invoke-RestMethod -Method $method -Headers $hdr -ContentType 'application/json; charset=utf-8' -Body $bytes -Uri $uri
}

# 1. Rules must be Option A
$rel = Invoke-RestMethod -Headers $hdr -Uri "https://firebaserules.googleapis.com/v1/projects/$Proj/releases/cloud.firestore"
if ($rel.rulesetName -ne $OptionARuleset) { throw "Firestore rules are $($rel.rulesetName), not Option A. Run .\05-ROLLBACK-option-b.ps1 first. Nothing changed." }
Write-Host "1/5 Rules are Option A ($OptionARuleset)."

# 2. Target build
$b = Invoke-RestMethod -Headers $hdr -Uri "$ah/$TargetBuild"
if ($b.state -ne 'READY' -or -not ("$($b.source.codebase.hash)" -like "$TargetShaPrefix*")) { throw "Target build state=$($b.state) hash=$($b.source.codebase.hash). Not the expected READY 29171a6 build. Nothing changed." }
$before = Invoke-RestMethod -Headers $hdr -Uri "$ah/$Backend/traffic"
Write-Host "2/5 Target $TargetBuild READY @ $($b.source.codebase.hash). Current traffic: $(($before.current.splits | ForEach-Object { "$($_.build -replace '.*/builds/','') $($_.percent)%" }) -join ', ')"

# 3. Validate only
$null = Send-Json Post "$ah/$Backend/rollouts?rolloutId=$rolloutId&validateOnly=true" @{ build = $TargetBuild }
Write-Host "3/5 Rollout request validated by the API (nothing changed yet)."

# 4. Confirm
$typed = Read-Host "4/5 Type the project name ($Proj) to roll prod back to 29171a6"
if ($typed -ne $Proj) { throw 'Not confirmed. Nothing changed.' }

# 5. Roll out the existing build, wait, read back
$null = Send-Json Post "$ah/$Backend/rollouts?rolloutId=$rolloutId" @{ build = $TargetBuild }
Write-Host "5/5 Rollout $rolloutId created. Waiting (up to 10 min)..."
$state = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 10
  try { $ro = Invoke-RestMethod -Headers $hdr -Uri "$ah/$Backend/rollouts/$rolloutId"; $state = $ro.state } catch { $state = "read error: $($_.Exception.Message)" }
  Write-Host "     $state"
  if ($state -eq 'SUCCEEDED' -or $state -eq 'FAILED' -or $state -eq 'CANCELLED') { break }
}
$after = Invoke-RestMethod -Headers $hdr -Uri "$ah/$Backend/traffic"
$health = $null; try { $health = Invoke-RestMethod -Uri 'https://guardentra.com/api/health' -TimeoutSec 30 } catch { $health = "ERROR $($_.Exception.Message)" }
$bundle = $null; try { $bundle = ([regex]::Match((Invoke-WebRequest -UseBasicParsing -Uri 'https://guardentra.com/' -TimeoutSec 30).Content, 'src="(/assets/[^"]+\.js)"')).Groups[1].Value } catch {}
$result = [ordered]@{
  rolloutId = $rolloutId; state = $state
  trafficBefore = $before.current.splits; trafficAfter = $after.current.splits
  health = $health; bundle = $bundle; expectedBundle = '/assets/index-BU4Du5f7.js'
}
$result | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 (Join-Path $outDir "rollback-app-$stamp.json")
$result | ConvertTo-Json -Depth 8
if ($state -eq 'SUCCEEDED' -and $bundle -eq '/assets/index-BU4Du5f7.js') { Write-Host 'DONE: prod serves 29171a6 again. Paste the lines above into the chat.' }
else { Write-Host 'CHECK: rollout did not clearly succeed. Paste the lines above into the chat; use the console (App Hosting > Rollouts) if needed.' }
