# READ-ONLY production release pre-checks (RUNBOOK.md sections 2-3). Prepared 2026-10-31.
#   .\01-readonly-prechecks.ps1 -ReleaseSha <full 40-char RC commit>
# Every call is an HTTP GET, a gcloud list/describe/get-iam-policy, or a Firestore count
# aggregation (a read-only POST). Nothing is created, changed or deleted. Secret VALUES are never
# read, only names, version states and IAM bindings. No token is written to disk.
# Windows PowerShell 5.1, gcloud signed in as the owner. Output: .\out\prechecks-<sha>.json
param([Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ReleaseSha)

$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$outDir = Join-Path $root 'out'; New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$Proj = 'guardentra-prod'
$Backend = "projects/$Proj/locations/us-central1/backends/guardentra-prod"
$BaselineBuild = 'build-2026-08-27-001'
$BaselineShaPrefix = '29171a6'
$OptionARuleset = "projects/$Proj/rulesets/2a30bd60-c037-45e5-ae47-6ab164e2e881"
$OptionALf = 'a06451608dc61a810a9e19e4cc926e7585e5a4b48fa091194b13d13c65e71747'
$RcRulesLf = 'f53bd980c64d032541d48bc2fa6809974b71875de9b839f99fd2b19825f32161'   # == Option B logic
$RcIndexesLf = 'f2d695c074d4c5307659823c88e5815af6f5f79f08ea411cd3f748e0f4127532'
$StorageLf = 'c9629c7831b763543e213cd5f9d403706d80f3d4b0850d4c4c9ebafed364205d'
$Repo = 'akurteshi-guardentra/guardentra'
$RcBranch = 'release/rc-2026-10-08'
$StagingUrl = 'https://guardentra--guardentra-staging.us-east4.hosted.app'

$token = (& gcloud auth print-access-token 2>$null)
if (-not $token) { 'NO ACCESS TOKEN - run: gcloud auth login'; return }
$token = $token.Trim()
$hdr = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = $Proj }

function Get-Api($uri) {
  try { Invoke-RestMethod -Method Get -Uri $uri -Headers $hdr -ErrorAction Stop }
  catch { [pscustomobject]@{ apiError = $_.Exception.Message } }
}
function Get-Sha256Lf([string]$t) {
  $s = [Security.Cryptography.SHA256]::Create()
  (($s.ComputeHash([Text.UTF8Encoding]::new($false).GetBytes(($t -replace "`r`n", "`n"))) | ForEach-Object { $_.ToString('x2') }) -join '')
}
function Get-RawFile([string]$path) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 -Uri "https://raw.githubusercontent.com/$Repo/$ReleaseSha/$path"
    [Text.UTF8Encoding]::new($false).GetString($r.RawContentStream.ToArray())
  } catch { $null }
}
$Results = New-Object System.Collections.ArrayList
function Add-Check([string]$id, [string]$name, [string]$status, $detail) {
  $null = $Results.Add([ordered]@{ id = $id; check = $name; status = $status; detail = $detail })
  Write-Host ("[{0}] {1,-4} {2}" -f $status, $id, $name)
}
function PassFail([bool]$ok) { if ($ok) { 'PASS' } else { 'FAIL' } }

Write-Host "Release SHA $ReleaseSha, account $(& gcloud config get-value account 2>$null)"

