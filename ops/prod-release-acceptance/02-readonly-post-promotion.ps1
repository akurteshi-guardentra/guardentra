# READ-ONLY readback after the prod rollout (RUNBOOK.md section 4 step 5). Prepared 2026-10-31.
#   .\02-readonly-post-promotion.ps1 -ReleaseSha <full 40-char commit that was rolled out>
#   .\02-readonly-post-promotion.ps1 -ReleaseSha <sha> -ExpectOptionB   # after G5
# Only HTTP GETs (App Hosting, Rules API, the public site). Nothing is changed.
# Windows PowerShell 5.1, gcloud signed in as the owner. Output: .\out\post-promotion-<sha>.json
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ReleaseSha,
  [switch]$ExpectOptionB
)
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$outDir = Join-Path $root 'out'; New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$Proj = 'guardentra-prod'
$Backend = "projects/$Proj/locations/us-central1/backends/guardentra-prod"
$OptionARuleset = "projects/$Proj/rulesets/2a30bd60-c037-45e5-ae47-6ab164e2e881"
$OptionALf = 'a06451608dc61a810a9e19e4cc926e7585e5a4b48fa091194b13d13c65e71747'
$OptionBLf = '015062abe17653f88aae28eb92996c547f626e90aaf88caa59682c8bfa0a7571'
$Origins = @('https://guardentra.com', 'https://guardentra-prod--guardentra-prod.us-central1.hosted.app')

$token = (& gcloud auth print-access-token 2>$null)
if (-not $token) { 'NO ACCESS TOKEN - run: gcloud auth login'; return }
$hdr = @{ Authorization = "Bearer $($token.Trim())"; 'x-goog-user-project' = $Proj }
function Get-Api($uri) { try { Invoke-RestMethod -Method Get -Uri $uri -Headers $hdr -ErrorAction Stop } catch { [pscustomobject]@{ apiError = $_.Exception.Message } } }
function Get-Sha256Lf([string]$t) { $s = [Security.Cryptography.SHA256]::Create(); (($s.ComputeHash([Text.UTF8Encoding]::new($false).GetBytes(($t -replace "`r`n", "`n"))) | ForEach-Object { $_.ToString('x2') }) -join '') }
$Results = New-Object System.Collections.ArrayList
function Add-Check([string]$id, [string]$name, [bool]$ok, $detail) {
  $st = if ($ok) { 'PASS' } else { 'FAIL' }
  $null = $Results.Add([ordered]@{ id = $id; check = $name; status = $st; detail = $detail })
  Write-Host ("[{0}] {1,-4} {2}" -f $st, $id, $name)
}
function Get-Web([string]$uri, [hashtable]$headers) {
  try { Invoke-WebRequest -UseBasicParsing -Uri $uri -Headers $headers -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction Stop }
  catch { if ($_.Exception.Response) { $_.Exception.Response } else { $null } }
}

# R1 App Hosting: traffic on a READY build of the SHA
$tr = Get-Api "https://firebaseapphosting.googleapis.com/v1/$Backend/traffic"
$split = @($tr.current.splits)
$bname = if ($split.Count -eq 1 -and [int]$split[0].percent -eq 100) { $split[0].build }
$b = if ($bname) { Get-Api "https://firebaseapphosting.googleapis.com/v1/$bname" }
Add-Check 'R1' 'Traffic 100% on one READY build whose source hash == SHA' ($b.state -eq 'READY' -and $b.source.codebase.hash -eq $ReleaseSha) @{ splits = $split; build = $bname; state = $b.state; hash = $b.source.codebase.hash; rolloutPolicy = $tr.rolloutPolicy }

# R2 release identity on both origins
foreach ($o in $Origins) {
  $hh = $null; try { $hh = Invoke-RestMethod -Uri "$o/api/health" -TimeoutSec 30 } catch {}
  Add-Check 'R2' "$o /api/health: production / guardentra-prod / sourceSha == SHA" ($hh.release.environment -eq 'production' -and $hh.release.projectId -eq 'guardentra-prod' -and $hh.release.sourceSha -eq $ReleaseSha) $hh
}

