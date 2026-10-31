# Create the missing Firestore composite indexes on guardentra-prod or guardentra-7f582 (legacy).
# Needs a separate owner go for each project. Windows PowerShell 5.1, gcloud signed in as the owner.
#
#   .\01-create-indexes.ps1 -Project guardentra-prod  -Set running   # the 4 that prod 29171a6 needs today
#   .\01-create-indexes.ps1 -Project guardentra-7f582 -Set running   # the 4 that legacy 7b914ee needs today
#   .\01-create-indexes.ps1 -Project guardentra-prod  -Set rc        # all 8 the RC needs, AT PROMOTION ONLY
#
# Sets:
#   running = indexes.running-29171a6-7b914ee.json (byte-identical firestore.indexes.json of both live builds)
#   rc      = indexes.rc-caf2709.json (firestore.indexes.json of release/rc-2026-10-08 @ caf2709).
#             Superset of 'running'. Only allowed for guardentra-prod.
#
# What it does, in order (stops at the first problem):
#   1. Checks the index file's SHA-256 (line endings normalised to LF) against the value below.
#   2. Lists the live composite indexes on (default) and works out which ones are missing.
#   3. Shows the plan and asks you to type the project name.
#   4. Creates only the missing ones (Firestore Admin API). It never deletes or changes an index,
#      and never touches rules, data, Auth or App Hosting.
#   5. Saves what it created to out\indexes-created-<project>-<stamp>.json and reads the list back.
# Indexes build in the background (minutes). Run it again later: it then only reads back and says "nothing to do".
# Undo: .\02-rollback-indexes.ps1 -Project <project> -CreatedFile out\indexes-created-<...>.json
#       (deletes only what this script created; queries that need them fail again as they do today).

param(
  [Parameter(Mandatory = $true)][ValidateSet('guardentra-prod', 'guardentra-7f582')][string]$Project,
  [Parameter(Mandatory = $true)][ValidateSet('running', 'rc')][string]$Set
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$files = @{
  running = @{ name = 'indexes.running-29171a6-7b914ee.json'; sha = 'fea694e87733801e1eb5f1f98a7fe1119215f00ca79205ce5fed6ea664b83918' }
  rc      = @{ name = 'indexes.rc-caf2709.json';              sha = 'f2d695c074d4c5307659823c88e5815af6f5f79f08ea411cd3f748e0f4127532' }
}
if ($Set -eq 'rc' -and $Project -ne 'guardentra-prod') { throw "Set 'rc' is only for guardentra-prod. Nothing changed." }

$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')

# 1. File integrity (LF-normalised, so a Windows CRLF checkout hashes the same as GitHub).
$path = Join-Path $PSScriptRoot $files[$Set].name
$text = [IO.File]::ReadAllText($path) -replace "`r`n", "`n"
$sha = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.UTF8Encoding]::new($false).GetBytes($text))).Replace('-', '').ToLower()
if ($sha -ne $files[$Set].sha) { throw "SHA-256 mismatch for $($files[$Set].name): $sha. Nothing changed." }
$wanted = @(($text | ConvertFrom-Json).indexes)
Write-Host "1/5 $($files[$Set].name) sha256 OK ($($wanted.Count) indexes)."

$account = (& gcloud config get-value account 2>$null)
$token = (& gcloud auth print-access-token).Trim()
if (-not $token) { throw 'gcloud is not signed in. Nothing changed.' }
$h = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Project }
$base = "https://firestore.googleapis.com/v1/projects/$Project/databases/(default)"

