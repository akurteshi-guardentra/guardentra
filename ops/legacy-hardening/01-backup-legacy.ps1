# Legacy guardentra-7f582: one-off backup of Firestore (default) + Storage files.
# Needs a separate owner go (it creates a bucket and costs a few cents/month).
# Windows PowerShell 5.1, gcloud signed in as the owner.
#   .\01-backup-legacy.ps1                      (default bucket name below)
#   .\01-backup-legacy.ps1 -Bucket <other-name> (if the name is taken)
#
# What it does, in order (stops at the first problem):
#   1. Shows the plan and asks you to type the project name.
#   2. Creates a NEW private bucket in US (same multi-region as Firestore nam5):
#      uniform access, public access prevention enforced. Fails if it already exists.
#   3. Firestore managed export of (default) to gs://<bucket>/firestore-<stamp>/ (waits for it).
#   4. Copies every object of gs://guardentra-7f582.firebasestorage.app to gs://<bucket>/storage-<stamp>/.
#   5. Read-back: export metadata present; Storage object counts source vs copy.
# It never writes to the live database or the live Storage bucket.
# Undo: delete the backup bucket in the console (Cloud Storage -> Buckets). That is permanent.

param([string]$Bucket = 'guardentra-7f582-legacy-backup-20261031')

$ErrorActionPreference = 'Stop'
$Project = 'guardentra-7f582'
$Source = 'gs://guardentra-7f582.firebasestorage.app'
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force -Path $out | Out-Null
function Invoke-G([string[]]$GArgs) {
  & gcloud @GArgs
  if ($LASTEXITCODE -ne 0) { throw "gcloud $($GArgs -join ' ') failed (exit $LASTEXITCODE). Stopping." }
}

Write-Host "Plan: new bucket gs://$Bucket (US, private) <- Firestore export + copy of $Source"
$typed = Read-Host "1/5 Type the project name ($Project) to create the backup"
if ($typed -ne $Project) { throw 'Not confirmed. Nothing changed.' }

Invoke-G @('storage', 'buckets', 'create', "gs://$Bucket", "--project=$Project", '--location=US',
  '--uniform-bucket-level-access', '--public-access-prevention')
Write-Host "2/5 Created gs://$Bucket"

$fsPrefix = "gs://$Bucket/firestore-$stamp"
Invoke-G @('firestore', 'export', $fsPrefix, '--database=(default)', "--project=$Project")
Write-Host "3/5 Firestore export finished: $fsPrefix"

$srcObjects = @(& gcloud storage ls --recursive "$Source/**" --project=$Project 2>$null | Where-Object { $_ -and -not $_.EndsWith('/') -and -not $_.EndsWith(':') })
if ($srcObjects.Count -gt 0) {
  Invoke-G @('storage', 'cp', '--recursive', "$Source/*", "gs://$Bucket/storage-$stamp/", "--project=$Project")
}
Write-Host "4/5 Storage copy finished ($($srcObjects.Count) source objects)"

$meta = @(& gcloud storage ls "$fsPrefix/**" --project=$Project 2>$null | Where-Object { $_ -like '*overall_export_metadata' })
$copied = @(& gcloud storage ls --recursive "gs://$Bucket/storage-$stamp/**" --project=$Project 2>$null | Where-Object { $_ -and -not $_.EndsWith('/') -and -not $_.EndsWith(':') })
$result = [ordered]@{
  project = $Project; bucket = "gs://$Bucket"; firestoreExport = $fsPrefix
  exportMetadataFound = ($meta.Count -ge 1)
  storageSourceObjects = $srcObjects.Count; storageCopiedObjects = $copied.Count
  storageCountsMatch = ($srcObjects.Count -eq $copied.Count)
  finishedUtc = (Get-Date).ToUniversalTime().ToString('o')
}
$result | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'backup-result.json')
$result | Format-List
if ($result.exportMetadataFound -and $result.storageCountsMatch) { Write-Host '5/5 DONE. Paste the lines above into the chat.' }
else { Write-Host '5/5 WARNING: read-back incomplete. Paste the lines above into the chat. Do not proceed to the next step.' }