# R3 bundle isolation (only the prod Firebase project is compiled in)
$landing = Get-Web 'https://guardentra.com/' @{}
$js = ([regex]::Match("$($landing.Content)", 'src="(/assets/[^"]+\.js)"')).Groups[1].Value
$ids = @(); $auths = @()
if ($js) {
  $c = (Invoke-WebRequest -UseBasicParsing -Uri "https://guardentra.com$js" -TimeoutSec 60).Content
  $ids = @([regex]::Matches($c, 'projectId:"([a-z0-9-]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
  $auths = @([regex]::Matches($c, '"?authDomain"?:"([a-z0-9.-]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
  $leak = @('guardentra-staging', 'guardentra-7f582') | Where-Object { $c -match [regex]::Escape($_) }
}
Add-Check 'R3' 'Bundle has projectId guardentra-prod only, no staging/legacy ids' (($ids -join ',') -eq 'guardentra-prod' -and @($leak).Count -eq 0) @{ bundle = $js; projectIds = $ids; authDomains = $auths; otherProjectStrings = @($leak) }

# R4 security headers + security.txt
$hd = $landing.Headers
$need = 'Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Content-Security-Policy', 'Referrer-Policy'
$missingHdr = @($need | Where-Object { -not $hd[$_] })
Add-Check 'R4' 'Security headers present, no X-Powered-By' ($missingHdr.Count -eq 0 -and -not $hd['X-Powered-By']) @{ missing = $missingHdr; xPoweredBy = $hd['X-Powered-By'] }
$sec = Get-Web 'https://guardentra.com/.well-known/security.txt' @{}
Add-Check 'R4b' 'security.txt is text/plain with Canonical https://guardentra.com' ("$($sec.Headers['Content-Type'])" -like 'text/plain*' -and "$($sec.Content)" -match 'Canonical: https://guardentra\.com/\.well-known/security\.txt') @{ contentType = $sec.Headers['Content-Type'] }

# R5 CORS (PUBLIC_APP_URL drives the allowlist)
$evil = Get-Web 'https://guardentra.com/api/health' @{ Origin = 'https://evil.example' }
$good = Get-Web 'https://guardentra.com/api/health' @{ Origin = 'https://guardentra.com' }
Add-Check 'R5' 'CORS: evil.example not echoed, guardentra.com echoed' (-not $evil.Headers['Access-Control-Allow-Origin'] -and $good.Headers['Access-Control-Allow-Origin'] -eq 'https://guardentra.com') @{ evil = $evil.Headers['Access-Control-Allow-Origin']; good = $good.Headers['Access-Control-Allow-Origin'] }

# R6 rules (Option A until G5, Option B after)
$rr = Get-Api "https://firebaserules.googleapis.com/v1/projects/$Proj/releases/cloud.firestore"
$rs = if ($rr.rulesetName) { Get-Api "https://firebaserules.googleapis.com/v1/$($rr.rulesetName)" }
$rsSha = if ($rs.source) { Get-Sha256Lf $rs.source.files[0].content }
if ($ExpectOptionB) { Add-Check 'R6' 'Firestore rules == Option B (015062ab)' ($rsSha -eq $OptionBLf) @{ ruleset = $rr.rulesetName; sha256Lf = $rsSha } }
else { Add-Check 'R6' 'Firestore rules still Option A (2a30bd60 / a0645160)' ($rr.rulesetName -eq $OptionARuleset -and $rsSha -eq $OptionALf) @{ ruleset = $rr.rulesetName; sha256Lf = $rsSha } }

$fails = @($Results | Where-Object { $_.status -eq 'FAIL' })
$Report = [ordered]@{ generatedUtc = (Get-Date).ToUniversalTime().ToString('o'); releaseSha = $ReleaseSha; expectOptionB = [bool]$ExpectOptionB; failCount = $fails.Count; checks = $Results }
$f = Join-Path $outDir "post-promotion-$($ReleaseSha.Substring(0,8)).json"
$Report | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $f
Write-Host "WROTE $f"
if ($fails.Count -eq 0) { Write-Host 'RESULT: all PASS. Label PROD DEPLOYED; continue with smoke (RUNBOOK 5).' }
else { Write-Host "RESULT: $($fails.Count) FAIL ($(($fails | ForEach-Object { $_.id }) -join ', ')). R1-R3 FAIL = rollback trigger (RUNBOOK 6). Paste the file into the chat." }