function Get-Key($cg, $scope, $fields) {
  $f = @($fields | Where-Object { $_.fieldPath -ne '__name__' } | ForEach-Object {
      if ($_.order) { "$($_.fieldPath):$($_.order)" } else { "$($_.fieldPath):array=$($_.arrayConfig)" } })
  "$cg|$scope|$($f -join ',')"
}
function Get-LiveIndexes {
  $all = @(); $pageToken = $null
  do {
    $u = "$base/collectionGroups/-/indexes?pageSize=200"
    if ($pageToken) { $u += "&pageToken=$pageToken" }
    $r = Invoke-RestMethod -Method Get -Headers $h -Uri $u
    if ($r.indexes) { $all += $r.indexes }
    $pageToken = $r.nextPageToken
  } while ($pageToken)
  foreach ($i in $all) {
    $cg = ($i.name -split '/collectionGroups/')[1].Split('/')[0]
    [pscustomobject]@{ key = (Get-Key $cg $i.queryScope $i.fields); name = $i.name; state = $i.state }
  }
}

# 2. Live state.
$live = @(Get-LiveIndexes)
$liveKeys = @{}; foreach ($l in $live) { $liveKeys[$l.key] = $l }
$missing = @($wanted | Where-Object { -not $liveKeys.ContainsKey((Get-Key $_.collectionGroup $_.queryScope $_.fields)) })
Write-Host "2/5 $Project (default) as $account : $($live.Count) composite indexes live, $($missing.Count) of $($wanted.Count) missing."
foreach ($w in $wanted) {
  $k = Get-Key $w.collectionGroup $w.queryScope $w.fields
  $s = if ($liveKeys.ContainsKey($k)) { "present ($($liveKeys[$k].state))" } else { 'MISSING' }
  Write-Host ("     {0,-60} {1}" -f $k, $s)
}
if ($missing.Count -eq 0) { Write-Host 'Nothing to do. Paste the lines above into the chat.'; return }

# 3. Confirm.
$typed = Read-Host "3/5 Type the project name ($Project) to create the $($missing.Count) missing index(es)"
if ($typed -ne $Project) { throw 'Not confirmed. Nothing changed.' }

# 4. Create (only the missing ones).
$created = @()
foreach ($m in $missing) {
  $body = @{ queryScope = $m.queryScope; fields = @($m.fields) } | ConvertTo-Json -Depth 6
  try {
    $op = Invoke-RestMethod -Method Post -Headers $h -ContentType 'application/json; charset=utf-8' `
      -Body ([Text.Encoding]::UTF8.GetBytes($body)) -Uri "$base/collectionGroups/$($m.collectionGroup)/indexes"
    $created += [ordered]@{ key = (Get-Key $m.collectionGroup $m.queryScope $m.fields); index = $op.metadata.index; operation = $op.name }
    Write-Host "4/5 Requested $($m.collectionGroup) -> $($op.metadata.index)"
  } catch {
    Write-Host "4/5 FAILED $($m.collectionGroup): $($_.ErrorDetails.Message)"
  }
}
$createdFile = Join-Path $out "indexes-created-$Project-$stamp.json"
[ordered]@{ project = $Project; set = $Set; file = $files[$Set].name; sha256 = $sha; created = $created } |
  ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $createdFile

# 5. Read back.
Start-Sleep -Seconds 5
$after = @(Get-LiveIndexes)
$afterKeys = @{}; foreach ($l in $after) { $afterKeys[$l.key] = $l }
$rows = foreach ($w in $wanted) {
  $k = Get-Key $w.collectionGroup $w.queryScope $w.fields
  [pscustomobject]@{ index = $k; state = $(if ($afterKeys.ContainsKey($k)) { $afterKeys[$k].state } else { 'MISSING' }) }
}
$rows | Format-Table -AutoSize
$result = [ordered]@{
  project = $Project; set = $Set; requested = $missing.Count; created = $created.Count
  allPresent = (@($rows | Where-Object { $_.state -eq 'MISSING' }).Count -eq 0)
  ready = @($rows | Where-Object { $_.state -eq 'READY' }).Count; wanted = $wanted.Count
  createdFile = $createdFile
  undo = ".\02-rollback-indexes.ps1 -Project $Project -CreatedFile `"$createdFile`""
}
$result | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out "indexes-result-$Project-$stamp.json")
$result | Format-List
Write-Host '5/5 CREATING means it is still building. Run the same command again later to confirm READY. Paste the lines above into the chat.'