# ---------- E1/E2: GitHub (public repo, unauthenticated GETs) ----------
$cmp = $null
try { $cmp = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/compare/$ReleaseSha...$RcBranch" -TimeoutSec 60 } catch {}
$onRc = $cmp -and ($cmp.status -eq 'identical' -or $cmp.status -eq 'ahead')
Add-Check 'E1' 'SHA is on the RC branch (head or ancestor)' (PassFail $onRc) @{ compareStatus = $cmp.status; rcAheadBy = $cmp.ahead_by }
$runs = $null
try { $runs = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/commits/$ReleaseSha/check-runs?per_page=100" -TimeoutSec 60 } catch {}
$cr = @($runs.check_runs)
$bad = @($cr | Where-Object { $_.status -ne 'completed' -or ($_.conclusion -ne 'success' -and $_.conclusion -ne 'skipped' -and $_.conclusion -ne 'neutral') })
$names = @($cr | ForEach-Object { "$($_.name)=$($_.conclusion)" })
$hasCore = ($names -match '^verify=success').Count -gt 0 -and ($names -match '^dispatcher=success').Count -gt 0
Add-Check 'E2' 'All check runs on the SHA succeeded (incl. verify + dispatcher)' (PassFail ($cr.Count -gt 0 -and $bad.Count -eq 0 -and $hasCore)) $names
$cmpMain = $null
try { $cmpMain = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/compare/main...$ReleaseSha" -TimeoutSec 60 } catch {}
Add-Check 'E12' 'main vs SHA (info: decide main alignment)' 'INFO' @{ status = $cmpMain.status; filesDiffering = @($cmpMain.files).Count }

# ---------- E3-E7: repo files at the SHA ----------
$prodYaml = Get-RawFile 'apphosting.prod.yaml'
$productionYaml = Get-RawFile 'apphosting.production.yaml'
$baseYaml = Get-RawFile 'apphosting.yaml'
$urlRx = '(?m)^\s*-\s*variable:\s*PUBLIC_APP_URL\s*\r?\n\s*value:\s*"?https://guardentra\.com"?\s*$'
$e3 = ($prodYaml -match $urlRx) -and ($productionYaml -match $urlRx)
Add-Check 'E3' 'PUBLIC_APP_URL=https://guardentra.com in apphosting.prod.yaml + .production.yaml' (PassFail $e3) @{ prod = [bool]($prodYaml -match $urlRx); production = [bool]($productionYaml -match $urlRx) }
$fr = Get-RawFile 'firestore.rules'; $frSha = if ($fr) { Get-Sha256Lf $fr }
Add-Check 'E4' 'firestore.rules == RC rules text that Option B equals' (PassFail ($frSha -eq $RcRulesLf)) $frSha
$fi = Get-RawFile 'firestore.indexes.json'; $fiSha = if ($fi) { Get-Sha256Lf $fi }
Add-Check 'E5' 'firestore.indexes.json == #239 -Set rc file' (PassFail ($fiSha -eq $RcIndexesLf)) $fiSha
$sr = Get-RawFile 'storage.rules'; $srSha = if ($sr) { Get-Sha256Lf $sr }
Add-Check 'E6' 'storage.rules == live prod Storage text' (PassFail ($srSha -eq $StorageLf)) $srSha
$switchRx = '(?m)^\s*-\s*variable:\s*(EVIDENCE_SCANNER_ENABLED|MAIL_WORKER_ENABLED|ASSESSMENT_REMINDER_WORKER_ENABLED)\b'
$spineRx = '(?m)^\s*-\s*variable:\s*AUDIT_SPINE_ENABLED\s*\r?\n\s*value:\s*"?(true|1)"?'
$e7bad = @()
foreach ($pair in @(@('apphosting.yaml', $baseYaml), @('apphosting.prod.yaml', $prodYaml))) {
  if (-not $pair[1]) { $e7bad += "$($pair[0]) unreadable"; continue }
  if ($pair[1] -match $switchRx) { $e7bad += "$($pair[0]): $($Matches[1]) is active" }
  if ($pair[1] -match $spineRx) { $e7bad += "$($pair[0]): AUDIT_SPINE_ENABLED=true" }
}
Add-Check 'E7' 'Scanner/email/reminder/spine switches stay off in prod config' (PassFail ($e7bad.Count -eq 0)) $e7bad

# ---------- E8: staging serves the SHA ----------
$sh = $null; try { $sh = Invoke-RestMethod -Uri "$StagingUrl/api/health" -TimeoutSec 30 } catch {}
Add-Check 'E8' 'Staging /api/health sourceSha == SHA' (PassFail ($sh.release.sourceSha -eq $ReleaseSha)) @{ staging = $sh.release }

# ---------- P1: prod baseline + rollback build ----------
$be = Get-Api "https://firebaseapphosting.googleapis.com/v1/$Backend"
$tr = Get-Api "https://firebaseapphosting.googleapis.com/v1/$Backend/traffic"
$bl = Get-Api "https://firebaseapphosting.googleapis.com/v1/$Backend/builds?pageSize=100"
$base = @($bl.builds) | Where-Object { $_.name -like "*/builds/$BaselineBuild" } | Select-Object -First 1
$split = @($tr.current.splits)
$servingBaseline = ($split.Count -eq 1 -and $split[0].build -like "*/builds/$BaselineBuild" -and [int]$split[0].percent -eq 100)
$imgDigest = $null
if ($base.image) { $imgDigest = (& gcloud artifacts docker images describe $base.image --project $Proj --format 'value(image_summary.digest)' 2>$null) }
$p1 = $servingBaseline -and $base -and $base.state -eq 'READY' -and ("$($base.source.codebase.hash)" -like "$BaselineShaPrefix*") -and [bool]$imgDigest
Add-Check 'P1' "Prod serves $BaselineBuild ($BaselineShaPrefix) 100%, build READY, image present (rollback target)" (PassFail $p1) @{
  splits = $split; rolloutPolicy = $tr.rolloutPolicy; baselineState = $base.state; baselineHash = $base.source.codebase.hash; image = $base.image; imageDigest = $imgDigest; apiError = $tr.apiError }
Add-Check 'P6a' 'Backend Environment name == prod (apphosting.prod.yaml applies)' (PassFail ($be.environment -eq 'prod')) @{ environment = $be.environment; serviceAccount = $be.serviceAccount; uri = $be.uri }

# ---------- P2/P5: rules ----------
$rr = Get-Api "https://firebaserules.googleapis.com/v1/projects/$Proj/releases/cloud.firestore"
$rrs = if ($rr.rulesetName) { Get-Api "https://firebaserules.googleapis.com/v1/$($rr.rulesetName)" }
$rrSha = if ($rrs.source) { Get-Sha256Lf $rrs.source.files[0].content }
Add-Check 'P2' 'Prod cloud.firestore == Option A 2a30bd60, text a0645160' (PassFail ($rr.rulesetName -eq $OptionARuleset -and $rrSha -eq $OptionALf)) @{ ruleset = $rr.rulesetName; sha256Lf = $rrSha; updated = $rr.updateTime }
$rels = Get-Api "https://firebaserules.googleapis.com/v1/projects/$Proj/releases?pageSize=50"
$st = @($rels.releases) | Where-Object { $_.name -like '*/releases/firebase.storage/*' } | Select-Object -First 1
$sts = if ($st.rulesetName) { Get-Api "https://firebaserules.googleapis.com/v1/$($st.rulesetName)" }
$stSha = if ($sts.source) { Get-Sha256Lf $sts.source.files[0].content }
Add-Check 'P5' 'Prod Storage rules text == pinned storage.rules' (PassFail ($stSha -eq $StorageLf -and $stSha -eq $srSha)) @{ release = $st.name; ruleset = $st.rulesetName; sha256Lf = $stSha }

# ---------- P3: indexes ----------
function Get-IxKey($cg, $scope, $fields) {
  $f = @($fields | Where-Object { $_.fieldPath -ne '__name__' } | ForEach-Object {
      if ($_.order) { "$($_.fieldPath):$($_.order)" } else { "$($_.fieldPath):array=$($_.arrayConfig)" } })
  "$cg|$scope|$($f -join ',')"
}
$wanted = @(); if ($fi) { $wanted = @(($fi | ConvertFrom-Json).indexes | ForEach-Object { Get-IxKey $_.collectionGroup $(if ($_.queryScope) { $_.queryScope } else { 'COLLECTION' }) $_.fields }) }
$liveIx = Get-Api "https://firestore.googleapis.com/v1/projects/$Proj/databases/(default)/collectionGroups/-/indexes?pageSize=200"
$live = @{}
foreach ($i in @($liveIx.indexes) | Where-Object { $_ }) { $cg = ($i.name -split '/')[-3]; $live[(Get-IxKey $cg $i.queryScope $i.fields)] = $i.state }
$missing = @($wanted | Where-Object { -not $live.ContainsKey($_) })
$notReady = @($wanted | Where-Object { $live.ContainsKey($_) -and $live[$_] -ne 'READY' } | ForEach-Object { "$_=$($live[$_])" })
Add-Check 'P3' "All $($wanted.Count) RC composite indexes exist and are READY on prod" (PassFail ($wanted.Count -eq 8 -and $missing.Count -eq 0 -and $notReady.Count -eq 0)) @{ missing = $missing; notReady = $notReady; liveCount = $live.Count; apiError = $liveIx.apiError }

# ---------- P4: secrets the build resolves (names, version states, IAM only) ----------
$sa = if ($be.serviceAccount) { $be.serviceAccount } else { "firebase-app-hosting-compute@$Proj.iam.gserviceaccount.com" }
$projIam = $null; try { $projIam = (& gcloud projects get-iam-policy $Proj --format json 2>$null) | Out-String | ConvertFrom-Json } catch {}
$projAccess = @($projIam.bindings | Where-Object { ($_.role -eq 'roles/secretmanager.secretAccessor' -or $_.role -eq 'roles/owner' -or $_.role -eq 'roles/editor') -and ($_.members -contains "serviceAccount:$sa") }).Count -gt 0
$secDetail = [ordered]@{}; $p4 = $true
foreach ($s in 'VITE_FIREBASE_API_KEY', 'GEMINI_API_KEY', 'AUDIT_DATABASE_URL') {
  $v = Get-Api "https://secretmanager.googleapis.com/v1/projects/$Proj/secrets/$s/versions?filter=state:ENABLED"
  $iam = Get-Api "https://secretmanager.googleapis.com/v1/projects/$Proj/secrets/${s}:getIamPolicy"
  $secAccess = @($iam.bindings | Where-Object { $_.role -eq 'roles/secretmanager.secretAccessor' -and ($_.members -contains "serviceAccount:$sa") }).Count -gt 0
  $enabled = @($v.versions | Where-Object { $_ }).Count
  $ok = ($enabled -ge 1) -and ($secAccess -or $projAccess)
  if (-not $ok) { $p4 = $false }
  $secDetail[$s] = @{ enabledVersions = $enabled; secretLevelAccess = $secAccess; error = $v.apiError }
}
$secDetail['serviceAccount'] = $sa; $secDetail['projectLevelAccess'] = $projAccess
Add-Check 'P4' 'Build secrets exist (ENABLED version) and backend SA can access them' (PassFail $p4) $secDetail

# ---------- P7: auth ----------
$cfg = Get-Api "https://identitytoolkit.googleapis.com/admin/v2/projects/$Proj/config"
$p7ok = ($cfg.signIn.email.enabled -eq $true) -and ($cfg.signIn.anonymous.enabled -ne $true)
$domOk = (@($cfg.authorizedDomains) -contains 'guardentra.com')
Add-Check 'P7' 'Auth: email/password on, anonymous off' (PassFail $p7ok) @{ email = $cfg.signIn.email.enabled; anonymous = $cfg.signIn.anonymous.enabled; mfa = $cfg.mfa.state; selfSignupDisabled = $cfg.client.permissions.disabledUserSignup }
Add-Check 'P7b' 'guardentra.com is an authorized domain (Google popup sign-in)' $(if ($domOk) { 'PASS' } else { 'WARN' }) @{ authorizedDomains = $cfg.authorizedDomains }

# ---------- P8: email / scanner stay off ----------
$ext = Get-Api "https://firebaseextensions.googleapis.com/v1beta/projects/$Proj/instances"
$extNames = @($ext.instances | Where-Object { $_ } | ForEach-Object { "$(($_.name -split '/')[-1]) ($($_.config.extensionRef))" })
$mailExt = @($ext.instances | Where-Object { "$($_.config.extensionRef)" -like '*firestore-send-email*' }).Count -gt 0
$secList = Get-Api "https://secretmanager.googleapis.com/v1/projects/$Proj/secrets?pageSize=200"
$secNames = @($secList.secrets | ForEach-Object { ($_.name -split '/')[-1] })
$scannerSecret = $secNames -contains 'EVIDENCE_SCANNER_SECRET'
Add-Check 'P8' 'No mail extension and no scanner secret on prod (email + scanner stay off)' (PassFail (-not $mailExt -and -not $scannerSecret)) @{ extensions = $extNames; extError = $ext.apiError; secretNames = $secNames }

# ---------- P9: data baseline (count aggregation, read-only) ----------
$counts = [ordered]@{}
foreach ($c in 'organizations', 'users', 'vendors', 'assessments', 'mail') {
  $body = @{ structuredAggregationQuery = @{ structuredQuery = @{ from = @(@{ collectionId = $c }) }; aggregations = @(@{ alias = 'n'; count = @{} }) } } | ConvertTo-Json -Depth 8
  try {
    $r = Invoke-RestMethod -Method Post -Headers $hdr -ContentType 'application/json' -Body $body -Uri "https://firestore.googleapis.com/v1/projects/$Proj/databases/(default)/documents:runAggregationQuery"
    $counts[$c] = [int](@($r)[0].result.aggregateFields.n.integerValue)
  } catch { $counts[$c] = "error: $($_.Exception.Message)" }
}
Add-Check 'P9' 'Prod data baseline (info; non-zero tenants changes the rollback note)' 'INFO' $counts

# ---------- P10: backups ----------
$db = Get-Api "https://firestore.googleapis.com/v1/projects/$Proj/databases/(default)"
$p10 = ($db.deleteProtectionState -eq 'DELETE_PROTECTION_ENABLED')
Add-Check 'P10' 'Delete protection / PITR on prod (default) (recommended G3)' $(if ($p10) { 'PASS' } else { 'WARN' }) @{ deleteProtection = $db.deleteProtectionState; pitr = $db.pointInTimeRecoveryEnablement; location = $db.locationId }

# ---------- P11: domains + live prod ----------
$dom = Get-Api "https://firebaseapphosting.googleapis.com/v1/$Backend/domains"
$domNames = @($dom.domains | ForEach-Object { ($_.name -split '/')[-1] })
$ph = $null; try { $ph = Invoke-RestMethod -Uri 'https://guardentra.com/api/health' -TimeoutSec 30 } catch { $ph = "ERROR $($_.Exception.Message)" }
$bundle = $null; try { $w = Invoke-WebRequest -UseBasicParsing -Uri 'https://guardentra.com/' -TimeoutSec 30; $bundle = ([regex]::Match($w.Content, 'src="(/assets/[^"]+\.js)"')).Groups[1].Value } catch {}
Add-Check 'P11' 'guardentra.com attached to prod backend; live prod reachable' (PassFail ($domNames -contains 'guardentra.com' -and $bundle)) @{ domains = $domNames; health = $ph; bundle = $bundle }

# ---------- Summary ----------
$fails = @($Results | Where-Object { $_.status -eq 'FAIL' })
$warns = @($Results | Where-Object { $_.status -eq 'WARN' })
$Report = [ordered]@{ generatedUtc = (Get-Date).ToUniversalTime().ToString('o'); releaseSha = $ReleaseSha; failCount = $fails.Count; warnCount = $warns.Count; checks = $Results }
$f = Join-Path $outDir "prechecks-$($ReleaseSha.Substring(0,8)).json"
$Report | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $f
Write-Host ''
Write-Host "WROTE $f"
if ($fails.Count -eq 0) { Write-Host "RESULT: no FAIL ($($warns.Count) WARN). Paste the file into the chat / release issue." }
else { Write-Host "RESULT: $($fails.Count) FAIL: $(($fails | ForEach-Object { $_.id }) -join ', '). Do not promote. Paste the file into the chat." }
