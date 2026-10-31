# Undo 01-create-indexes.ps1: delete ONLY the indexes that run created, as listed in its out\ file.
# Needs a separate owner go. Windows PowerShell 5.1, gcloud signed in as the owner.
#
#   .\02-rollback-indexes.ps1 -Project guardentra-prod -CreatedFile .\out\indexes-created-guardentra-prod-<stamp>.json
#
# Deleting an index never deletes documents. Queries that need it fail again with
# FAILED_PRECONDITION ("requires an index"), which is how prod and legacy behave today.
# It refuses any index name that is not under the given project's (default) database.

param(
  [Parameter(Mandatory = $true)][ValidateSet('guardentra-prod', 'guardentra-7f582')][string]$Project,
  [Parameter(Mandatory = $true)][string]$CreatedFile
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$rec = Get-Content -Raw $CreatedFile | ConvertFrom-Json
if ($rec.project -ne $Project) { throw "$CreatedFile is for $($rec.project), not $Project. Nothing changed." }
$prefix = "projects/$Project/databases/(default)/collectionGroups/"
$names = @($rec.created | ForEach-Object { $_.index } | Where-Object { $_ })
foreach ($n in $names) { if (-not $n.StartsWith($prefix)) { throw "Unexpected index name $n. Nothing changed." } }
if ($names.Count -eq 0) { Write-Host 'The file lists no created indexes. Nothing to do.'; return }

$token = (& gcloud auth print-access-token).Trim()
$h = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Project }

Write-Host "1/3 Will delete $($names.Count) index(es) on $Project (default):"
foreach ($n in $names) {
  try { $i = Invoke-RestMethod -Method Get -Headers $h -Uri "https://firestore.googleapis.com/v1/$n"; Write-Host "     $n ($($i.state))" }
  catch { Write-Host "     $n (not found now)" }
}
$typed = Read-Host "2/3 Type the project name ($Project) to delete them"
if ($typed -ne $Project) { throw 'Not confirmed. Nothing changed.' }

$rows = foreach ($n in $names) {
  try { $null = Invoke-RestMethod -Method Delete -Headers $h -Uri "https://firestore.googleapis.com/v1/$n"; $r = 'deleted' }
  catch { $r = "failed: $($_.ErrorDetails.Message)" }
  $gone = $false
  try { $null = Invoke-RestMethod -Method Get -Headers $h -Uri "https://firestore.googleapis.com/v1/$n" } catch { $gone = $true }
  [pscustomobject]@{ index = $n; result = $r; goneOnReadBack = $gone }
}
$rows | Format-Table -AutoSize
$rows | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path (Split-Path $CreatedFile) "indexes-rollback-$Project.json")
Write-Host '3/3 Paste the lines above into the chat.'
