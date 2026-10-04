# GuardEntra dispatcher tests (#9C R4 authority closure)
# Real gate/function tests via DI providers. No network push/merge/deploy.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..\Common.ps1')
. (Join-Path $PSScriptRoot '..\Commands.ps1')

$script:Passed = 0
$script:Failed = 0
$script:Failures = New-Object System.Collections.Generic.List[string]

function Assert-True {
    param([bool]$Condition, [string]$Name)
    if ($Condition) { $script:Passed++; Write-Host "PASS $Name" }
    else { $script:Failed++; $script:Failures.Add($Name); Write-Host "FAIL $Name" }
}

function Assert-Throws {
    param([scriptblock]$Block, [string]$Name, [string]$Match = 'REFUSED|ESCALATE')
    try {
        & $Block | Out-Null
        $script:Failed++; $script:Failures.Add("$Name (no throw)"); Write-Host "FAIL $Name (no throw)"
    }
    catch {
        $msg = $_.Exception.Message
        if ($msg -match $Match) { $script:Passed++; Write-Host "PASS $Name" }
        else { $script:Failed++; $script:Failures.Add("$Name (unexpected: $msg)"); Write-Host "FAIL $Name (unexpected: $msg)" }
    }
}

function Reset-GuardentraTestProviders {
    $script:GuardentraAuthorityCommentsProvider = $null
    $script:GuardentraPrChecksProvider = $null
    $script:GuardentraCurrentBranchProvider = $null
    $script:GuardentraHeadShaProvider = $null
    $script:GuardentraIssueRecordProvider = $null
    $script:GuardentraOwnerGrantProvider = $null
    $script:GuardentraGitDirProvider = $null
    $script:GuardentraGitCommonDirProvider = $null
    $script:GuardentraRepoTopLevelProvider = $null
    $script:GuardentraInPrimaryCheckoutProvider = $null
    $script:GuardentraFetchAndFfPullMainProvider = $null
    $script:GuardentraOpenPrsForBranchProvider = $null
    $script:GuardentraPrCreateProvider = $null
    $script:GuardentraPrViewProvider = $null
    $script:GuardentraAdapterCanRunProvider = $null
}

Write-Host '=== GuardEntra #9C R4 dispatcher tests ==='
Reset-GuardentraTestProviders

$headA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
$headB = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
$digestA = '1111111111111111111111111111111111111111111111111111111111111111'
$digestB = '2222222222222222222222222222222222222222222222222222222222222222'
$owner = 'akurteshi-guardentra'
$branchName = 'tooling/controlled-orchestration-pilot'
$commentUrl = 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-1001'
$issued = '2026-09-18T00:00:00Z'

$tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("guardentra-r4-" + [guid]::NewGuid().ToString('n'))
$script:GuardentraStateRoot = Join-Path $tmpRoot 'issues'
New-Item -ItemType Directory -Force -Path $script:GuardentraStateRoot | Out-Null

function New-TestOwnerGrant {
    param(
        [string]$Action = 'commit',
        [string]$Head = $headA,
        [string]$Digest = $digestA,
        [int]$Pr = 0,
        [int]$Issue = 59,
        [string]$Branch = $branchName,
        [string]$Status = 'active',
        [string]$Nonce = '',
        [string]$SourceRef = $commentUrl,
        [string]$AuthorLogin = $owner,
        [string]$IssuedUtc = $issued
    )
    if (-not $Nonce) { $Nonce = ('n' + [guid]::NewGuid().ToString('n').Substring(0, 16)) }
    return [pscustomobject]@{
        schema         = 'guardentra.owner_grant.v1'
        issue          = $Issue
        action         = $Action
        nonce          = $Nonce
        branch         = $Branch
        head_sha       = $Head
        content_digest = $Digest
        pr_number      = $Pr
        issued_utc     = $IssuedUtc
        status         = $Status
        source_ref     = $SourceRef
        author_login   = $AuthorLogin
    }
}

function New-DispatchBody {
    param([string]$Branch = $branchName, [string]$Sha = $headA, [string]$Writer = 'Cursor')
    return @"
## #9C DISPATCH PACKET
**Branch:** ``$Branch``
**Starting SHA:** ``$Sha``
**Selected writer:** $Writer
**Access tier:** T1/T2 repository tooling only. No T3/T4 operations.
**Allowed paths:**
- ``scripts/guardentra.ps1``
- ``scripts/guardentra/*``
- ``docs/agent-ops/orchestration/*``
**Prohibited:**
- application/product code
"@
}

function New-GrantBody {
    param([Parameter(Mandatory)]$Grant)
    $json = ($Grant | Select-Object schema, issue, action, nonce, branch, head_sha, content_digest, pr_number, issued_utc, status) | ConvertTo-Json -Compress
    return @"
## GUARDENTRA_OWNER_GRANT
``````json
$json
``````
"@.Replace('``````', '```')
}

function New-AuthorityComment {
    param(
        [string]$Body,
        [string]$Login = $owner,
        [string]$SourceRef = $commentUrl,
        [long]$Id = 1001
    )
    return [pscustomobject]@{
        Id                = $Id
        HtmlUrl           = $SourceRef
        SourceRef         = $SourceRef
        AuthorLogin       = $Login
        AuthorAssociation = 'OWNER'
        Body              = $Body
        CreatedAt         = $issued
        IsIssueBody       = $false
    }
}

# --- Defaults / fail-closed ---
$c = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA `
    -FeatureBranch $branchName -WriterTool 'cursor'
Assert-True (-not $c.auth_commit.enabled) 'default auth_commit disabled'
Assert-Throws { Assert-GuardentraAuthorized -Contract $c -Action 'commit' -CurrentHeadSha $headA -ContentDigest $digestA } 'unauthorized commit refused'

# Local mint refused
Assert-Throws { Deny-GuardentraLocalAuthorizeMint } 'local authorize mint denied'
Assert-Throws { Invoke-GuardentraAuthorize -IssueNumber 59 -Gate 'commit' } 'authorize command refuses mint'

# Legacy sticky boolean ignored; local-source grant disabled by convert
$partial = [pscustomobject]@{
    issue_number = 1
    title        = 'x'
    auth_commit  = @{ enabled = $true; head_sha = $headA; content_digest = $digestA; nonce = 'n1abcdef'; source = 'local'; consumed = $false }
}
$norm = ConvertTo-GuardentraContractObject -InputObject $partial
Assert-True (-not $norm.auth_commit.enabled) 'local-source grant not authoritative'

# Import + content digest binding
$c2 = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
$gOk = New-TestOwnerGrant
$c2 = Import-GuardentraOwnerGrant -Contract $c2 -Grant $gOk
Assert-True ($c2.auth_commit.enabled) 'import enables commit grant'
Assert-True ($c2.auth_commit.source -eq 'github-owner-grant') 'import source is github-owner-grant'
Assert-True ($c2.auth_commit.author_login -eq $owner) 'import retains author_login'
Assert-True ($c2.auth_commit.source_ref -eq $commentUrl) 'import retains source_ref'
Assert-Throws { Assert-GuardentraAuthorized -Contract $c2 -Action 'commit' -CurrentHeadSha $headA -ContentDigest $digestB } 'content digest mismatch refused'
$ok = Test-GuardentraAuthorization -Contract $c2 -Action 'commit' -CurrentHeadSha $headA -ContentDigest $digestA
Assert-True ($ok.Allowed) 'matching digest allowed'
Assert-Throws { Assert-GuardentraAuthorized -Contract $c2 -Action 'commit' -CurrentHeadSha $headB -ContentDigest $digestA } 'HEAD mismatch refused'
Assert-Throws {
    Import-GuardentraOwnerGrant -Contract $c2 -Grant (New-TestOwnerGrant -Digest '')
} 'commit grant without digest refused'

# HEAD-only grant (empty digest after manual tamper) refused
$c2.auth_commit.content_digest = ''
Assert-Throws { Assert-GuardentraAuthorized -Contract $c2 -Action 'commit' -CurrentHeadSha $headA -ContentDigest $digestA } 'HEAD-only commit grant refused'

# Push does not require content digest; still needs github source + strict fields
$c3 = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
$c3 = Import-GuardentraOwnerGrant -Contract $c3 -Grant (New-TestOwnerGrant -Action 'push-and-pr' -Digest '')
Assert-True ((Test-GuardentraAuthorization -Contract $c3 -Action 'push-and-pr' -CurrentHeadSha $headA).Allowed) 'push grant without digest ok'
Assert-Throws { Assert-GuardentraAuthorized -Contract $c3 -Action 'push-and-pr' -CurrentHeadSha $headB } 'push HEAD mismatch refused'

# Merge PR+SHA
$c4 = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
Assert-Throws { Import-GuardentraOwnerGrant -Contract $c4 -Grant (New-TestOwnerGrant -Action 'merge' -Pr 0 -Digest '') } 'merge grant without PR refused'
$c4 = Import-GuardentraOwnerGrant -Contract $c4 -Grant (New-TestOwnerGrant -Action 'merge' -Pr 60 -Digest '')
Assert-Throws { Assert-GuardentraAuthorized -Contract $c4 -Action 'merge' -PrNumber 61 -PrHeadSha $headA } 'merge wrong PR refused'
Assert-Throws { Assert-GuardentraAuthorized -Contract $c4 -Action 'merge' -PrNumber 60 -PrHeadSha $headB } 'merge wrong SHA refused'
Assert-True ((Test-GuardentraAuthorization -Contract $c4 -Action 'merge' -PrNumber 60 -PrHeadSha $headA).Allowed) 'merge PR+SHA match allowed'

# Grant parse from markdown (status must remain explicit; no default active)
$grantMd = @"
## GUARDENTRA_OWNER_GRANT
``````json
{ "schema": "guardentra.owner_grant.v1", "issue": 59, "action": "commit", "nonce": "abc12345", "branch": "$branchName", "head_sha": "$headA", "content_digest": "$digestA", "pr_number": 0, "issued_utc": "$issued", "status": "active" }
``````
"@
$grantMd = $grantMd.Replace('``````', '```')
$parsed = ConvertFrom-GuardentraOwnerGrantText -Text $grantMd -SourceRef $commentUrl -AuthorLogin $owner
Assert-True ($parsed.Count -eq 1) 'parses one owner grant'
Assert-True ($parsed[0].nonce -eq 'abc12345') 'parsed nonce'
Assert-True ($parsed[0].status -eq 'active') 'parsed explicit status'
Assert-True ($parsed[0].author_login -eq $owner) 'parsed author_login'
$weakMd = @"
## GUARDENTRA_OWNER_GRANT
``````json
{ "schema": "guardentra.owner_grant.v1", "issue": 59, "action": "commit", "nonce": "weaknonce1", "branch": "$branchName", "head_sha": "$headA", "content_digest": "$digestA" }
``````
"@
$weakMd = $weakMd.Replace('``````', '```')
$weakParsed = ConvertFrom-GuardentraOwnerGrantText -Text $weakMd -SourceRef $commentUrl -AuthorLogin $owner
Assert-True ($weakParsed[0].status -eq '') 'missing status not defaulted to active'

# Strict field refusals
$cStrict = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
Assert-Throws { Import-GuardentraOwnerGrant -Contract $cStrict -Grant (New-TestOwnerGrant -Branch '') } 'missing branch refused'
Assert-Throws { Import-GuardentraOwnerGrant -Contract $cStrict -Grant (New-TestOwnerGrant -IssuedUtc '') } 'missing issued_utc refused'
Assert-Throws { Import-GuardentraOwnerGrant -Contract $cStrict -Grant (New-TestOwnerGrant -Status '') } 'missing status refused'
Assert-Throws { Import-GuardentraOwnerGrant -Contract $cStrict -Grant (New-TestOwnerGrant -Status 'pending') } 'non-active status refused'
Assert-Throws { Import-GuardentraOwnerGrant -Contract $cStrict -Grant (New-TestOwnerGrant -Head 'abc') } 'invalid SHA refused'
Assert-Throws { Import-GuardentraOwnerGrant -Contract $cStrict -Grant (New-TestOwnerGrant -SourceRef 'local-cache') } 'invalid source_ref refused'
Assert-Throws { Import-GuardentraOwnerGrant -Contract $cStrict -Grant (New-TestOwnerGrant -AuthorLogin 'evil-bot') } 'unauthorized comment author refused'

# Required CI: SUCCESS/pass only
Assert-Throws { Test-GuardentraRequiredCi -Checks @() } 'CI empty refused'
Assert-Throws { Test-GuardentraRequiredCi -Checks @([pscustomobject]@{ name = 'lint'; state = 'SUCCESS'; bucket = 'pass' }) } 'CI missing verify refused'
Assert-Throws { Test-GuardentraRequiredCi -Checks @([pscustomobject]@{ name = 'verify'; state = 'PENDING'; bucket = 'pending' }) } 'CI pending refused'
Assert-Throws { Test-GuardentraRequiredCi -Checks @([pscustomobject]@{ name = 'verify'; state = 'NEUTRAL'; bucket = 'skip' }) } 'CI NEUTRAL refused'
Assert-Throws { Test-GuardentraRequiredCi -Checks @([pscustomobject]@{ name = 'verify'; state = 'SKIPPED'; bucket = 'skip' }) } 'CI SKIPPED refused'
Assert-Throws { Test-GuardentraRequiredCi -Checks @([pscustomobject]@{ name = 'verify'; state = 'FAILURE'; bucket = 'fail' }) } 'CI FAILURE refused'
Assert-True (Test-GuardentraRequiredCi -Checks @([pscustomobject]@{ name = 'verify'; state = 'SUCCESS'; bucket = 'pass' })) 'CI SUCCESS allowed'

# Real CI retrieval failure path (provider)
$script:GuardentraPrChecksProvider = {
    param($Pr)
    throw "REFUSED: unable to read required PR checks for #${Pr} via 'gh pr checks --required --json name,state,bucket': simulated"
}
Assert-Throws { Get-GuardentraPrChecks -Pr 60 } 'CI unsupported/fallback path refused'
$script:GuardentraPrChecksProvider = $null

# Access tier
Assert-Throws { Test-GuardentraAccessTierAllowed -AccessTier 'T3' -MaxTier 'T2' } 'T3 refused'
Assert-Throws { Test-GuardentraAccessTierAllowed -AccessTier 'T4' -MaxTier 'T2' } 'T4 refused'
Assert-True (Test-GuardentraAccessTierAllowed -AccessTier 'T2' -MaxTier 'T2') 'T2 within max allowed'

# Origin validation
Assert-True (Test-GuardentraOriginUrl -Url 'https://github.com/akurteshi-guardentra/guardentra.git') 'accept https'
Assert-True (-not (Test-GuardentraOriginUrl -Url 'https://evil.example/akurteshi-guardentra/guardentra.git')) 'reject lookalike'

# Retry persistence
$c5 = New-GuardentraDefaultContract -IssueNumber 7 -Title 'r' -StartingMainSha $headA -FeatureBranch 'x' -WriterTool 'cursor'
Save-GuardentraContract -IssueNumber 7 -Contract $c5
$c5 = Register-GuardentraAttempt -Contract $c5 -Success:$false -IssueNumber 7
$c5 = Register-GuardentraAttempt -Contract $c5 -Success:$false -IssueNumber 7
Assert-Throws { Register-GuardentraAttempt -Contract $c5 -Success:$false -IssueNumber 7 } 'third failure escalates' -Match 'ESCALATE'
$reloaded = Read-GuardentraContract -IssueNumber 7
Assert-True ([int]$reloaded.attempt_count -ge 3) 'third failure persisted'

# Path allowlist / secrets / packet (no local authorize mint instructions)
Assert-True (Test-GuardentraPathAllowed -Path 'scripts/guardentra.ps1' -AllowedPaths @($c.allowed_paths) -ProhibitedPaths @($c.prohibited_paths)) 'allow scripts'
Assert-True (-not (Test-GuardentraPathAllowed -Path 'src/App.tsx' -AllowedPaths @($c.allowed_paths) -ProhibitedPaths @($c.prohibited_paths))) 'deny src'

# --- #88 correction cycle 3: path normalization must preserve leading '.' ---
# TrimStart('./') is a character-set trim and wrongly turns
# `.github/workflows/ci.yml` into `github/workflows/ci.yml`, failing the
# authorized allowlist entry during commit (cycle-3 commit-gate defect).
$ciAllow = @('.github/workflows/ci.yml', 'scripts/guardentra/*')
Assert-True (Test-GuardentraPathAllowed -Path '.github/workflows/ci.yml' -AllowedPaths $ciAllow -ProhibitedPaths @()) `
    '.github/workflows/ci.yml matches exact allowlist entry (#88 correction cycle 3)'
Assert-True (Test-GuardentraPathAllowed -Path './.github/workflows/ci.yml' -AllowedPaths $ciAllow -ProhibitedPaths @()) `
    './.github/workflows/ci.yml strips only literal ./ and remains allowed (#88 correction cycle 3)'
Assert-True (-not (Test-GuardentraPathAllowed -Path '.github/workflows/other.yml' -AllowedPaths $ciAllow -ProhibitedPaths @())) `
    '.github/workflows/other.yml refused when only ci.yml is allowed (#88 correction cycle 3)'
Assert-True (-not (Test-GuardentraPathAllowed -Path '../.github/workflows/ci.yml' -AllowedPaths $ciAllow -ProhibitedPaths @())) `
    '../.github/workflows/ci.yml is not converted into an allowed path (#88 correction cycle 3)'
Assert-True (Test-GuardentraPathAllowed -Path 'scripts/guardentra/Common.ps1' -AllowedPaths $ciAllow -ProhibitedPaths @()) `
    'scripts/guardentra/* matching unchanged (#88 correction cycle 3)'
Assert-True (-not (Test-GuardentraPathAllowed -Path '.github/workflows/ci.yml' -AllowedPaths $ciAllow -ProhibitedPaths @('.github/*'))) `
    'prohibited-path rules still override allowed-path rules (#88 correction cycle 3)'
$ciContract = New-GuardentraDefaultContract -IssueNumber 8803 -Title 'path-norm' -StartingMainSha $headA -FeatureBranch 'tooling/agent-control-plane-88' -WriterTool 'claude'
$ciContract.allowed_paths = @('.github/workflows/ci.yml', 'scripts/guardentra/*', 'docs/agent-ops/orchestration/*')
Assert-GuardentraChangedFilesAllowed -Paths @('.github/workflows/ci.yml') -Contract $ciContract
Assert-True $true 'Assert-GuardentraChangedFilesAllowed accepts .github/workflows/ci.yml after path-norm fix (#88 correction cycle 3)'
$red = Protect-GuardentraSecrets -Text 'token=ghp_abcdefghijklmnopqrstuv'
Assert-True ($red -match 'REDACTED') 'redacts secrets'
$pkt = New-GuardentraTaskPacketMarkdown -Contract $c
Assert-True ($pkt -match 'sync-grants') 'packet mentions sync-grants'
Assert-True ($pkt -notmatch 'authorize \$|authorize \d|authorize <') 'packet has no local authorize mint instruction'
Assert-True ($pkt -match 'cannot mint' -or $pkt -match 'Do \*\*not\*\* use local') 'packet denies local authorize'
Assert-True ($pkt -notmatch 'ΓÇö') 'no mojibake'

# CLI: commit-and-pr removed; sync-grants present
$entry = Get-Content (Join-Path $PSScriptRoot '..\..\guardentra.ps1') -Raw
Assert-True ($entry -notmatch "'commit-and-pr'") 'commit-and-pr removed from CLI'
Assert-True ($entry -match 'sync-grants') 'sync-grants present in CLI'

# --- R4 authority-closure gate tests (real functions + providers) ---

# Unauthorized comment author: grant body ignored; sync finds nothing from allowlist
$evilGrant = New-TestOwnerGrant -Nonce 'evilnonce99'
$script:GuardentraAuthorityCommentsProvider = {
    param($IssueNumber)
    @(
        (New-AuthorityComment -Body (New-DispatchBody) -Login $owner -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-1' -Id 1),
        (New-AuthorityComment -Body (New-GrantBody -Grant $evilGrant) -Login 'evil-bot' -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-2' -Id 2)
    )
}
$bundleEvil = Get-GuardentraAuthorityGrantsAndEvents -IssueNumber 59
Assert-True ($bundleEvil.Grants.Count -eq 0) 'unauthorized author grant not accepted into bundle'
Assert-True ($bundleEvil.RejectedAuthors -contains 'evil-bot') 'unauthorized author recorded'
$cSync = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
Save-GuardentraContract -IssueNumber 59 -Contract $cSync
Assert-Throws { Invoke-GuardentraSyncGrants -IssueNumber 59 } 'unauthorized comment author sync refused'

# Forged local github-owner-grant refused by live revalidation
$cForge = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
$cForge.auth_commit = [ordered]@{
    enabled        = $true
    head_sha       = $headA
    content_digest = $digestA
    pr_number      = 0
    nonce          = 'forgednonce1'
    branch         = $branchName
    source         = 'github-owner-grant'
    source_ref     = $commentUrl
    author_login   = $owner
    issued_utc     = $issued
    status         = 'active'
    consumed       = $false
}
$script:GuardentraAuthorityCommentsProvider = {
    param($IssueNumber)
    @(New-AuthorityComment -Body (New-DispatchBody) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-1')
}
Assert-Throws { Assert-GuardentraAuthorityLive -Contract $cForge -Action 'commit' -CurrentHeadSha $headA -ContentDigest $digestA } 'forged local github-owner-grant refused'

# Local scope widening refused
$liveGrant = New-TestOwnerGrant -Nonce 'widenonce001'
$script:GuardentraAuthorityCommentsProvider = {
    param($IssueNumber)
    @(
        (New-AuthorityComment -Body (New-DispatchBody) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-1'),
        (New-AuthorityComment -Body (New-GrantBody -Grant $liveGrant) -Login $owner -Id 1001 -SourceRef $commentUrl)
    )
}
$cWide = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
$cWide = Import-GuardentraOwnerGrant -Contract $cWide -Grant $liveGrant
$cWide.allowed_paths = @('scripts/guardentra.ps1', 'scripts/guardentra/*', 'docs/agent-ops/orchestration/*', 'src/*')
Assert-Throws { Assert-GuardentraAuthorityLive -Contract $cWide -Action 'commit' -CurrentHeadSha $headA -ContentDigest $digestA } 'local scope widening refused'

# Live revalidation success path
$cLive = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
$cLive = Import-GuardentraOwnerGrant -Contract $cLive -Grant $liveGrant
$cLive2 = Assert-GuardentraAuthorityLive -Contract $cLive -Action 'commit' -CurrentHeadSha $headA -ContentDigest $digestA
Assert-True ($cLive2.auth_commit.enabled) 'live revalidation accepts matching GitHub grant'

# Replay protection: consume nonce then refuse re-import / sync
$replayNonce = 'replaynonce01'
$replayGrant = New-TestOwnerGrant -Nonce $replayNonce
$cReplay = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
$cReplay = Import-GuardentraOwnerGrant -Contract $cReplay -Grant $replayGrant
$cReplay = Clear-GuardentraAuthGrant -Contract $cReplay -Action 'commit'
$term = Get-GuardentraNonceTerminalStatus -IssueNumber 59 -Nonce $replayNonce
Assert-True ($term -eq 'consumed') 'durable nonce consumed recorded'
Assert-Throws { Import-GuardentraOwnerGrant -Contract $cReplay -Grant $replayGrant } 'replayed nonce import refused'
$script:GuardentraAuthorityCommentsProvider = {
    param($IssueNumber)
    @(
        (New-AuthorityComment -Body (New-DispatchBody) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-1'),
        (New-AuthorityComment -Body (New-GrantBody -Grant $replayGrant) -Login $owner -Id 1001 -SourceRef $commentUrl)
    )
}
Save-GuardentraContract -IssueNumber 59 -Contract (New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor')
Assert-Throws { Invoke-GuardentraSyncGrants -IssueNumber 59 } 'replayed nonce sync refused'

# GitHub GRANT_EVENT consumed also blocks
$evtNonce = 'eventnonce01'
$evtGrant = New-TestOwnerGrant -Nonce $evtNonce
$evtBody = @"
## GUARDENTRA_GRANT_EVENT
``````json
{"schema":"guardentra.grant_event.v1","issue":59,"nonce":"$evtNonce","status":"consumed","issued_utc":"2026-09-18T02:00:00Z"}
``````
"@.Replace('``````', '```')
$script:GuardentraAuthorityCommentsProvider = {
    param($IssueNumber)
    @(
        (New-AuthorityComment -Body (New-DispatchBody) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-1'),
        (New-AuthorityComment -Body (New-GrantBody -Grant $evtGrant) -Login $owner -Id 1001 -SourceRef $commentUrl),
        (New-AuthorityComment -Body $evtBody -Login $owner -Id 1002 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-1002')
    )
}
$cEvt = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
$bundleEvt = Get-GuardentraAuthorityGrantsAndEvents -IssueNumber 59
Assert-Throws { Import-GuardentraOwnerGrant -Contract $cEvt -Grant $evtGrant -GrantEvents @($bundleEvt.Events) } 'github consumed event replay refused'

# Existing feature branch + missing contract => real Invoke-GuardentraStart path
$script:GuardentraCurrentBranchProvider = { $branchName }
$script:GuardentraIssueRecordProvider = {
    param($IssueNumber)
    [pscustomobject]@{
        Number             = $IssueNumber
        Title              = 'pilot'
        State              = 'OPEN'
        Body               = ''
        AuthorLogin        = $owner
        AcceptanceCriteria = @()
    }
}
$script:GuardentraAuthorityCommentsProvider = {
    param($IssueNumber)
    @(New-AuthorityComment -Body (New-DispatchBody) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-1')
}
# Ensure no contract for 59 in temp state (rewrite empty)
$contract59 = Get-GuardentraContractPath -IssueNumber 59
if (Test-Path -LiteralPath $contract59) { Remove-Item -LiteralPath $contract59 -Force }
Assert-Throws { Invoke-GuardentraStart -IssueNumber 59 -Writer cursor -Branch $branchName } 'missing contract on existing branch refused'

# R4.1: paginated gh --slurp pages must flatten before .id (Object[] -> Int64 regression)
$pageGrant = New-TestOwnerGrant -Nonce 'pagegrant01'
$evilPageGrant = New-TestOwnerGrant -Nonce 'evilpage01' -AuthorLogin 'evil-bot'
$fence = '```'
$ownerGrantJson = ($pageGrant | Select-Object schema, issue, action, nonce, branch, head_sha, content_digest, pr_number, issued_utc, status) | ConvertTo-Json -Compress
$evilGrantJson = ($evilPageGrant | Select-Object schema, issue, action, nonce, branch, head_sha, content_digest, pr_number, issued_utc, status) | ConvertTo-Json -Compress
$page1c1 = [pscustomobject]@{ id = [long]101; html_url = 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-101'; user = [pscustomobject]@{ login = 'evil-bot' }; author_association = 'NONE'; body = ("## GUARDENTRA_OWNER_GRANT`n$fence`json`n$evilGrantJson`n$fence"); created_at = '2026-09-18T00:00:01Z' }
$page1c2 = [pscustomobject]@{ id = [long]102; html_url = 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-102'; user = [pscustomobject]@{ login = $owner }; author_association = 'OWNER'; body = 'noise comment'; created_at = '2026-09-18T00:00:02Z' }
$page2c1 = [pscustomobject]@{ id = [long]103; html_url = 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-103'; user = [pscustomobject]@{ login = $owner }; author_association = 'OWNER'; body = (New-DispatchBody); created_at = '2026-09-18T00:00:03Z' }
$page2c2 = [pscustomobject]@{ id = [long]104; html_url = 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-104'; user = [pscustomobject]@{ login = $owner }; author_association = 'OWNER'; body = ("## GUARDENTRA_OWNER_GRANT`n$fence`json`n$ownerGrantJson`n$fence"); created_at = '2026-09-18T00:00:04Z' }
# Simulate gh --paginate --slurp parsed shape: array of pages, each page an array of comments
$slurpPages = [object[]]@(
    [object[]]@($page1c1, $page1c2),
    [object[]]@($page2c1, $page2c2)
)
$flatComments = Expand-GuardentraGhApiCommentPages -Parsed $slurpPages
Assert-True ($flatComments.Count -eq 4) 'paginated pages flatten to four comments'
Assert-True ($flatComments[0].id -isnot [System.Array]) 'first comment id is scalar not Object[]'
Assert-True ([long]$flatComments[0].id -eq 101) 'comment id 101 retained individually'
Assert-True ([long]$flatComments[1].id -eq 102) 'comment id 102 retained individually'
Assert-True ([long]$flatComments[2].id -eq 103) 'comment id 103 retained individually'
Assert-True ([long]$flatComments[3].id -eq 104) 'comment id 104 retained individually'
# JSON --slurp text path with simple bodies (avoids fragile markdown JSON round-trip)
$slurpJson = @'
[
  [
    {"id": 201, "html_url": "https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-201", "user": {"login": "evil-bot"}, "author_association": "NONE", "body": "evil", "created_at": "2026-09-18T00:00:01Z"},
    {"id": 202, "html_url": "https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-202", "user": {"login": "akurteshi-guardentra"}, "author_association": "OWNER", "body": "noise", "created_at": "2026-09-18T00:00:02Z"}
  ],
  [
    {"id": 203, "html_url": "https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-203", "user": {"login": "akurteshi-guardentra"}, "author_association": "OWNER", "body": "dispatch", "created_at": "2026-09-18T00:00:03Z"},
    {"id": 204, "html_url": "https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-204", "user": {"login": "akurteshi-guardentra"}, "author_association": "OWNER", "body": "grant", "created_at": "2026-09-18T00:00:04Z"}
  ]
]
'@
$flatFromJson = ConvertFrom-GuardentraGhApiCommentPages -JsonText $slurpJson
Assert-True ($flatFromJson.Count -eq 4) 'slurp JSON flattens to four comments'
Assert-True ([long]$flatFromJson[0].id -eq 201 -and [long]$flatFromJson[3].id -eq 204) 'slurp JSON comment ids retained individually'
$mapped = New-Object System.Collections.Generic.List[object]
foreach ($fc in $flatComments) {
    [void]$mapped.Add((ConvertTo-GuardentraAuthorityCommentRecord -GhComment $fc))
}
Assert-True ([long]$mapped[0].Id -eq 101 -and [long]$mapped[3].Id -eq 104) 'mapped authority records keep individual IDs'
Assert-Throws {
    ConvertTo-GuardentraAuthorityCommentRecord -GhComment @($page1c1, $page1c2)
} 'unflattened page array refused at record conversion'
Assert-Throws {
    Expand-GuardentraGhApiCommentPages -Parsed ([pscustomobject]@{ id = @([long]1, [long]2); body = 'bad' })
} 'array-valued comment id refused'
$script:GuardentraAuthorityCommentsProvider = {
    param($IssueNumber)
    @(
        (New-AuthorityComment -Body (New-DispatchBody) -Login $owner -Id 103 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-103'),
        (New-AuthorityComment -Body ("## GUARDENTRA_OWNER_GRANT`n$fence`json`n$evilGrantJson`n$fence") -Login 'evil-bot' -Id 101 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-101'),
        (New-AuthorityComment -Body ("## GUARDENTRA_OWNER_GRANT`n$fence`json`n$ownerGrantJson`n$fence") -Login $owner -Id 104 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-104')
    )
}
$bundlePages = Get-GuardentraAuthorityGrantsAndEvents -IssueNumber 59
Assert-True ($bundlePages.Grants.Count -eq 1) 'allowlisted Owner grant discovered from paginated set'
Assert-True ($bundlePages.Grants[0].nonce -eq 'pagegrant01') 'discovered grant nonce matches Owner page'
Assert-True ($bundlePages.RejectedAuthors -contains 'evil-bot') 'unauthorized paginated authors still ignored'
$cPage = New-GuardentraDefaultContract -IssueNumber 59 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
Save-GuardentraContract -IssueNumber 59 -Contract $cPage
Invoke-GuardentraSyncGrants -IssueNumber 59 -Action commit | Out-Null
$cPageReloaded = Read-GuardentraContract -IssueNumber 59
Assert-True ($cPageReloaded.auth_commit.enabled -and $cPageReloaded.auth_commit.nonce -eq 'pagegrant01') 'sync-grants imports matching Owner grant from paginated pages'

# R4.2: New-Object List[object] must not be wrapped with @($list) (Argument types do not match)
$listObj = New-Object System.Collections.Generic.List[object]
[void]$listObj.Add((New-AuthorityComment -Body (New-DispatchBody) -Login $owner -Id 501 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-501'))
[void]$listObj.Add((New-AuthorityComment -Body 'noise' -Login $owner -Id 502 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-502'))
[void]$listObj.Add((New-AuthorityComment -Body ("## GUARDENTRA_OWNER_GRANT`n$fence`json`n$ownerGrantJson`n$fence") -Login $owner -Id 503 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-503'))
$safeArr = $listObj.ToArray()
Assert-True ($safeArr -is [System.Array]) 'List[object].ToArray() yields System.Array'
Assert-True ($safeArr.Length -eq 3) 'ToArray length matches List count'
$enumCount = 0
foreach ($item in $safeArr) {
    Assert-True ($null -ne $item.Id) 'enumerated ToArray authority comment has Id'
    Assert-True ($null -ne $item.AuthorLogin) 'enumerated ToArray authority comment has AuthorLogin'
    $enumCount++
}
Assert-True ($enumCount -eq 3) 'List[object].ToArray() enumerates without Argument types do not match'
# Provider path returns array; sync still works after R4.2 return shape
$script:GuardentraAuthorityCommentsProvider = {
    param($IssueNumber)
    $inner = New-Object System.Collections.Generic.List[object]
    [void]$inner.Add((New-AuthorityComment -Body (New-DispatchBody) -Login $owner -Id 601 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-601'))
    [void]$inner.Add((New-AuthorityComment -Body ("## GUARDENTRA_OWNER_GRANT`n$fence`json`n$(($pageGrant | Select-Object schema, issue, action, nonce, branch, head_sha, content_digest, pr_number, issued_utc, status | ConvertTo-Json -Compress))`n$fence") -Login $owner -Id 602 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/59#issuecomment-602'))
    return $inner.ToArray()
}
$fromProvider = Get-GuardentraIssueAuthorityComments -IssueNumber 59
Assert-True ($fromProvider -is [System.Array]) 'Get-GuardentraIssueAuthorityComments returns array'
Assert-True ($fromProvider.Length -eq 2) 'provider ToArray path returns two authority comments'
$bundleSafe = Get-GuardentraAuthorityGrantsAndEvents -IssueNumber 59
Assert-True ($bundleSafe.Grants.Count -eq 1) 'grants discovered after List.ToArray return path'

# Schema doc is R4
$schemaDoc = Get-Content (Join-Path $PSScriptRoot '..\..\..\docs\agent-ops\orchestration\TASK_CONTRACT_SCHEMA.md') -Raw
Assert-True ($schemaDoc -match 'R4') 'schema doc is R4'
Assert-True ($schemaDoc -match 'nonce-ledger' -or $schemaDoc -match 'source_ref') 'schema documents provenance'
Assert-True ($schemaDoc -notmatch 'Record with ``\.\\scripts\\guardentra\.ps1 authorize') 'schema has no authorize mint instruction'

# --- #77 native git stderr regression (real git + temp local remote; no GuardEntra branch mutation) ---
function Invoke-GuardentraTestGitSetup {
    param([Parameter(Mandatory)][string[]]$GitArgs, [string]$WorkDir = '')
    # Setup only: tolerate native stderr under PS 5.1 Stop without weakening the
    # suite-wide preference outside this helper. Production path is Invoke-GuardentraGit.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $errPath = [System.IO.Path]::GetTempFileName()
    try {
        if ($WorkDir) {
            $out = & git -C $WorkDir @GitArgs 2>$errPath
        }
        else {
            $out = & git @GitArgs 2>$errPath
        }
        $code = $LASTEXITCODE
        if ($null -eq $code) { $code = 0 }
        if ($code -ne 0) {
            $errText = ''
            if (Test-Path -LiteralPath $errPath) { $errText = [System.IO.File]::ReadAllText($errPath) }
            $combined = @(($out | Out-String), $errText) -join [Environment]::NewLine
            throw "native-git test setup failed ($($GitArgs -join ' ')): $combined"
        }
        return ($out | Out-String).Trim()
    }
    finally {
        $ErrorActionPreference = $prevEap
        if (Test-Path -LiteralPath $errPath) {
            Remove-Item -LiteralPath $errPath -Force -ErrorAction SilentlyContinue
        }
    }
}

# Ensure a freshly `git init`-ed repo is checked out on `main`, creating it
# only if a different (or unborn) branch is currently active. Unconditionally
# running `checkout -b main` previously failed ("a branch named 'main'
# already exists") whenever the caller's own git config already sets
# init.defaultBranch=main, because `init` then puts the repo's unborn HEAD on
# `main` before this fixture ever runs (#82 — Cursor Bugbot finding on PR
# #79). Querying the actual current branch name first makes this safe
# regardless of the caller's init.defaultBranch, with no git-version-specific
# flag dependency (e.g. --initial-branch).
function Set-GuardentraTestSeedMainBranch {
    param([Parameter(Mandatory)][string]$RepoDir)
    $current = (Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
    if ($current -ne 'main') {
        Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('checkout', '-b', 'main')
    }
}

$nativeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-native-git-' + [guid]::NewGuid().ToString('n'))
$bareRepo = Join-Path $nativeRoot 'remote.git'
$seedRepo = Join-Path $nativeRoot 'seed'
$workRepo = Join-Path $nativeRoot 'work'
$prevGuardentraRoot = $script:GuardentraRoot
try {
    New-Item -ItemType Directory -Force -Path $nativeRoot | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', '--bare', $bareRepo)
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $seedRepo)
    Invoke-GuardentraTestGitSetup -WorkDir $seedRepo -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $seedRepo -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')
    Set-GuardentraTestSeedMainBranch -RepoDir $seedRepo
    Set-Content -LiteralPath (Join-Path $seedRepo 'README.md') -Value 'seed-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $seedRepo -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $seedRepo -GitArgs @('commit', '-m', 'seed')
    Invoke-GuardentraTestGitSetup -WorkDir $seedRepo -GitArgs @('remote', 'add', 'origin', $bareRepo)
    Invoke-GuardentraTestGitSetup -WorkDir $seedRepo -GitArgs @('push', '-u', 'origin', 'main')
    Invoke-GuardentraTestGitSetup -GitArgs @('clone', $bareRepo, $workRepo)
    Invoke-GuardentraTestGitSetup -WorkDir $workRepo -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $workRepo -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')

    # Advance origin so a subsequent fetch emits normal native stderr on success.
    Set-Content -LiteralPath (Join-Path $seedRepo 'README.md') -Value 'seed-v2' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $seedRepo -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $seedRepo -GitArgs @('commit', '-m', 'advance-for-fetch-stderr')
    Invoke-GuardentraTestGitSetup -WorkDir $seedRepo -GitArgs @('push', 'origin', 'main')

    $script:GuardentraRoot = $workRepo
    # Keep Stop so this proves the wrapper survives PS 5.1 NativeCommandError.
    $ErrorActionPreference = 'Stop'

    $fetchOk = $null
    try {
        $fetchOk = Invoke-GuardentraGit -GitArgs @('fetch', 'origin')
        Assert-True ($true) 'native git fetch with stderr does not terminate wrapper'
    }
    catch {
        $script:Failed++; $script:Failures.Add("native git fetch with stderr does not terminate wrapper (threw: $($_.Exception.Message))")
        Write-Host "FAIL native git fetch with stderr does not terminate wrapper (threw: $($_.Exception.Message))"
    }
    if ($null -ne $fetchOk) {
        Assert-True ($fetchOk.ExitCode -eq 0) 'native git fetch exit code is 0'
        Assert-True ($fetchOk.Output -match '(?i)From |FETCH_HEAD|\bmain\b|\*') 'native git success stderr/stdout diagnostics retained'
    }

    $failGit = Invoke-GuardentraGit -GitArgs @('rev-parse', '--verify', 'refs/heads/does-not-exist-issue-77')
    Assert-True ($failGit.ExitCode -ne 0) 'native git failure returns non-zero exit code'
    Assert-True (-not [string]::IsNullOrWhiteSpace($failGit.Output)) 'native git failure diagnostics available'
    $redactedNative = Protect-GuardentraSecrets -Text ("token=ghp_abcdefghijklmnopqrstuv`n$($failGit.Output)")
    Assert-True ($redactedNative -match 'REDACTED') 'native git diagnostics remain redacted'
    Assert-True ($redactedNative -notmatch 'ghp_abcdefghijklmnopqrstuv') 'secret token not left unredacted'
}
finally {
    $script:GuardentraRoot = $prevGuardentraRoot
    if (Test-Path -LiteralPath $nativeRoot) {
        Remove-Item -LiteralPath $nativeRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- #82: seed-repo init must stay safe when init.defaultBranch=main is
# already set (real git repo + disposable temp dir; no GuardEntra branch
# mutation). Uses `-c` scoped to these invocations only -- never mutates the
# machine's real git config. ---
$forcedRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-native-git-forced-main-' + [guid]::NewGuid().ToString('n'))
$forcedSeed = Join-Path $forcedRoot 'seed'
try {
    New-Item -ItemType Directory -Force -Path $forcedRoot | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('-c', 'init.defaultBranch=main', 'init', $forcedSeed)
    Invoke-GuardentraTestGitSetup -WorkDir $forcedSeed -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $forcedSeed -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')

    $forcedInitialBranch = (Invoke-GuardentraTestGitSetup -WorkDir $forcedSeed -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
    Assert-True ($forcedInitialBranch -eq 'main') 'forced init.defaultBranch=main seeds an unborn main branch'

    $guardThrew = $false
    try {
        Set-GuardentraTestSeedMainBranch -RepoDir $forcedSeed
    }
    catch {
        $guardThrew = $true
        $script:Failed++; $script:Failures.Add("seed fixture guard is safe under init.defaultBranch=main (threw: $($_.Exception.Message))")
        Write-Host "FAIL seed fixture guard is safe under init.defaultBranch=main (threw: $($_.Exception.Message))"
    }
    Assert-True (-not $guardThrew) 'seed fixture guard does not throw when main is already the current branch'

    Set-Content -LiteralPath (Join-Path $forcedSeed 'README.md') -Value 'forced-main-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $forcedSeed -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $forcedSeed -GitArgs @('commit', '-m', 'forced-main-seed')

    $branchesText = Invoke-GuardentraTestGitSetup -WorkDir $forcedSeed -GitArgs @('branch', '--list')
    $mainMatches = [regex]::Matches($branchesText, '(?m)^\*?\s*main\s*$')
    Assert-True ($mainMatches.Count -eq 1) 'exactly one main branch exists after forced init.defaultBranch=main seeding'
}
finally {
    if (Test-Path -LiteralPath $forcedRoot) {
        Remove-Item -LiteralPath $forcedRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- #82 literal acceptance: a TEMPORARY HOME/global git config actually
# forcing init.defaultBranch=main (not `-c`), proving the fix under the real
# condition the issue describes. Only this process's HOME/USERPROFILE point
# at a disposable directory for the duration of this block; both are
# restored in `finally` regardless of outcome. The user's real ~/.gitconfig
# and the GuardEntra repository's own git config are never touched -- the
# temporary .gitconfig lives solely inside the disposable temp HOME.
$tempHomeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-native-git-temphome-' + [guid]::NewGuid().ToString('n'))
$prevHome = $env:HOME
$prevUserProfile = $env:USERPROFILE
$prevGitConfigGlobal = $env:GIT_CONFIG_GLOBAL
$prevGitConfigNoSystem = $env:GIT_CONFIG_NOSYSTEM
try {
    New-Item -ItemType Directory -Force -Path $tempHomeRoot | Out-Null

    # Git for Windows resolves the global config from $HOME first, then
    # $USERPROFILE. Point both at the disposable directory. Clear
    # GIT_CONFIG_GLOBAL so an explicit override already present in this
    # process/session cannot silently redirect `git config --global` away
    # from the disposable HOME. GIT_CONFIG_NOSYSTEM avoids a real machine
    # systemwide config participating in this proof (global still wins over
    # system regardless, but this keeps the fixture fully self-contained).
    $env:HOME = $tempHomeRoot
    $env:USERPROFILE = $tempHomeRoot
    Remove-Item Env:\GIT_CONFIG_GLOBAL -ErrorAction SilentlyContinue
    $env:GIT_CONFIG_NOSYSTEM = '1'

    Invoke-GuardentraTestGitSetup -GitArgs @('config', '--global', 'init.defaultBranch', 'main')

    $tempGlobalConfigPath = Join-Path $tempHomeRoot '.gitconfig'
    Assert-True (Test-Path -LiteralPath $tempGlobalConfigPath) 'temporary HOME .gitconfig file was created (disposable, not the real user config)'

    $confirmedDefaultBranch = (Invoke-GuardentraTestGitSetup -GitArgs @('config', '--global', '--get', 'init.defaultBranch')).Trim()
    Assert-True ($confirmedDefaultBranch -eq 'main') 'temporary global config confirms init.defaultBranch=main via git config --global --get'

    $homeReposRoot = Join-Path $tempHomeRoot 'repos'
    $homeBareRepo = Join-Path $homeReposRoot 'remote.git'
    $homeSeedRepo = Join-Path $homeReposRoot 'seed'
    $homeWorkRepo = Join-Path $homeReposRoot 'work'
    New-Item -ItemType Directory -Force -Path $homeReposRoot | Out-Null

    Invoke-GuardentraTestGitSetup -GitArgs @('init', '--bare', $homeBareRepo)
    # Deliberately plain `git init` -- no -c override -- so this seed repo's
    # unborn branch comes solely from the temporary global config above.
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $homeSeedRepo)
    Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')

    $homeInitialBranch = (Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
    Assert-True ($homeInitialBranch -eq 'main') 'plain git init under temporary global config seeds an unborn main branch'

    $homeGuardThrew = $false
    try {
        Set-GuardentraTestSeedMainBranch -RepoDir $homeSeedRepo
    }
    catch {
        $homeGuardThrew = $true
        $script:Failed++; $script:Failures.Add("production Set-GuardentraTestSeedMainBranch is safe under temporary global init.defaultBranch=main (threw: $($_.Exception.Message))")
        Write-Host "FAIL production Set-GuardentraTestSeedMainBranch is safe under temporary global init.defaultBranch=main (threw: $($_.Exception.Message))"
    }
    Assert-True (-not $homeGuardThrew) 'production Set-GuardentraTestSeedMainBranch does not throw under temporary global init.defaultBranch=main'

    $homeBranchAfterGuard = (Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
    Assert-True ($homeBranchAfterGuard -eq 'main') 'branch remains main after the guard runs under temporary global init.defaultBranch=main'

    Set-Content -LiteralPath (Join-Path $homeSeedRepo 'README.md') -Value 'temphome-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('commit', '-m', 'temphome-seed')

    $homeBranchesText = Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('branch', '--list')
    $homeMainMatches = [regex]::Matches($homeBranchesText, '(?m)^\*?\s*main\s*$')
    Assert-True ($homeMainMatches.Count -eq 1) 'exactly one main branch exists after seeding under temporary global init.defaultBranch=main'

    Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('remote', 'add', 'origin', $homeBareRepo)
    Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('push', '-u', 'origin', 'main')
    Invoke-GuardentraTestGitSetup -GitArgs @('clone', $homeBareRepo, $homeWorkRepo)
    Invoke-GuardentraTestGitSetup -WorkDir $homeWorkRepo -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $homeWorkRepo -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')

    # Advance origin so a subsequent fetch emits normal native stderr on
    # success -- re-proves the #77 wrapper fix itself (not only the seed
    # branch guard) keeps working with a forced global init.defaultBranch=main.
    Set-Content -LiteralPath (Join-Path $homeSeedRepo 'README.md') -Value 'temphome-v2' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('commit', '-m', 'temphome-advance-for-fetch-stderr')
    Invoke-GuardentraTestGitSetup -WorkDir $homeSeedRepo -GitArgs @('push', 'origin', 'main')

    $prevGuardentraRootHome = $script:GuardentraRoot
    $prevEapHome = $ErrorActionPreference
    try {
        $script:GuardentraRoot = $homeWorkRepo
        $ErrorActionPreference = 'Stop'

        $homeFetchOk = $null
        try {
            $homeFetchOk = Invoke-GuardentraGit -GitArgs @('fetch', 'origin')
            Assert-True ($true) 'native git fetch with stderr does not terminate wrapper under temporary global init.defaultBranch=main'
        }
        catch {
            $script:Failed++; $script:Failures.Add("native git fetch with stderr does not terminate wrapper under temp HOME (threw: $($_.Exception.Message))")
            Write-Host "FAIL native git fetch with stderr does not terminate wrapper under temp HOME (threw: $($_.Exception.Message))"
        }
        if ($null -ne $homeFetchOk) {
            Assert-True ($homeFetchOk.ExitCode -eq 0) 'native git fetch exit code is 0 under temporary global init.defaultBranch=main'
            Assert-True ($homeFetchOk.Output -match '(?i)From |FETCH_HEAD|\bmain\b|\*') 'native git success diagnostics retained under temporary global init.defaultBranch=main'
        }

        $homeFailGit = Invoke-GuardentraGit -GitArgs @('rev-parse', '--verify', 'refs/heads/does-not-exist-issue-82')
        Assert-True ($homeFailGit.ExitCode -ne 0) 'native git failure returns non-zero exit code under temporary global init.defaultBranch=main'
        Assert-True (-not [string]::IsNullOrWhiteSpace($homeFailGit.Output)) 'native git failure diagnostics available under temporary global init.defaultBranch=main'

        $homeRedacted = Protect-GuardentraSecrets -Text ("token=ghp_abcdefghijklmnopqrstuv`n$($homeFailGit.Output)")
        Assert-True ($homeRedacted -match 'REDACTED') 'native git diagnostics remain redacted under temporary global init.defaultBranch=main'
        Assert-True ($homeRedacted -notmatch 'ghp_abcdefghijklmnopqrstuv') 'secret token not left unredacted under temporary global init.defaultBranch=main'
    }
    finally {
        $ErrorActionPreference = $prevEapHome
        $script:GuardentraRoot = $prevGuardentraRootHome
    }
}
finally {
    if ($null -eq $prevHome) { Remove-Item Env:\HOME -ErrorAction SilentlyContinue } else { $env:HOME = $prevHome }
    if ($null -eq $prevUserProfile) { Remove-Item Env:\USERPROFILE -ErrorAction SilentlyContinue } else { $env:USERPROFILE = $prevUserProfile }
    if ($null -eq $prevGitConfigGlobal) { Remove-Item Env:\GIT_CONFIG_GLOBAL -ErrorAction SilentlyContinue } else { $env:GIT_CONFIG_GLOBAL = $prevGitConfigGlobal }
    if ($null -eq $prevGitConfigNoSystem) { Remove-Item Env:\GIT_CONFIG_NOSYSTEM -ErrorAction SilentlyContinue } else { $env:GIT_CONFIG_NOSYSTEM = $prevGitConfigNoSystem }
    if (Test-Path -LiteralPath $tempHomeRoot) {
        Remove-Item -LiteralPath $tempHomeRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- #66 isolated-worktree-per-agent -----------------------------------

# Part A: DI-mocked unit tests (no real git needed).
Reset-GuardentraTestProviders

Assert-True ((Get-GuardentraWorktreePath -Writer 'Cursor' -IssueNumber 62) -eq (Join-Path (Split-Path -Parent $script:GuardentraRoot) 'guardentra-cursor-62')) 'worktree path follows the guardentra-<writer>-<issue> convention'
Assert-True ((Get-GuardentraWorktreePath -Writer 'CLAUDE' -IssueNumber 66) -eq (Join-Path (Split-Path -Parent $script:GuardentraRoot) 'guardentra-claude-66')) 'worktree path lowercases the writer name'

$script:GuardentraInPrimaryCheckoutProvider = { $true }
Assert-True (Test-GuardentraInPrimaryCheckout) 'primary-checkout provider override returns true'
$script:GuardentraInPrimaryCheckoutProvider = { $false }
Assert-True (-not (Test-GuardentraInPrimaryCheckout)) 'primary-checkout provider override returns false'
$script:GuardentraInPrimaryCheckoutProvider = $null

$contractNoWorktree = New-GuardentraDefaultContract -IssueNumber 66 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
$noThrowLegacy = $true
try { Assert-GuardentraWorktreeMatchesContract -Contract $contractNoWorktree } catch { $noThrowLegacy = $false }
Assert-True $noThrowLegacy 'worktree-match assertion is a no-op for a contract predating #66 (empty worktree_path)'

$contractWithWorktree = New-GuardentraDefaultContract -IssueNumber 66 -Title 't' -StartingMainSha $headA -FeatureBranch $branchName -WriterTool 'cursor'
$contractWithWorktree.worktree_path = $script:GuardentraRoot
$script:GuardentraRepoTopLevelProvider = { $script:GuardentraRoot }
$matchNoThrow = $true
try { Assert-GuardentraWorktreeMatchesContract -Contract $contractWithWorktree } catch { $matchNoThrow = $false }
Assert-True $matchNoThrow 'worktree-match assertion passes when running from the recorded worktree'

$script:GuardentraRepoTopLevelProvider = { 'C:\Users\Someone\repos\guardentra-someone-999' }
Assert-Throws { Assert-GuardentraWorktreeMatchesContract -Contract $contractWithWorktree } 'worktree-match assertion refuses when running from a different worktree' -Match 'REFUSED.*isolated worktree'
$script:GuardentraRepoTopLevelProvider = $null

# Part B: real git (disposable temp repos; the actual GuardEntra repository,
# its branches, and its remotes are never touched).
$primaryRoot66 = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-66-primary-' + [guid]::NewGuid().ToString('n'))
$prevGuardentraRoot66 = $script:GuardentraRoot
try {
    New-Item -ItemType Directory -Force -Path $primaryRoot66 | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $primaryRoot66)
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRoot66 -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRoot66 -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')
    Set-GuardentraTestSeedMainBranch -RepoDir $primaryRoot66
    Set-Content -LiteralPath (Join-Path $primaryRoot66 'README.md') -Value 'primary-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRoot66 -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRoot66 -GitArgs @('commit', '-m', 'primary-seed')
    $primarySha66 = (Invoke-GuardentraTestGitSetup -WorkDir $primaryRoot66 -GitArgs @('rev-parse', 'HEAD')).Trim()

    $script:GuardentraRoot = $primaryRoot66

    # Real Test-GuardentraInPrimaryCheckout (no provider) against a real
    # primary repo must read true.
    Assert-True (Test-GuardentraInPrimaryCheckout) 'real primary repo is detected as the primary checkout'

    # Two different "agents" (writers/issues) each get their own isolated
    # worktree from the same primary -- the exact #62/#63 collision
    # scenario this issue exists to prevent, now proven closed.
    $agentAPath = Join-Path (Split-Path -Parent $primaryRoot66) ('guardentra-66-agentA-' + [guid]::NewGuid().ToString('n'))
    $agentBPath = Join-Path (Split-Path -Parent $primaryRoot66) ('guardentra-66-agentB-' + [guid]::NewGuid().ToString('n'))
    try {
        New-GuardentraIsolatedWorktree -WorktreePath $agentAPath -FeatureBranch 'feat/agent-a-issue-101' -StartingSha $primarySha66
        New-GuardentraIsolatedWorktree -WorktreePath $agentBPath -FeatureBranch 'feat/agent-b-issue-202' -StartingSha $primarySha66

        # Primary is untouched by either provisioning call -- still on main,
        # still clean, no branch switch happened in the shared checkout.
        $primaryBranchAfter = (Invoke-GuardentraTestGitSetup -WorkDir $primaryRoot66 -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
        Assert-True ($primaryBranchAfter -eq 'main') 'primary checkout branch is unchanged after provisioning two isolated worktrees'
        $primaryStatusAfter = Invoke-GuardentraTestGitSetup -WorkDir $primaryRoot66 -GitArgs @('status', '--porcelain')
        Assert-True ([string]::IsNullOrWhiteSpace($primaryStatusAfter)) 'primary checkout remains clean after provisioning two isolated worktrees'

        # Real Test-GuardentraInPrimaryCheckout against each linked worktree
        # must read false (this is what makes commit/push-and-pr/evidence
        # safe to run from inside them).
        $script:GuardentraRoot = $agentAPath
        Assert-True (-not (Test-GuardentraInPrimaryCheckout)) 'agent A worktree is detected as non-primary'
        Assert-True ((Invoke-GuardentraTestGitSetup -WorkDir $agentAPath -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim() -eq 'feat/agent-a-issue-101') 'agent A worktree is on its own branch'

        $script:GuardentraRoot = $agentBPath
        Assert-True (-not (Test-GuardentraInPrimaryCheckout)) 'agent B worktree is detected as non-primary'
        Assert-True ((Invoke-GuardentraTestGitSetup -WorkDir $agentBPath -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim() -eq 'feat/agent-b-issue-202') 'agent B worktree is on its own branch'

        # Agent B makes an uncommitted edit. Agent A's worktree must not see it
        # -- true filesystem isolation, not just a different branch name.
        Set-Content -LiteralPath (Join-Path $agentBPath 'agent-b-only.txt') -Value 'b' -Encoding utf8
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $agentAPath 'agent-b-only.txt'))) 'agent B uncommitted edit is invisible in agent A worktree (real filesystem isolation)'

        # The concurrent-agent safety property required by #66: a contract
        # bound to agent A's worktree refuses to authorize action while the
        # process is actually sitting in agent B's worktree (or vice versa)
        # -- this is the mechanism that makes it impossible for one agent's
        # dispatcher invocation to mutate another agent's branch/worktree.
        $contractAgentA = New-GuardentraDefaultContract -IssueNumber 101 -Title 'agent A' -StartingMainSha $primarySha66 -FeatureBranch 'feat/agent-a-issue-101' -WriterTool 'cursor'
        $contractAgentA.worktree_path = $agentAPath

        $script:GuardentraRoot = $agentAPath
        $matchesOwn = $true
        try { Assert-GuardentraWorktreeMatchesContract -Contract $contractAgentA } catch { $matchesOwn = $false }
        Assert-True $matchesOwn 'agent A contract matches when actually running from agent A worktree'

        $script:GuardentraRoot = $agentBPath
        Assert-Throws { Assert-GuardentraWorktreeMatchesContract -Contract $contractAgentA } 'agent A contract is refused from agent B worktree (cannot cross-mutate another agent''s branch)' -Match 'REFUSED.*isolated worktree'
    }
    finally {
        $script:GuardentraRoot = $primaryRoot66
        foreach ($p in @($agentAPath, $agentBPath)) {
            if (Test-Path -LiteralPath $p) {
                Invoke-GuardentraTestGitSetup -WorkDir $primaryRoot66 -GitArgs @('worktree', 'remove', '--force', $p)
            }
        }
    }
}
finally {
    $script:GuardentraRoot = $prevGuardentraRoot66
    if (Test-Path -LiteralPath $primaryRoot66) {
        Remove-Item -LiteralPath $primaryRoot66 -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- #66 P0 correction: the REAL Invoke-GuardentraStart decision path,
# real git, GitHub-only calls DI-mocked (issue record + dispatch comment).
# Assert-GuardentraRepository is NOT touched, bypassed, or weakened: origin
# is set to the real, literal GitHub URL text and `git remote get-url
# origin` is called for real, so that check genuinely and unweakened
# passes/fails on its own regex. (`git remote get-url` always reports the
# post-insteadOf *effective* URL in this git version -- there is no --raw
# flag -- so a local insteadOf-rewrite mirror cannot be used here without
# also corrupting that identity check; deliberately not attempted.)
#
# The "start from primary" positive path does reach
# Sync-GuardentraMainAndValidate, which normally does a real
# `git fetch origin` + `git pull --ff-only origin main`. Only that specific
# network-touching step is redirected via the pre-existing
# GuardentraFetchAndFfPullMainProvider DI seam (defaults to the real fetch
# hitting real origin in production, untouched here except for this test's
# override) to its local-fixture equivalent -- the fixture's local `main`
# is already the authoritative tip, so there is nothing to fetch. This
# keeps the origin-identity check completely real while requiring no
# network access, per "a network-backed fake-origin E2E is NOT required."
#
# $script:GuardentraStateRoot does not automatically follow
# $script:GuardentraRoot (it is a separate script variable, normally fixed
# once per real process at dot-source time). Simulating "a fresh process
# physically located in worktree X" within this single test process
# therefore requires moving both together on every switch, or contract
# read/write would silently hit the wrong location and any resulting
# pass/fail would prove nothing about the real ownership decision.
function Set-GuardentraTestActiveRoot {
    param([Parameter(Mandatory)][string]$Root)
    $script:GuardentraRoot = $Root
    $script:GuardentraStateRoot = Join-Path $Root 'scripts\guardentra\state\issues'
}

Reset-GuardentraTestProviders
$ownPrimaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-66-own-primary-' + [guid]::NewGuid().ToString('n'))
$prevGuardentraRootOwn = $script:GuardentraRoot
$prevGuardentraStateRootOwn = $script:GuardentraStateRoot
try {
    New-Item -ItemType Directory -Force -Path $ownPrimaryRoot | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $ownPrimaryRoot)
    Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')
    Set-GuardentraTestSeedMainBranch -RepoDir $ownPrimaryRoot
    Set-Content -LiteralPath (Join-Path $ownPrimaryRoot 'README.md') -Value 'own-primary-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('commit', '-m', 'own-primary-seed')

    # Real, literal GitHub URL -- read for real by Assert-GuardentraRepository
    # via a real `git remote get-url origin`, never rewritten or DI-mocked.
    $githubOriginUrl = 'https://github.com/akurteshi-guardentra/guardentra.git'
    Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('remote', 'add', 'origin', $githubOriginUrl)
    $ownPrimarySha = (Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('rev-parse', 'HEAD')).Trim()

    # Only the network-touching fetch/pull step is stubbed (see block
    # comment above) -- the fixture's local main is already the
    # authoritative tip, so a real fetch/pull would have nothing to do
    # besides dial network that does not need to exist for this test.
    $script:GuardentraFetchAndFfPullMainProvider = {
        param($CurrentBranch)
        if ($CurrentBranch -ne 'main') {
            $co = Invoke-GuardentraGit -GitArgs @('checkout', 'main')
            if ($co.ExitCode -ne 0) { throw "checkout main failed: $($co.Output)" }
        }
    }

    $script:GuardentraIssueRecordProvider = {
        param($IssueNumber)
        [pscustomobject]@{
            Number = $IssueNumber; Title = "issue $IssueNumber"; State = 'OPEN'
            Body = ''; AuthorLogin = $owner; AcceptanceCriteria = @()
        }
    }

    # --- START FROM PRIMARY: must succeed, provision an isolated worktree,
    # and leave the primary itself untouched on main. ---
    Set-GuardentraTestActiveRoot -Root $ownPrimaryRoot
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-303' -Sha $ownPrimarySha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/303#issuecomment-1')
    }
    $startFromPrimaryOk = $true
    $contract303 = $null
    try {
        $contract303 = Invoke-GuardentraStart -IssueNumber 303 -Writer cursor -Branch 'feat/issue-303' -AccessTier T1
    }
    catch {
        $startFromPrimaryOk = $false
        $script:Failed++; $script:Failures.Add("start from primary checkout succeeds (threw: $($_.Exception.Message))")
        Write-Host "FAIL start from primary checkout succeeds (threw: $($_.Exception.Message))"
    }
    Assert-True $startFromPrimaryOk 'start from primary checkout succeeds and provisions an isolated worktree'
    if ($startFromPrimaryOk) {
        Assert-True (-not [string]::IsNullOrWhiteSpace([string]$contract303.worktree_path)) 'start from primary records a non-empty worktree_path in the contract'
        $primaryBranchAfter303 = (Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
        Assert-True ($primaryBranchAfter303 -eq 'main') 'primary checkout branch is unchanged after start provisions an isolated worktree'
        $primaryStatusAfter303 = Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('status', '--porcelain')
        Assert-True ([string]::IsNullOrWhiteSpace($primaryStatusAfter303)) 'primary checkout remains clean after start provisions an isolated worktree (#85 regression B)'
    }

    # --- START SAME ISSUE FROM CORRECT LINKED WORKTREE: must succeed
    # (the "continue" path), running from exactly the worktree start #303
    # just created. ---
    $continueOk = $true
    if ($startFromPrimaryOk) {
        Set-GuardentraTestActiveRoot -Root ([string]$contract303.worktree_path)
        try {
            $null = Invoke-GuardentraStart -IssueNumber 303 -Writer cursor -Branch 'feat/issue-303' -AccessTier T1
        }
        catch {
            $continueOk = $false
            $script:Failed++; $script:Failures.Add("start (continue) from the issue's own correct worktree succeeds (threw: $($_.Exception.Message))")
            Write-Host "FAIL start (continue) from the issue's own correct worktree succeeds (threw: $($_.Exception.Message))"
        }
    }
    else {
        $continueOk = $false
    }
    Assert-True $continueOk 'start (continue) from the issue''s own correct linked worktree succeeds'

    # --- START DIFFERENT ISSUE FROM ANOTHER AGENT'S WORKTREE: must be
    # REFUSED before any checkout/branch/contract/packet mutation, proving
    # the P0 ownership gap is actually closed. ---
    Set-GuardentraTestActiveRoot -Root $ownPrimaryRoot
    $agentAWorktree = Join-Path (Split-Path -Parent $ownPrimaryRoot) ('guardentra-66-agentA-own-' + [guid]::NewGuid().ToString('n'))
    try {
        New-GuardentraIsolatedWorktree -WorktreePath $agentAWorktree -FeatureBranch 'feat/agent-a-issue-301' -StartingSha $ownPrimarySha
        Set-Content -LiteralPath (Join-Path $agentAWorktree 'agent-a-uncommitted.txt') -Value 'agent-a-original-content' -Encoding utf8

        Set-GuardentraTestActiveRoot -Root $agentAWorktree
        $script:GuardentraAuthorityCommentsProvider = {
            param($IssueNumber)
            @(New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/agent-b-issue-302' -Sha $ownPrimarySha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/302#issuecomment-1')
        }

        $crossIssueRefused = $false
        try {
            Invoke-GuardentraStart -IssueNumber 302 -Writer cursor -Branch 'feat/agent-b-issue-302' -AccessTier T1 | Out-Null
        }
        catch {
            $crossIssueRefused = ($_.Exception.Message -match 'REFUSED')
        }
        Assert-True $crossIssueRefused 'start for a different issue is REFUSED while physically inside another issue''s worktree (#66 P0 correction)'

        $worktreeABranchAfter = (Invoke-GuardentraTestGitSetup -WorkDir $agentAWorktree -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
        Assert-True ($worktreeABranchAfter -eq 'feat/agent-a-issue-301') 'worktree A branch is unchanged after the refused cross-issue start attempt'
        Assert-True (Test-Path -LiteralPath (Join-Path $agentAWorktree 'agent-a-uncommitted.txt')) 'worktree A uncommitted file still exists after the refused cross-issue start attempt'
        Assert-True ((Get-Content -LiteralPath (Join-Path $agentAWorktree 'agent-a-uncommitted.txt') -Raw).Trim() -eq 'agent-a-original-content') 'worktree A uncommitted file content is unchanged after the refused cross-issue start attempt'

        $branchBListInA = Invoke-GuardentraTestGitSetup -WorkDir $agentAWorktree -GitArgs @('branch', '--list', 'feat/agent-b-issue-302')
        Assert-True ([string]::IsNullOrWhiteSpace($branchBListInA)) 'no branch for the other issue was created inside worktree A'
        Assert-True (-not (Test-Path -LiteralPath (Join-Path $agentAWorktree 'scripts\guardentra\state\issues\302'))) 'no contract/task-packet for the other issue was written into worktree A'

        Set-GuardentraTestActiveRoot -Root $ownPrimaryRoot
        $primaryBranchAfterRefusal = (Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
        Assert-True ($primaryBranchAfterRefusal -eq 'main') 'primary checkout branch is unchanged after the refused cross-issue start attempt'
    }
    finally {
        Set-GuardentraTestActiveRoot -Root $ownPrimaryRoot
        if (Test-Path -LiteralPath $agentAWorktree) {
            Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('worktree', 'remove', '--force', $agentAWorktree)
        }
    }
}
finally {
    # Deliberately unconditional and independent of $startFromPrimaryOk /
    # where an exception was thrown above: `Get-GuardentraWorktreePath`
    # is deterministic (guardentra-cursor-303), so any run that creates it
    # but dies before the inner cleanup above runs must still remove it --
    # otherwise the NEXT run collides with this run's leftover worktree
    # ("already exists") instead of exercising real logic.
    Set-GuardentraTestActiveRoot -Root $ownPrimaryRoot
    if (Test-Path -LiteralPath $ownPrimaryRoot) {
        $leftoverWorktree303 = Get-GuardentraWorktreePath -Writer 'cursor' -IssueNumber 303
        if (Test-Path -LiteralPath $leftoverWorktree303) {
            try {
                Invoke-GuardentraTestGitSetup -WorkDir $ownPrimaryRoot -GitArgs @('worktree', 'remove', '--force', $leftoverWorktree303)
            }
            catch {
                Remove-Item -LiteralPath $leftoverWorktree303 -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Reset-GuardentraTestProviders
    $script:GuardentraRoot = $prevGuardentraRootOwn
    $script:GuardentraStateRoot = $prevGuardentraStateRootOwn
    if (Test-Path -LiteralPath $ownPrimaryRoot) {
        Remove-Item -LiteralPath $ownPrimaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- #66/#85 correction cycle 1: a linked worktree (or an off-main primary
# checkout) must never run `git checkout main` / `git switch main`. ---

# Regression A: primary checkout parked on a non-main branch is REFUSED
# before any mutation, never silently switched onto main.
Reset-GuardentraTestProviders
$primaryRootA = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-85-primaryA-' + [guid]::NewGuid().ToString('n'))
$prevRootA = $script:GuardentraRoot
$prevStateRootA = $script:GuardentraStateRoot
try {
    New-Item -ItemType Directory -Force -Path $primaryRootA | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $primaryRootA)
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootA -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootA -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')
    Set-GuardentraTestSeedMainBranch -RepoDir $primaryRootA
    Set-Content -LiteralPath (Join-Path $primaryRootA 'README.md') -Value 'primaryA-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootA -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootA -GitArgs @('commit', '-m', 'primaryA-seed')
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootA -GitArgs @('remote', 'add', 'origin', 'https://github.com/akurteshi-guardentra/guardentra.git')
    $primaryAMainSha = (Invoke-GuardentraTestGitSetup -WorkDir $primaryRootA -GitArgs @('rev-parse', 'HEAD')).Trim()

    # Park the shared primary checkout on a non-main branch -- the anomalous
    # state #85 requires a fail-closed refusal for, instead of a silent
    # `git checkout main`.
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootA -GitArgs @('checkout', '-b', 'some-other-branch')

    Set-GuardentraTestActiveRoot -Root $primaryRootA
    $script:GuardentraIssueRecordProvider = {
        param($IssueNumber)
        [pscustomobject]@{
            Number = $IssueNumber; Title = "issue $IssueNumber"; State = 'OPEN'
            Body = ''; AuthorLogin = $owner; AcceptanceCriteria = @()
        }
    }
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-401' -Sha $primaryAMainSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/401#issuecomment-1')
    }

    $expectedWorktreeA = Get-GuardentraWorktreePath -Writer 'cursor' -IssueNumber 401
    Assert-Throws { Invoke-GuardentraStart -IssueNumber 401 -Writer cursor -Branch 'feat/issue-401' -AccessTier T1 | Out-Null } `
        'start from a primary checkout parked on a non-main branch is REFUSED before any mutation (#85 regression A)' `
        -Match 'REFUSED.*primary checkout is not on main'

    $primaryBranchAfterA = (Invoke-GuardentraTestGitSetup -WorkDir $primaryRootA -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
    Assert-True ($primaryBranchAfterA -eq 'some-other-branch') 'primary checkout branch is unchanged after the refused off-main start attempt (#85 regression A)'
    $primaryStatusAfterA = Invoke-GuardentraTestGitSetup -WorkDir $primaryRootA -GitArgs @('status', '--porcelain')
    Assert-True ([string]::IsNullOrWhiteSpace($primaryStatusAfterA)) 'primary checkout remains clean after the refused off-main start attempt (#85 regression A)'
    Assert-True (-not (Test-Path -LiteralPath $expectedWorktreeA)) 'no isolated worktree was created after the refused off-main start attempt (#85 regression A)'
    Assert-True (-not (Test-Path -LiteralPath (Get-GuardentraContractPath -IssueNumber 401))) 'no contract was written after the refused off-main start attempt (#85 regression A)'
}
finally {
    Reset-GuardentraTestProviders
    $script:GuardentraRoot = $prevRootA
    $script:GuardentraStateRoot = $prevStateRootA
    if (Test-Path -LiteralPath $primaryRootA) {
        Remove-Item -LiteralPath $primaryRootA -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Regression C: an owned linked worktree that has drifted off its authorized
# feature branch is REFUSED before any mutation -- it must never borrow or
# check out main inside that linked worktree.
Reset-GuardentraTestProviders
$primaryRootC = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-85-primaryC-' + [guid]::NewGuid().ToString('n'))
$prevRootC = $script:GuardentraRoot
$prevStateRootC = $script:GuardentraStateRoot
try {
    New-Item -ItemType Directory -Force -Path $primaryRootC | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $primaryRootC)
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootC -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootC -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')
    Set-GuardentraTestSeedMainBranch -RepoDir $primaryRootC
    Set-Content -LiteralPath (Join-Path $primaryRootC 'README.md') -Value 'primaryC-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootC -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootC -GitArgs @('commit', '-m', 'primaryC-seed')
    Invoke-GuardentraTestGitSetup -WorkDir $primaryRootC -GitArgs @('remote', 'add', 'origin', 'https://github.com/akurteshi-guardentra/guardentra.git')
    $primaryCMainSha = (Invoke-GuardentraTestGitSetup -WorkDir $primaryRootC -GitArgs @('rev-parse', 'HEAD')).Trim()

    # Only the network-touching fetch/pull step is stubbed (see the block
    # comment above the #303 scenario); the fixture's local main is already
    # the authoritative tip.
    $script:GuardentraFetchAndFfPullMainProvider = { param($CurrentBranch) }
    $script:GuardentraIssueRecordProvider = {
        param($IssueNumber)
        [pscustomobject]@{
            Number = $IssueNumber; Title = "issue $IssueNumber"; State = 'OPEN'
            Body = ''; AuthorLogin = $owner; AcceptanceCriteria = @()
        }
    }
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-402' -Sha $primaryCMainSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/402#issuecomment-1')
    }

    # Provision the isolated worktree the normal way (start from primary).
    Set-GuardentraTestActiveRoot -Root $primaryRootC
    $contract402 = Invoke-GuardentraStart -IssueNumber 402 -Writer cursor -Branch 'feat/issue-402' -AccessTier T1
    $worktree402 = [string]$contract402.worktree_path

    # Simulate external interference: something checked out a different,
    # unrelated branch inside the linked worktree, so it is no longer on its
    # authorized feature branch -- the anomalous state #85 regression C
    # covers. New-GuardentraIsolatedWorktree never leaves a worktree in this
    # state on its own.
    Invoke-GuardentraTestGitSetup -WorkDir $worktree402 -GitArgs @('checkout', '-b', 'stray-branch')
    Set-Content -LiteralPath (Join-Path $worktree402 'stray-uncommitted.txt') -Value 'stray-original-content' -Encoding utf8

    Set-GuardentraTestActiveRoot -Root $worktree402
    Assert-Throws { Invoke-GuardentraStart -IssueNumber 402 -Writer cursor -Branch 'feat/issue-402' -AccessTier T1 | Out-Null } `
        'start inside an owned linked worktree that drifted off its feature branch is REFUSED before any mutation, never borrowing main (#85 regression C)' `
        -Match 'REFUSED.*not the authorized feature branch'

    $worktreeBranchAfter = (Invoke-GuardentraTestGitSetup -WorkDir $worktree402 -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
    Assert-True ($worktreeBranchAfter -eq 'stray-branch') 'linked worktree branch is unchanged (no checkout of main was attempted) after the refused drifted-branch start attempt (#85 regression C)'
    Assert-True (Test-Path -LiteralPath (Join-Path $worktree402 'stray-uncommitted.txt')) 'linked worktree uncommitted file still exists after the refused drifted-branch start attempt (#85 regression C)'
    Assert-True ((Get-Content -LiteralPath (Join-Path $worktree402 'stray-uncommitted.txt') -Raw).Trim() -eq 'stray-original-content') 'linked worktree uncommitted file content is unchanged after the refused drifted-branch start attempt (#85 regression C)'

    Set-GuardentraTestActiveRoot -Root $primaryRootC
    $primaryBranchAfterC = (Invoke-GuardentraTestGitSetup -WorkDir $primaryRootC -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
    Assert-True ($primaryBranchAfterC -eq 'main') 'primary checkout branch is unchanged after the refused drifted-branch start attempt in a linked worktree (#85 regression C)'
    $primaryStatusAfterC = Invoke-GuardentraTestGitSetup -WorkDir $primaryRootC -GitArgs @('status', '--porcelain')
    Assert-True ([string]::IsNullOrWhiteSpace($primaryStatusAfterC)) 'primary checkout remains clean after the refused drifted-branch start attempt in a linked worktree (#85 regression C)'
}
finally {
    Set-GuardentraTestActiveRoot -Root $primaryRootC
    if (Test-Path -LiteralPath $primaryRootC) {
        $leftoverWorktree402 = Get-GuardentraWorktreePath -Writer 'cursor' -IssueNumber 402
        if (Test-Path -LiteralPath $leftoverWorktree402) {
            try {
                Invoke-GuardentraTestGitSetup -WorkDir $primaryRootC -GitArgs @('worktree', 'remove', '--force', $leftoverWorktree402)
            }
            catch {
                Remove-Item -LiteralPath $leftoverWorktree402 -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
    Reset-GuardentraTestProviders
    $script:GuardentraRoot = $prevRootC
    $script:GuardentraStateRoot = $prevStateRootC
    if (Test-Path -LiteralPath $primaryRootC) {
        Remove-Item -LiteralPath $primaryRootC -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- #66/#85 correction cycle 2: Invoke-GuardentraCommit's single-use grant
# content_digest must be scoped to exactly the pending (not-yet-committed)
# paths, never mixed with the branch's cumulative committed history -- or a
# second commit on an already-advanced branch becomes impossible to
# authorize with one grant. ---

function New-GuardentraCommitTestFixture {
    <#
      Real temp git repo seeded with one already-committed correction
      (Commands.ps1, Common.ps1, Run-Tests.ps1 under scripts/guardentra/),
      then a second, still-uncommitted correction touching only Commands.ps1
      and Run-Tests.ps1. scripts/guardentra/tests/Run-Tests.ps1 is a trivial
      exit-0 stub so the contract's real required_tests command
      (`powershell -File scripts/guardentra/tests/Run-Tests.ps1`) can run for
      real against this fixture without recursively executing the actual
      dispatcher suite.
    #>
    param([Parameter(Mandatory)][string]$RepoDir, [Parameter(Mandatory)][string]$FeatureBranch)
    New-Item -ItemType Directory -Force -Path $RepoDir | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $RepoDir) | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test') | Out-Null
    Set-GuardentraTestSeedMainBranch -RepoDir $RepoDir | Out-Null
    Set-Content -LiteralPath (Join-Path $RepoDir 'README.md') -Value 'main-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('add', 'README.md') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('commit', '-m', 'main-seed') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('remote', 'add', 'origin', 'https://github.com/akurteshi-guardentra/guardentra.git') | Out-Null
    $baseSha = (Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('rev-parse', 'HEAD')).Trim()

    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('checkout', '-b', $FeatureBranch) | Out-Null

    $gDir = Join-Path $RepoDir 'scripts\guardentra'
    $tDir = Join-Path $gDir 'tests'
    New-Item -ItemType Directory -Force -Path $tDir | Out-Null
    Set-Content -LiteralPath (Join-Path $gDir 'Commands.ps1') -Value '# Commands v1' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $gDir 'Common.ps1') -Value '# Common v1' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $tDir 'Run-Tests.ps1') -Value 'exit 0' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('add', 'scripts/guardentra/Commands.ps1', 'scripts/guardentra/Common.ps1', 'scripts/guardentra/tests/Run-Tests.ps1') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('commit', '-m', 'first correction: v1') | Out-Null
    $firstCommitSha = (Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('rev-parse', 'HEAD')).Trim()

    # Second, still-uncommitted correction: only Commands.ps1 and
    # Run-Tests.ps1 change. Common.ps1 is untouched (already committed).
    Set-Content -LiteralPath (Join-Path $gDir 'Commands.ps1') -Value '# Commands v2 (correction cycle 2)' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $tDir 'Run-Tests.ps1') -Value 'exit 0 # v2' -Encoding utf8

    return [pscustomobject]@{
        BaseSha        = $baseSha
        FirstCommitSha = $firstCommitSha
    }
}

Reset-GuardentraTestProviders
$commitRepoRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-85-commit-' + [guid]::NewGuid().ToString('n'))
$prevRootCommit = $script:GuardentraRoot
$prevStateRootCommit = $script:GuardentraStateRoot
try {
    $fixture = New-GuardentraCommitTestFixture -RepoDir $commitRepoRoot -FeatureBranch 'feat/issue-900'
    $script:GuardentraRoot = $commitRepoRoot

    $toStagePaths = @('scripts/guardentra/Commands.ps1', 'scripts/guardentra/tests/Run-Tests.ps1')
    $pendingDigest = Get-GuardentraCandidateContentDigest -BaseSha $fixture.BaseSha -Paths $toStagePaths
    $cumulativeChanged = @(Get-GuardentraChangedFiles -BaseSha $fixture.BaseSha)
    $cumulativeDigest = Get-GuardentraCandidateContentDigest -BaseSha $fixture.BaseSha -Paths $cumulativeChanged

    Assert-True ($cumulativeChanged -contains 'scripts/guardentra/Common.ps1') 'cumulative changed-files set still includes a file only touched by the prior commit (#85 regression cycle 2)'
    Assert-True (-not ($toStagePaths -contains 'scripts/guardentra/Common.ps1')) 'pending (to-stage) paths do not include the untouched, already-committed Common.ps1 (#85 regression cycle 2)'
    Assert-True ($pendingDigest -ne $cumulativeDigest) 'pending-files digest differs from the cumulative (buggy pre-fix) digest -- proves the two scopes are genuinely different (#85 regression cycle 2)'

    $contract900 = New-GuardentraDefaultContract -IssueNumber 900 -Title 'issue 900' -StartingMainSha $fixture.BaseSha `
        -FeatureBranch 'feat/issue-900' -WriterTool 'cursor'
    $contract900.worktree_path = $commitRepoRoot
    Save-GuardentraContract -IssueNumber 900 -Contract $contract900

    $script:GuardentraIssueRecordProvider = {
        param($IssueNumber)
        [pscustomobject]@{ Number = $IssueNumber; Title = "issue $IssueNumber"; State = 'OPEN'; Body = ''; AuthorLogin = $owner; AcceptanceCriteria = @() }
    }

    # --- Mismatched digest is refused before any mutation. ---
    $wrongDigest = ('0' * 64)
    $grantWrong = New-TestOwnerGrant -Action 'commit' -Head $fixture.FirstCommitSha -Digest $wrongDigest -Issue 900 -Branch 'feat/issue-900' -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/900#issuecomment-2'
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(
            (New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-900' -Sha $fixture.BaseSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/900#issuecomment-1'),
            (New-AuthorityComment -Body (New-GrantBody -Grant $grantWrong) -Login $owner -Id 2 -SourceRef $grantWrong.source_ref)
        )
    }
    Invoke-GuardentraSyncGrants -IssueNumber 900 | Out-Null

    Assert-Throws { Invoke-GuardentraCommit -IssueNumber 900 -Message 'should not commit' | Out-Null } `
        'a commit grant digest that does not match the pending-files-only digest is REFUSED before staging or committing (#85 regression cycle 2)' `
        -Match 'REFUSED.*content_digest'

    $headAfterMismatch = (Invoke-GuardentraTestGitSetup -WorkDir $commitRepoRoot -GitArgs @('rev-parse', 'HEAD')).Trim()
    Assert-True ($headAfterMismatch -eq $fixture.FirstCommitSha) 'HEAD is unchanged after the refused mismatched-digest commit attempt (#85 regression cycle 2)'
    $stagedAfterMismatch = Invoke-GuardentraTestGitSetup -WorkDir $commitRepoRoot -GitArgs @('diff', '--cached', '--name-only')
    Assert-True ([string]::IsNullOrWhiteSpace($stagedAfterMismatch)) 'nothing was staged after the refused mismatched-digest commit attempt (#85 regression cycle 2)'

    # --- Correct pending-files-only digest passes both pre-stage and
    # post-stage verification, and the commit succeeds. ---
    $grantCorrect = New-TestOwnerGrant -Action 'commit' -Head $fixture.FirstCommitSha -Digest $pendingDigest -Issue 900 -Branch 'feat/issue-900' -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/900#issuecomment-3'
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(
            (New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-900' -Sha $fixture.BaseSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/900#issuecomment-1'),
            (New-AuthorityComment -Body (New-GrantBody -Grant $grantCorrect) -Login $owner -Id 3 -SourceRef $grantCorrect.source_ref)
        )
    }
    Invoke-GuardentraSyncGrants -IssueNumber 900 | Out-Null

    $commitOk = $true
    try {
        Invoke-GuardentraCommit -IssueNumber 900 -Message 'second correction commit' | Out-Null
    }
    catch {
        $commitOk = $false
        $script:Failed++; $script:Failures.Add("commit with a pending-files-only grant digest succeeds (threw: $($_.Exception.Message))")
        Write-Host "FAIL commit with a pending-files-only grant digest succeeds (threw: $($_.Exception.Message))"
    }
    Assert-True $commitOk 'a commit grant digest scoped to only the pending files passes both pre-stage and post-stage verification and commits (#85 regression cycle 2)'

    if ($commitOk) {
        $headAfterCommit = (Invoke-GuardentraTestGitSetup -WorkDir $commitRepoRoot -GitArgs @('rev-parse', 'HEAD')).Trim()
        Assert-True ($headAfterCommit -ne $fixture.FirstCommitSha) 'HEAD advanced after the successful second correction commit (#85 regression cycle 2)'
        $statusAfterCommit = Invoke-GuardentraTestGitSetup -WorkDir $commitRepoRoot -GitArgs @('status', '--porcelain')
        Assert-True ([string]::IsNullOrWhiteSpace($statusAfterCommit)) 'worktree is clean after the successful second correction commit (#85 regression cycle 2)'
        $contractAfterCommit = Read-GuardentraContract -IssueNumber 900
        Assert-True (-not [bool]$contractAfterCommit.auth_commit.enabled) 'commit grant is consumed after the successful second correction commit (#85 regression cycle 2)'
    }
}
finally {
    Reset-GuardentraTestProviders
    $script:GuardentraRoot = $prevRootCommit
    $script:GuardentraStateRoot = $prevStateRootCommit
    if (Test-Path -LiteralPath $commitRepoRoot) {
        Remove-Item -LiteralPath $commitRepoRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- The cumulative branch changed-files allowlist check still fires even
# when the pending (to-stage) files are all allowed -- proving it was kept,
# not removed/weakened, by the pending-only digest fix above. ---
Reset-GuardentraTestProviders
$cumulativeRepoRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-85-cumulative-' + [guid]::NewGuid().ToString('n'))
$prevRootCumulative = $script:GuardentraRoot
$prevStateRootCumulative = $script:GuardentraStateRoot
try {
    New-Item -ItemType Directory -Force -Path $cumulativeRepoRoot | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $cumulativeRepoRoot)
    Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local')
    Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test')
    Set-GuardentraTestSeedMainBranch -RepoDir $cumulativeRepoRoot
    Set-Content -LiteralPath (Join-Path $cumulativeRepoRoot 'README.md') -Value 'main-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('add', 'README.md')
    Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('commit', '-m', 'main-seed')
    Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('remote', 'add', 'origin', 'https://github.com/akurteshi-guardentra/guardentra.git')
    $cumulativeBaseSha = (Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('rev-parse', 'HEAD')).Trim()

    Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('checkout', '-b', 'feat/issue-901')
    $gDir901 = Join-Path $cumulativeRepoRoot 'scripts\guardentra'
    $tDir901 = Join-Path $gDir901 'tests'
    New-Item -ItemType Directory -Force -Path $tDir901 | Out-Null
    Set-Content -LiteralPath (Join-Path $gDir901 'Commands.ps1') -Value '# Commands v1' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $tDir901 'Run-Tests.ps1') -Value 'exit 0' -Encoding utf8
    # A previously committed file OUTSIDE the allowlist -- must still be
    # caught by the cumulative changed-files check, even though it is not
    # part of the current pending (to-stage) diff at all.
    $srcDir901 = Join-Path $cumulativeRepoRoot 'src'
    New-Item -ItemType Directory -Force -Path $srcDir901 | Out-Null
    Set-Content -LiteralPath (Join-Path $srcDir901 'blocked.ts') -Value 'export const blocked = true;' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('add', 'scripts/guardentra/Commands.ps1', 'scripts/guardentra/tests/Run-Tests.ps1', 'src/blocked.ts')
    Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('commit', '-m', 'first correction (includes a disallowed path)')
    $cumulativeFirstCommitSha = (Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('rev-parse', 'HEAD')).Trim()

    # Pending change touches only an allowed path.
    Set-Content -LiteralPath (Join-Path $gDir901 'Commands.ps1') -Value '# Commands v2' -Encoding utf8

    $script:GuardentraRoot = $cumulativeRepoRoot
    $pendingToStage901 = @('scripts/guardentra/Commands.ps1')
    $pendingDigest901 = Get-GuardentraCandidateContentDigest -BaseSha $cumulativeBaseSha -Paths $pendingToStage901

    $contract901 = New-GuardentraDefaultContract -IssueNumber 901 -Title 'issue 901' -StartingMainSha $cumulativeBaseSha `
        -FeatureBranch 'feat/issue-901' -WriterTool 'cursor'
    $contract901.worktree_path = $cumulativeRepoRoot
    Save-GuardentraContract -IssueNumber 901 -Contract $contract901

    $script:GuardentraIssueRecordProvider = {
        param($IssueNumber)
        [pscustomobject]@{ Number = $IssueNumber; Title = "issue $IssueNumber"; State = 'OPEN'; Body = ''; AuthorLogin = $owner; AcceptanceCriteria = @() }
    }
    $grant901 = New-TestOwnerGrant -Action 'commit' -Head $cumulativeFirstCommitSha -Digest $pendingDigest901 -Issue 901 -Branch 'feat/issue-901' -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/901#issuecomment-2'
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(
            (New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-901' -Sha $cumulativeBaseSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/901#issuecomment-1'),
            (New-AuthorityComment -Body (New-GrantBody -Grant $grant901) -Login $owner -Id 2 -SourceRef $grant901.source_ref)
        )
    }
    Invoke-GuardentraSyncGrants -IssueNumber 901 | Out-Null

    Assert-Throws { Invoke-GuardentraCommit -IssueNumber 901 -Message 'should not commit' | Out-Null } `
        'the cumulative branch changed-files allowlist check still refuses a prior committed disallowed path, even though the pending files are all allowed and their digest matches the grant (#85 regression cycle 2)' `
        -Match 'REFUSED.*outside allowlist.*src/blocked\.ts'

    $headAfterCumulativeRefusal = (Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('rev-parse', 'HEAD')).Trim()
    Assert-True ($headAfterCumulativeRefusal -eq $cumulativeFirstCommitSha) 'HEAD is unchanged after the cumulative-allowlist refusal (#85 regression cycle 2)'
    $stagedAfterCumulativeRefusal = Invoke-GuardentraTestGitSetup -WorkDir $cumulativeRepoRoot -GitArgs @('diff', '--cached', '--name-only')
    Assert-True ([string]::IsNullOrWhiteSpace($stagedAfterCumulativeRefusal)) 'nothing was staged after the cumulative-allowlist refusal (#85 regression cycle 2)'
}
finally {
    Reset-GuardentraTestProviders
    $script:GuardentraRoot = $prevRootCumulative
    $script:GuardentraStateRoot = $prevStateRootCumulative
    if (Test-Path -LiteralPath $cumulativeRepoRoot) {
        Remove-Item -LiteralPath $cumulativeRepoRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- #88 correction cycle 3: PS 5.1 empty `gh pr list` JSON `[]` ----------
# Real JSON string `[]` must become Count=0. Naively wrapping ConvertFrom-Json
# as @($json | ConvertFrom-Json) yields Count=1 of $null on Windows PowerShell
# 5.1 and breaks push-and-pr before any push (#89 review BLOCKER).

Reset-GuardentraTestProviders

$emptyFromLiteral = @(ConvertFrom-GuardentraOpenPrListJson -JsonText '[]')
Assert-True ($emptyFromLiteral.Count -eq 0) 'ConvertFrom-GuardentraOpenPrListJson on literal JSON [] returns Count 0 (#88 correction cycle 3 / PS 5.1)'

$emptyFromBlank = @(ConvertFrom-GuardentraOpenPrListJson -JsonText '')
Assert-True ($emptyFromBlank.Count -eq 0) 'ConvertFrom-GuardentraOpenPrListJson on blank text returns Count 0 (#88 correction cycle 3)'

$emptyFromWhitespace = @(ConvertFrom-GuardentraOpenPrListJson -JsonText "  `n  ")
Assert-True ($emptyFromWhitespace.Count -eq 0) 'ConvertFrom-GuardentraOpenPrListJson on whitespace returns Count 0 (#88 correction cycle 3)'

# Document the underlying PS 5.1 quirk so the regression stays meaningful if
# a future engine changes ConvertFrom-Json behavior.
$rawEmpty = '[]' | ConvertFrom-Json
if ($null -eq $rawEmpty) {
    $naiveWrap = @($rawEmpty)
    Assert-True ($naiveWrap.Count -eq 1) 'PS 5.1 quirk still present: @($null) from ConvertFrom-Json [] has Count 1 (documents why the helper exists)'
}

$onePrJson = '[{"number":91,"url":"https://github.com/akurteshi-guardentra/guardentra/pull/91","baseRefName":"main","headRefName":"feat/x"}]'
$onePr = @(ConvertFrom-GuardentraOpenPrListJson -JsonText $onePrJson)
Assert-True ($onePr.Count -eq 1 -and [int]$onePr[0].number -eq 91) 'ConvertFrom-GuardentraOpenPrListJson parses a one-element JSON array (#88 correction cycle 3)'

$twoPrJson = '[{"number":91,"url":"https://example/91","baseRefName":"main","headRefName":"feat/x"},{"number":92,"url":"https://example/92","baseRefName":"main","headRefName":"feat/x"}]'
$twoPr = @(ConvertFrom-GuardentraOpenPrListJson -JsonText $twoPrJson)
Assert-True ($twoPr.Count -eq 2) 'ConvertFrom-GuardentraOpenPrListJson parses a multi-element JSON array (#88 correction cycle 3)'

# --- #66/#85 correction cycle 3: Invoke-GuardentraPushAndPr must discover
# any existing OPEN PR for the exact feature branch BEFORE pushing, update
# it instead of blindly creating a duplicate, refuse before push on
# multiple/mismatched PRs, and fail closed (never report success) if the
# PR's head does not match the authorized local HEAD after push. ---

function New-GuardentraPushAndPrTestFixture {
    param([Parameter(Mandatory)][string]$RepoDir, [Parameter(Mandatory)][string]$FeatureBranch)
    New-Item -ItemType Directory -Force -Path $RepoDir | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $RepoDir) | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test') | Out-Null
    Set-GuardentraTestSeedMainBranch -RepoDir $RepoDir | Out-Null
    Set-Content -LiteralPath (Join-Path $RepoDir 'README.md') -Value 'main-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('add', 'README.md') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('commit', '-m', 'main-seed') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('remote', 'add', 'origin', 'https://github.com/akurteshi-guardentra/guardentra.git') | Out-Null
    $baseSha = (Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('rev-parse', 'HEAD')).Trim()

    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('checkout', '-b', $FeatureBranch) | Out-Null

    $gDir = Join-Path $RepoDir 'scripts\guardentra'
    $tDir = Join-Path $gDir 'tests'
    New-Item -ItemType Directory -Force -Path $tDir | Out-Null
    Set-Content -LiteralPath (Join-Path $gDir 'Commands.ps1') -Value '# Commands v1' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $tDir 'Run-Tests.ps1') -Value 'exit 0' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('add', 'scripts/guardentra/Commands.ps1', 'scripts/guardentra/tests/Run-Tests.ps1') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('commit', '-m', 'feature commit') | Out-Null
    $headSha = (Invoke-GuardentraTestGitSetup -WorkDir $RepoDir -GitArgs @('rev-parse', 'HEAD')).Trim()

    return [pscustomobject]@{ BaseSha = $baseSha; HeadSha = $headSha }
}

Reset-GuardentraTestProviders
$pushPrRepoRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-85-pushpr-' + [guid]::NewGuid().ToString('n'))
$prevRootPushPr = $script:GuardentraRoot
$prevStateRootPushPr = $script:GuardentraStateRoot
try {
    $ppFixture = New-GuardentraPushAndPrTestFixture -RepoDir $pushPrRepoRoot -FeatureBranch 'feat/issue-950'
    $script:GuardentraRoot = $pushPrRepoRoot

    $contract950 = New-GuardentraDefaultContract -IssueNumber 950 -Title 'issue 950' -StartingMainSha $ppFixture.BaseSha `
        -FeatureBranch 'feat/issue-950' -WriterTool 'cursor'
    $contract950.worktree_path = $pushPrRepoRoot
    Save-GuardentraContract -IssueNumber 950 -Contract $contract950

    $script:GuardentraIssueRecordProvider = {
        param($IssueNumber)
        [pscustomobject]@{ Number = $IssueNumber; Title = "issue $IssueNumber"; State = 'OPEN'; Body = ''; AuthorLogin = $owner; AcceptanceCriteria = @() }
    }

    # --- A) existing PR #85-style path updates the existing PR and never
    # calls gh pr create. ---
    $existingPr85 = [pscustomobject]@{ number = 85; url = 'https://github.com/akurteshi-guardentra/guardentra/pull/85'; baseRefName = 'main'; headRefName = 'feat/issue-950' }
    $grantA = New-TestOwnerGrant -Action 'push-and-pr' -Head $ppFixture.HeadSha -Issue 950 -Branch 'feat/issue-950' -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-2'
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(
            (New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-950' -Sha $ppFixture.BaseSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-1'),
            (New-AuthorityComment -Body (New-GrantBody -Grant $grantA) -Login $owner -Id 2 -SourceRef $grantA.source_ref)
        )
    }
    Invoke-GuardentraSyncGrants -IssueNumber 950 | Out-Null

    $script:GuardentraOpenPrsForBranchProvider = { param($Branch) @($existingPr85) }
    $script:GuardentraPrCreateProvider = { param($Title, $BodyArgs) throw 'gh pr create should not have been called (existing PR #85 path)' }
    $script:GuardentraPrViewProvider = { param($Pr) $ppFixture.HeadSha }
    $script:ppPushCalled = $false
    $script:GuardentraPushHeadProvider = { $script:ppPushCalled = $true }

    $pushPrAOk = $true
    try {
        Invoke-GuardentraPushAndPr -IssueNumber 950 | Out-Null
    }
    catch {
        $pushPrAOk = $false
        $script:Failed++; $script:Failures.Add("existing-PR push-and-pr path succeeds and never calls gh pr create (threw: $($_.Exception.Message))")
        Write-Host "FAIL existing-PR push-and-pr path succeeds and never calls gh pr create (threw: $($_.Exception.Message))"
    }
    Assert-True $pushPrAOk 'push-and-pr with one existing matching PR succeeds, pushes, and never creates a duplicate PR (#85 regression cycle 3 A)'
    Assert-True $script:ppPushCalled 'push-and-pr with an existing PR still pushes the authorized HEAD (#85 regression cycle 3 A)'

    if ($pushPrAOk) {
        $contractAfterA = Read-GuardentraContract -IssueNumber 950
        Assert-True (-not [bool]$contractAfterA.auth_push_pr.enabled) 'push-and-pr grant is consumed after the successful existing-PR update (#85 regression cycle 3 F)'

        # --- F) retrying without a fresh grant is refused -- proves the
        # grant was consumed exactly once, not left reusable. ---
        Assert-Throws { Invoke-GuardentraPushAndPr -IssueNumber 950 | Out-Null } `
            'retrying push-and-pr without a fresh grant after a successful existing-PR update is refused (#85 regression cycle 3 F)' `
            -Match 'REFUSED'
    }

    # --- B) no-existing-PR path still creates one. ---
    $grantB = New-TestOwnerGrant -Action 'push-and-pr' -Head $ppFixture.HeadSha -Issue 950 -Branch 'feat/issue-950' -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-3'
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(
            (New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-950' -Sha $ppFixture.BaseSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-1'),
            (New-AuthorityComment -Body (New-GrantBody -Grant $grantB) -Login $owner -Id 3 -SourceRef $grantB.source_ref)
        )
    }
    Invoke-GuardentraSyncGrants -IssueNumber 950 | Out-Null

    # Feed the real gh empty-array JSON string `[]` through the parser used by
    # Get-GuardentraOpenPrsForBranch -- not merely `@()`. This is the #88
    # correction-cycle-3 regression for the PS 5.1 push-and-pr crash.
    $script:GuardentraOpenPrsForBranchProvider = {
        param($Branch)
        @(ConvertFrom-GuardentraOpenPrListJson -JsonText '[]')
    }
    $script:ppCreateCalled = $false
    $script:GuardentraPrCreateProvider = {
        param($Title, $BodyArgs)
        $script:ppCreateCalled = $true
        [pscustomobject]@{ Number = 86; Url = 'https://github.com/akurteshi-guardentra/guardentra/pull/86' }
    }
    $script:GuardentraPrViewProvider = { param($Pr) $ppFixture.HeadSha }
    $script:ppPushCalled = $false
    $script:GuardentraPushHeadProvider = { $script:ppPushCalled = $true }

    $pushPrBOk = $true
    try {
        Invoke-GuardentraPushAndPr -IssueNumber 950 | Out-Null
    }
    catch {
        $pushPrBOk = $false
        $script:Failed++; $script:Failures.Add("no-existing-PR push-and-pr path still creates a PR (threw: $($_.Exception.Message))")
        Write-Host "FAIL no-existing-PR push-and-pr path still creates a PR (threw: $($_.Exception.Message))"
    }
    Assert-True $pushPrBOk 'push-and-pr with no existing PR still creates one when open-PR list is real JSON [] (#88 correction cycle 3 / #85 B)'
    Assert-True $script:ppCreateCalled 'gh pr create is invoked when open-PR list JSON is [] (#88 correction cycle 3 / #85 B)'
    Assert-True $script:ppPushCalled 'push still occurs when open-PR list JSON is [] (#88 correction cycle 3)'

    # --- C) multiple matching PRs refuse before push. ---
    $grantC = New-TestOwnerGrant -Action 'push-and-pr' -Head $ppFixture.HeadSha -Issue 950 -Branch 'feat/issue-950' -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-4'
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(
            (New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-950' -Sha $ppFixture.BaseSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-1'),
            (New-AuthorityComment -Body (New-GrantBody -Grant $grantC) -Login $owner -Id 4 -SourceRef $grantC.source_ref)
        )
    }
    Invoke-GuardentraSyncGrants -IssueNumber 950 | Out-Null

    $script:GuardentraOpenPrsForBranchProvider = {
        param($Branch)
        @(
            [pscustomobject]@{ number = 87; url = 'https://github.com/akurteshi-guardentra/guardentra/pull/87'; baseRefName = 'main'; headRefName = 'feat/issue-950' },
            [pscustomobject]@{ number = 88; url = 'https://github.com/akurteshi-guardentra/guardentra/pull/88'; baseRefName = 'main'; headRefName = 'feat/issue-950' }
        )
    }
    $script:ppPushCalled = $false
    $script:GuardentraPushHeadProvider = { $script:ppPushCalled = $true }

    Assert-Throws { Invoke-GuardentraPushAndPr -IssueNumber 950 | Out-Null } `
        'push-and-pr refuses before push when multiple open PRs match the branch (#85 regression cycle 3 C)' `
        -Match 'REFUSED.*found 2 open PRs'
    Assert-True (-not $script:ppPushCalled) 'no push occurred when multiple matching PRs were found (#85 regression cycle 3 C)'

    # --- D) existing PR base/head mismatch refuses before push. ---
    $grantD = New-TestOwnerGrant -Action 'push-and-pr' -Head $ppFixture.HeadSha -Issue 950 -Branch 'feat/issue-950' -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-5'
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(
            (New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-950' -Sha $ppFixture.BaseSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-1'),
            (New-AuthorityComment -Body (New-GrantBody -Grant $grantD) -Login $owner -Id 5 -SourceRef $grantD.source_ref)
        )
    }
    Invoke-GuardentraSyncGrants -IssueNumber 950 | Out-Null

    $script:GuardentraOpenPrsForBranchProvider = {
        param($Branch)
        @([pscustomobject]@{ number = 89; url = 'https://github.com/akurteshi-guardentra/guardentra/pull/89'; baseRefName = 'develop'; headRefName = 'feat/issue-950' })
    }
    $script:ppPushCalled = $false
    $script:GuardentraPushHeadProvider = { $script:ppPushCalled = $true }

    Assert-Throws { Invoke-GuardentraPushAndPr -IssueNumber 950 | Out-Null } `
        'push-and-pr refuses before push when the existing PR base branch is not main (#85 regression cycle 3 D)' `
        -Match "REFUSED.*base branch 'develop'"
    Assert-True (-not $script:ppPushCalled) 'no push occurred when the existing PR base/head mismatched (#85 regression cycle 3 D)'

    # --- E) post-push PR head mismatch fails closed. ---
    $grantE = New-TestOwnerGrant -Action 'push-and-pr' -Head $ppFixture.HeadSha -Issue 950 -Branch 'feat/issue-950' -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-6'
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(
            (New-AuthorityComment -Body (New-DispatchBody -Branch 'feat/issue-950' -Sha $ppFixture.BaseSha) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/950#issuecomment-1'),
            (New-AuthorityComment -Body (New-GrantBody -Grant $grantE) -Login $owner -Id 6 -SourceRef $grantE.source_ref)
        )
    }
    Invoke-GuardentraSyncGrants -IssueNumber 950 | Out-Null

    $script:GuardentraOpenPrsForBranchProvider = {
        param($Branch)
        @([pscustomobject]@{ number = 85; url = 'https://github.com/akurteshi-guardentra/guardentra/pull/85'; baseRefName = 'main'; headRefName = 'feat/issue-950' })
    }
    $wrongHeadSha = ('f' * 40)
    $script:GuardentraPrViewProvider = { param($Pr) $wrongHeadSha }
    $script:ppPushCalled = $false
    $script:GuardentraPushHeadProvider = { $script:ppPushCalled = $true }

    Assert-Throws { Invoke-GuardentraPushAndPr -IssueNumber 950 | Out-Null } `
        'push-and-pr fails closed and does not report success when the post-push PR head does not match the authorized local HEAD (#85 regression cycle 3 E)' `
        -Match 'REFUSED.*head SHA.*!= authorized local HEAD'
    Assert-True $script:ppPushCalled 'the push itself still happened before the post-push head-mismatch check ran (#85 regression cycle 3 E)'
    $contractAfterE = Read-GuardentraContract -IssueNumber 950
    Assert-True ([bool]$contractAfterE.auth_push_pr.enabled) 'push-and-pr grant is NOT consumed when the post-push head check fails (#85 regression cycle 3 E)'
}
finally {
    Reset-GuardentraTestProviders
    $script:GuardentraRoot = $prevRootPushPr
    $script:GuardentraStateRoot = $prevStateRootPushPr
    if (Test-Path -LiteralPath $pushPrRepoRoot) {
        Remove-Item -LiteralPath $pushPrRepoRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- #88 Phase A: guardentra.task.v1 machine-readable task schema ---------

Reset-GuardentraTestProviders

# Dependency parsing.
Assert-True (@(ConvertFrom-GuardentraIssueDependencies -Body '').Count -eq 0) 'dependency parser returns empty array for empty body'
Assert-True (@(ConvertFrom-GuardentraIssueDependencies -Body "## Goal`nDo the thing.").Count -eq 0) 'dependency parser returns empty array when no Dependency section is present'
$depBodySingle = "## Dependency`n`n- #66 must be merged and accepted first.`n`n## Target architecture`n..."
Assert-True (((ConvertFrom-GuardentraIssueDependencies -Body $depBodySingle)) -join ',' -eq '#66') 'dependency parser extracts a single #NN reference from a Dependency section'
$depBodyMulti = "## Dependencies`n`n- #66 must be merged first.`n- Also depends on #12 and #66 again.`n`n## Next`n..."
Assert-True (((ConvertFrom-GuardentraIssueDependencies -Body $depBodyMulti)) -join ',' -eq '#12,#66') 'dependency parser extracts multiple sorted-unique #NN references from a Dependencies section'

# New-GuardentraTaskV1: determinism and field correctness.
$taskContract = New-GuardentraDefaultContract -IssueNumber 88 -Title 'Agent Control Plane' -StartingMainSha $headA `
    -FeatureBranch 'tooling/agent-control-plane-88' -WriterTool 'claude' -AccessTier 'T2'
$taskContract.worktree_path = 'C:\Users\Admin\repos\guardentra-claude-88'
$taskIssue = [pscustomobject]@{
    Number             = 88
    Title              = 'P0 tooling: GuardEntra Agent Control Plane'
    Body               = "## Dependency`n`n- #66 must be merged and accepted first.`n`n## Next`n"
    State              = 'OPEN'
    AuthorLogin        = $owner
    AcceptanceCriteria = @('First criterion', 'Second criterion')
}
$taskA = New-GuardentraTaskV1 -Contract $taskContract -Issue $taskIssue
$taskB = New-GuardentraTaskV1 -Contract $taskContract -Issue $taskIssue
$normalizeTaskJson = {
    param($t)
    $c = [ordered]@{}
    foreach ($k in $t.Keys) { if ($k -ne 'generated_utc') { $c[$k] = $t[$k] } }
    return ($c | ConvertTo-Json -Depth 8)
}
Assert-True ((& $normalizeTaskJson $taskA) -eq (& $normalizeTaskJson $taskB)) 'New-GuardentraTaskV1 is deterministic across regenerations (ignoring generated_utc) (#88 Phase A)'
Assert-True ($taskA.schema -eq 'guardentra.task.v1') 'task.v1 schema is stamped correctly (#88 Phase A)'
Assert-True ($taskA.issue -eq 88) 'task.v1 issue number matches contract (#88 Phase A)'
Assert-True ($taskA.objective -eq 'P0 tooling: GuardEntra Agent Control Plane') 'task.v1 objective is the issue title (#88 Phase A)'
Assert-True (($taskA.dependencies -join ',') -eq '#66') 'task.v1 dependencies parsed from the issue body Dependency section (#88 Phase A)'
Assert-True (($taskA.acceptance_criteria -join '|') -eq 'First criterion|Second criterion') 'task.v1 acceptance_criteria preserves the issue''s own order (#88 Phase A)'
Assert-True ($taskA.stop_conditions -contains 'autonomous_merge') 'task.v1 stop_conditions include contract.prohibited_actions (#88 Phase A)'
Assert-True ($taskA.stop_conditions -contains 'scope_expansion') 'task.v1 stop_conditions include the added correction-loop stop conditions (#88 Phase A)'
Assert-True ((($taskA.allowed_paths) -join ',') -eq ((@($taskA.allowed_paths) | Sort-Object -Unique) -join ',')) 'task.v1 allowed_paths is sorted-unique (#88 Phase A)'
Assert-True (-not $taskA.authorization_boundaries.autonomous_merge) 'task.v1 authorization_boundaries.autonomous_merge is fixed false (#88 Phase A)'
Assert-True ($taskA.authorization_boundaries.requires_owner_grant_for -contains 'merge') 'task.v1 authorization_boundaries lists merge as requiring an Owner grant (#88 Phase A)'

# Assert-GuardentraTaskV1Valid: fail closed on missing/ambiguous scope.
$validNoThrow = $true
try { Assert-GuardentraTaskV1Valid -Task $taskA | Out-Null } catch { $validNoThrow = $false }
Assert-True $validNoThrow 'a well-formed task.v1 passes strict validation (#88 Phase A)'

function Copy-GuardentraTaskForTest {
    param([Parameter(Mandatory)]$Task)
    $c = [ordered]@{}
    foreach ($k in $Task.Keys) { $c[$k] = $Task[$k] }
    return $c
}

$taskMissingObjective = Copy-GuardentraTaskForTest -Task $taskA
$taskMissingObjective.objective = ''
Assert-Throws { Assert-GuardentraTaskV1Valid -Task $taskMissingObjective } 'task.v1 with a missing objective is refused (#88 Phase A)' -Match 'REFUSED.*objective'

$taskBadWriter = Copy-GuardentraTaskForTest -Task $taskA
$taskBadWriter.writer_tool = 'not-a-real-writer'
Assert-Throws { Assert-GuardentraTaskV1Valid -Task $taskBadWriter } 'task.v1 with an unrecognized writer_tool is refused (#88 Phase A)' -Match 'REFUSED.*writer_tool'

$taskMainBranch = Copy-GuardentraTaskForTest -Task $taskA
$taskMainBranch.feature_branch = 'main'
Assert-Throws { Assert-GuardentraTaskV1Valid -Task $taskMainBranch } 'task.v1 whose feature_branch is main is refused (#88 Phase A)' -Match 'REFUSED.*feature_branch'

$taskBadSha = Copy-GuardentraTaskForTest -Task $taskA
$taskBadSha.starting_sha = 'not-a-sha'
Assert-Throws { Assert-GuardentraTaskV1Valid -Task $taskBadSha } 'task.v1 with a malformed starting_sha is refused (#88 Phase A)' -Match 'REFUSED.*starting_sha'

$taskEmptyAllowed = Copy-GuardentraTaskForTest -Task $taskA
$taskEmptyAllowed.allowed_paths = @()
Assert-Throws { Assert-GuardentraTaskV1Valid -Task $taskEmptyAllowed } 'task.v1 with empty allowed_paths is refused (#88 Phase A)' -Match 'REFUSED.*allowed_paths is empty'

$taskWildcardAllowed = Copy-GuardentraTaskForTest -Task $taskA
$taskWildcardAllowed.allowed_paths = @('*')
Assert-Throws { Assert-GuardentraTaskV1Valid -Task $taskWildcardAllowed } 'task.v1 with an unbounded wildcard allowed_paths entry is refused (#88 Phase A)' -Match 'REFUSED.*unbounded/ambiguous'

$taskEmptyTests = Copy-GuardentraTaskForTest -Task $taskA
$taskEmptyTests.required_tests = @()
Assert-Throws { Assert-GuardentraTaskV1Valid -Task $taskEmptyTests } 'task.v1 with empty required_tests is refused (#88 Phase A)' -Match 'REFUSED.*required_tests is empty'

foreach ($tier in @('T3', 'T4', 'T9')) {
    $forgedTask = Copy-GuardentraTaskForTest -Task $taskA
    $forgedTask.access_tier = $tier
    Assert-Throws { Assert-GuardentraTaskV1Valid -Task $forgedTask } "task refuses $tier access escalation (#88 correction 2)"
}
foreach ($flag in @('autonomous_merge', 'autonomous_push', 'autonomous_deploy')) {
    $forgedTask = Copy-GuardentraTaskForTest -Task $taskA
    $forgedTask.authorization_boundaries = [ordered]@{
        requires_owner_grant_for=@('commit', 'deploy-production', 'deploy-staging', 'merge', 'push-and-pr')
        autonomous_merge=$false; autonomous_push=$false; autonomous_deploy=$false
    }
    $forgedTask.authorization_boundaries[$flag] = $true
    Assert-Throws { Assert-GuardentraTaskV1Valid -Task $forgedTask } "task refuses $flag authority (#88 correction 2)"
}
foreach ($path in @('../src/*', 'scripts/../src/*', 'C:/outside/*', 'scripts\\guardentra/*', 'scripts//*', '')) {
    $forgedTask = Copy-GuardentraTaskForTest -Task $taskA
    $forgedTask.allowed_paths = @($path)
    Assert-Throws { Assert-GuardentraTaskV1Valid -Task $forgedTask } "task refuses noncanonical path '$path' (#88 correction 2)"
}
$forgedTask = Copy-GuardentraTaskForTest -Task $taskA
$forgedTask['auth_commit'] = @{enabled=$true}
Assert-Throws { Assert-GuardentraTaskV1Valid -Task $forgedTask } 'task refuses extra grant fields (#88 correction 2)'

# Assert-GuardentraTaskV1MatchesDispatch: must exactly match the live dispatch.
$matchingDispatch = [pscustomobject]@{
    issue_number      = 88
    max_access_tier   = 'T2'
    feature_branch    = 'tooling/agent-control-plane-88'
    writer            = 'claude'
    starting_main_sha = $headA
    allowed_paths     = @($taskA.allowed_paths)
    required_tests    = @($taskA.required_tests)
}
$matchNoThrow = $true
try { Assert-GuardentraTaskV1MatchesDispatch -Task $taskA -Dispatch $matchingDispatch } catch { $matchNoThrow = $false }
Assert-True $matchNoThrow 'task.v1 matching the live dispatch passes the match check (#88 Phase A)'
$lowerTierDispatch = [pscustomobject]$matchingDispatch.PSObject.Copy()
$lowerTierDispatch.max_access_tier = 'T0'
Assert-Throws { Assert-GuardentraTaskV1MatchesDispatch -Task $taskA -Dispatch $lowerTierDispatch } 'task refuses tier beyond live dispatch (#88 correction 2)'
$weakenedTask = Copy-GuardentraTaskForTest -Task $taskA
$weakenedTask.prohibited_paths = @('irrelevant/*')
Assert-Throws { Assert-GuardentraTaskV1MatchesDispatch -Task $weakenedTask -Dispatch $matchingDispatch } 'task refuses weakened deny policy (#88 correction 2)'

$dispatchBranchMismatch = [pscustomobject]$matchingDispatch.PSObject.Copy()
$dispatchBranchMismatch.feature_branch = 'some-other-branch'
Assert-Throws { Assert-GuardentraTaskV1MatchesDispatch -Task $taskA -Dispatch $dispatchBranchMismatch } 'task.v1 branch mismatch vs live dispatch is refused (#88 Phase A)' -Match 'REFUSED.*feature_branch'

$dispatchWriterMismatch = [pscustomobject]$matchingDispatch.PSObject.Copy()
$dispatchWriterMismatch.writer = 'codex'
Assert-Throws { Assert-GuardentraTaskV1MatchesDispatch -Task $taskA -Dispatch $dispatchWriterMismatch } 'task.v1 writer_tool mismatch vs live dispatch is refused (#88 Phase A)' -Match 'REFUSED.*writer_tool'

$dispatchShaMismatch = [pscustomobject]$matchingDispatch.PSObject.Copy()
$dispatchShaMismatch.starting_main_sha = $headB
Assert-Throws { Assert-GuardentraTaskV1MatchesDispatch -Task $taskA -Dispatch $dispatchShaMismatch } 'task.v1 starting_sha mismatch vs live dispatch is refused (#88 Phase A)' -Match 'REFUSED.*starting_sha'

$dispatchAllowedMismatch = [pscustomobject]$matchingDispatch.PSObject.Copy()
$dispatchAllowedMismatch.allowed_paths = @('src/*')
Assert-Throws { Assert-GuardentraTaskV1MatchesDispatch -Task $taskA -Dispatch $dispatchAllowedMismatch } 'task.v1 allowed_paths mismatch vs live dispatch is refused (#88 Phase A)' -Match 'REFUSED.*allowed_paths diverge'

$dispatchTestsMismatch = [pscustomobject]$matchingDispatch.PSObject.Copy()
$dispatchTestsMismatch.required_tests = @('powershell -File some/other/test.ps1')
Assert-Throws { Assert-GuardentraTaskV1MatchesDispatch -Task $taskA -Dispatch $dispatchTestsMismatch } 'task.v1 required_tests mismatch vs live dispatch is refused (#88 Phase A)' -Match 'REFUSED.*required_tests diverge'

# --- Invoke-GuardentraTask: real git + DI end-to-end. ---
Reset-GuardentraTestProviders
$taskFixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-88-task-' + [guid]::NewGuid().ToString('n'))
$taskRepoRoot = Join-Path $taskFixtureRoot 'primary'
$prevRootTask = $script:GuardentraRoot
$prevStateRootTask = $script:GuardentraStateRoot
try {
    New-Item -ItemType Directory -Force -Path $taskRepoRoot | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $taskRepoRoot) | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test') | Out-Null
    Set-GuardentraTestSeedMainBranch -RepoDir $taskRepoRoot | Out-Null
    Set-Content -LiteralPath (Join-Path $taskRepoRoot 'README.md') -Value 'main-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('add', 'README.md') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('commit', '-m', 'main-seed') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('remote', 'add', 'origin', 'https://github.com/akurteshi-guardentra/guardentra.git') | Out-Null
    $taskBaseSha = (Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('rev-parse', 'HEAD')).Trim()
    $taskWorktreeRoot = Join-Path $taskFixtureRoot 'guardentra-claude-970'
    Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('worktree', 'add', $taskWorktreeRoot, '-b', 'tooling/agent-control-plane-970', $taskBaseSha) | Out-Null
    $taskRepoRoot = $taskWorktreeRoot

    $script:GuardentraRoot = $taskRepoRoot
    $contract970 = New-GuardentraDefaultContract -IssueNumber 970 -Title 'Agent Control Plane test issue' -StartingMainSha $taskBaseSha `
        -FeatureBranch 'tooling/agent-control-plane-970' -WriterTool 'claude' -AccessTier 'T2'
    $contract970.worktree_path = $taskRepoRoot
    Save-GuardentraContract -IssueNumber 970 -Contract $contract970

    $script:GuardentraIssueRecordProvider = {
        param($IssueNumber)
        [pscustomobject]@{
            Number = $IssueNumber; Title = 'Agent Control Plane test issue'; State = 'OPEN'
            Body = "## Dependency`n`n- #66 must be merged and accepted first.`n`n## Next`n"
            AuthorLogin = $owner
            AcceptanceCriteria = @()
        }
    }
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(New-AuthorityComment -Body (New-DispatchBody -Branch 'tooling/agent-control-plane-970' -Sha $taskBaseSha -Writer 'Claude') -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/970#issuecomment-1')
    }

    $taskResult = $null
    $taskCmdOk = $true
    try {
        $taskResult = Invoke-GuardentraTask -IssueNumber 970
    }
    catch {
        $taskCmdOk = $false
        $script:Failed++; $script:Failures.Add("Invoke-GuardentraTask succeeds end-to-end (threw: $($_.Exception.Message))")
        Write-Host "FAIL Invoke-GuardentraTask succeeds end-to-end (threw: $($_.Exception.Message))"
    }
    Assert-True $taskCmdOk 'Invoke-GuardentraTask generates, validates, and writes task.v1.json end-to-end (#88 Phase A)'

    if ($taskCmdOk) {
        $taskPath = Get-GuardentraTaskV1Path -IssueNumber 970
        Assert-True (Test-Path -LiteralPath $taskPath) 'task.v1.json is written to the deterministic per-issue state path (#88 Phase A)'
        $onDisk = (Get-Content -LiteralPath $taskPath -Raw | ConvertFrom-Json)
        Assert-True ($onDisk.schema -eq 'guardentra.task.v1') 'on-disk task.v1.json has the correct schema (#88 Phase A)'
        Assert-True ($onDisk.feature_branch -eq 'tooling/agent-control-plane-970') 'on-disk task.v1.json feature_branch matches the contract/dispatch (#88 Phase A)'
        Assert-True ($onDisk.writer_tool -eq 'claude') 'on-disk task.v1.json writer_tool matches the contract/dispatch (#88 Phase A)'
        Assert-True (($onDisk.dependencies) -contains '#66') 'on-disk task.v1.json dependencies parsed from the live issue body (#88 Phase A)'

        # Regenerating is read-only: no git mutation, HEAD/branch unchanged.
        $branchBefore = (Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
        $headBefore = (Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('rev-parse', 'HEAD')).Trim()
        Invoke-GuardentraTask -IssueNumber 970 | Out-Null
        $branchAfter = (Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('symbolic-ref', '--short', 'HEAD')).Trim()
        $headAfter = (Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('rev-parse', 'HEAD')).Trim()
        Assert-True ($branchBefore -eq $branchAfter -and $headBefore -eq $headAfter) 'Invoke-GuardentraTask performs no git mutation (branch/HEAD unchanged) (#88 Phase A)'
        $statusAfterTask = Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('status', '--porcelain')
        Assert-True ([string]::IsNullOrWhiteSpace($statusAfterTask)) 'Invoke-GuardentraTask leaves the tracked worktree clean (task.v1.json is gitignored state, not a tracked change) (#88 Phase A)'
    }

    # Divergent local dispatch cache (grant/branch scope mismatch): must
    # refuse before writing task.v1.json for a different, unprovisioned issue.
    Invoke-GuardentraTestGitSetup -WorkDir $taskRepoRoot -GitArgs @('checkout', '-b', 'tooling/agent-control-plane-971') | Out-Null
    $contract971 = New-GuardentraDefaultContract -IssueNumber 971 -Title 'Mismatched issue' -StartingMainSha $taskBaseSha `
        -FeatureBranch 'tooling/agent-control-plane-971' -WriterTool 'claude' -AccessTier 'T2'
    $contract971.worktree_path = $taskRepoRoot
    Save-GuardentraContract -IssueNumber 971 -Contract $contract971
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(New-AuthorityComment -Body (New-DispatchBody -Branch 'tooling/agent-control-plane-971-DIFFERENT' -Sha $taskBaseSha -Writer 'Claude') -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/971#issuecomment-1')
    }
    Assert-Throws { Invoke-GuardentraTask -IssueNumber 971 | Out-Null } `
        'Invoke-GuardentraTask refuses when the generated task would diverge from the live authoritative dispatch branch (#88 Phase A)' `
        -Match 'REFUSED'
    Assert-True (-not (Test-Path -LiteralPath (Get-GuardentraTaskV1Path -IssueNumber 971))) 'no task.v1.json is written for issue #971 after the refused dispatch-mismatch attempt (#88 Phase A)'
}
finally {
    Reset-GuardentraTestProviders
    $script:GuardentraRoot = $prevRootTask
    $script:GuardentraStateRoot = $prevStateRootTask
    if (Test-Path -LiteralPath $taskFixtureRoot) {
        Remove-Item -LiteralPath $taskFixtureRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# --- #88 Phases B/C/D/F: guardentra.agent_result.v1, adapter capability
# detection, and the local runner/state-machine skeleton -------------------

Reset-GuardentraTestProviders

function New-TestAgentResult {
    param(
        [string]$Status = 'review_ready',
        [int]$Issue = 970,
        [string]$Writer = 'claude',
        [string]$Branch = 'tooling/agent-control-plane-970',
        [string]$StartingSha = $headA,
        [string]$HeadSha = $headB,
        [string[]]$ChangedFiles = @('scripts/guardentra/Commands.ps1'),
        [string[]]$Tests = @('PASS: powershell -File scripts/guardentra/tests/Run-Tests.ps1'),
        [bool]$WorktreeClean = $false,
        [string]$Deployment = 'none',
        [string[]]$Blockers = @()
    )
    return [ordered]@{
        schema         = 'guardentra.agent_result.v1'
        issue          = $Issue
        writer         = $Writer
        status         = $Status
        branch         = $Branch
        starting_sha   = $StartingSha
        head_sha       = $HeadSha
        changed_files  = @($ChangedFiles)
        tests          = @($Tests)
        worktree_clean = $WorktreeClean
        deployment     = $Deployment
        blockers       = @($Blockers)
    }
}

# Adapter capability detection: honest, never fakes a tool's support.
Assert-True (-not (Test-GuardentraAdapterCanRun -Tool 'cursor')) 'adapter capability detection reports false for a tool with no verified local CLI mapping (#88 Phase C)'
$script:GuardentraAdapterCanRunProvider = { param($Tool) $true }
Assert-True (-not (Test-GuardentraAdapterCanRun -Tool 'claude')) 'an untrusted capability provider cannot enable unimplemented execution (#88 correction 2)'
$script:GuardentraAdapterCanRunProvider = { param($Tool) $false }
Assert-True (-not (Test-GuardentraAdapterCanRun -Tool 'claude')) 'adapter capability detection provider override returns false (#88 Phase C)'
$script:GuardentraAdapterCanRunProvider = $null

function claude { throw 'unproven CLI must never execute' }
function codex { throw 'unproven CLI must never execute' }
foreach ($tool in @('claude', 'claude-code', 'codex', 'cursor', 'grok', 'google')) {
    Assert-True (-not (Test-GuardentraAdapterCanRun -Tool $tool)) "installed/unproven $tool cannot claim autonomous capability (#88 correction 2)"
    Assert-True ((Invoke-GuardentraAdapterResumeTask -Tool $tool).Status -eq 'manual_handoff_required') "resume remains manual for $tool (#88 correction 2)"
}
Remove-Item Function:claude,Function:codex

$startCanRun = Invoke-GuardentraAdapterStartTask -Tool 'claude'
Assert-True ($startCanRun.Status -eq 'manual_handoff_required') 'StartTask never autonomously drives a tool even when capability-detected -- always manual_handoff_required in this slice (#88 Phase C)'
$startNoTool = Invoke-GuardentraAdapterStartTask -Tool 'grok'
Assert-True ($startNoTool.Status -eq 'manual_handoff_required') 'StartTask reports manual_handoff_required for a tool with no verified adapter (#88 Phase C)'

# Assert-GuardentraAgentResultV1Valid: fail closed, and untrusted/foreign
# fields (e.g. a smuggled nonce/grant-shaped key) can never mint authority
# because they are rejected at the schema gate itself.
$goodResult = New-TestAgentResult
$goodResultNoThrow = $true
try { Assert-GuardentraAgentResultV1Valid -Result $goodResult | Out-Null } catch { $goodResultNoThrow = $false }
Assert-True $goodResultNoThrow 'a well-formed agent_result.v1 passes strict validation (#88 Phase D)'

function Copy-GuardentraOrderedForTest {
    param([Parameter(Mandatory)]$Source)
    $c = [ordered]@{}
    foreach ($k in $Source.Keys) { $c[$k] = $Source[$k] }
    return $c
}

$maliciousResult = Copy-GuardentraOrderedForTest -Source $goodResult
$maliciousResult['nonce'] = 'attacker-supplied-nonce'
$maliciousResult['auth_commit'] = @{ enabled = $true }
Assert-Throws { Assert-GuardentraAgentResultV1Valid -Result $maliciousResult } 'an agent_result.v1 with smuggled grant/nonce-shaped fields is refused before it can be treated as trustworthy (#88 Phase D / replay-authority-boundary)' -Match 'REFUSED.*unexpected/untrusted field'

$badSchemaResult = Copy-GuardentraOrderedForTest -Source $goodResult
$badSchemaResult.schema = 'guardentra.owner_grant.v1'
Assert-Throws { Assert-GuardentraAgentResultV1Valid -Result $badSchemaResult } 'agent_result.v1 with the wrong schema is refused (#88 Phase D)' -Match 'REFUSED.*schema'

$badStatusResult = Copy-GuardentraOrderedForTest -Source $goodResult
$badStatusResult.status = 'merged'
Assert-Throws { Assert-GuardentraAgentResultV1Valid -Result $badStatusResult } 'agent_result.v1 with an unrecognized status is refused (#88 Phase D)' -Match 'REFUSED.*status'

$mainBranchResult = Copy-GuardentraOrderedForTest -Source $goodResult
$mainBranchResult.branch = 'main'
Assert-Throws { Assert-GuardentraAgentResultV1Valid -Result $mainBranchResult } 'agent_result.v1 on branch main is refused (#88 Phase D)' -Match "REFUSED.*branch"

$badShaResult = Copy-GuardentraOrderedForTest -Source $goodResult
$badShaResult.head_sha = 'not-a-sha'
Assert-Throws { Assert-GuardentraAgentResultV1Valid -Result $badShaResult } 'agent_result.v1 with a malformed head_sha is refused (#88 Phase D)' -Match 'REFUSED.*head_sha'

$deployResult = Copy-GuardentraOrderedForTest -Source $goodResult
$deployResult.deployment = 'production'
Assert-Throws { Assert-GuardentraAgentResultV1Valid -Result $deployResult } 'agent_result.v1 claiming a deployment is refused -- no implicit deploy in this slice (#88 Phase D)' -Match 'REFUSED.*deployment'

$notArrayResult = Copy-GuardentraOrderedForTest -Source $goodResult
$notArrayResult.changed_files = $null
Assert-Throws { Assert-GuardentraAgentResultV1Valid -Result $notArrayResult } 'agent_result.v1 with a null changed_files is refused (#88 Phase D)' -Match 'REFUSED.*changed_files'

foreach ($field in $script:GuardentraAgentResultAllowedKeys) {
    $missing = Copy-GuardentraOrderedForTest -Source $goodResult
    $missing.Remove($field)
    Assert-Throws { Assert-GuardentraAgentResultV1Valid -Result $missing } "result refuses missing $field (#88 correction 2)"
}
foreach ($case in @(
    @{field='changed_files'; value=@(42)}, @{field='tests'; value='PASS'},
    @{field='tests'; value=@(@{auth_commit=$true})}, @{field='worktree_clean'; value='true'},
    @{field='writer'; value='made-up'}, @{field='issue'; value='88'},
    @{field='changed_files'; value=@('../src/escape.ts')}
)) {
    $malformed = Copy-GuardentraOrderedForTest -Source $goodResult
    $malformed[$case.field] = $case.value
    Assert-Throws { Assert-GuardentraAgentResultV1Valid -Result $malformed } "result refuses malformed $($case.field) (#88 correction 2)"
}
foreach ($limit in @(99, 4, 0, -1, '3')) {
    $retryProbe = [ordered]@{attempt_count=0; retry_limit=$limit}
    Assert-Throws { Test-GuardentraRetryGate -Contract $retryProbe } "retry policy refuses limit '$limit' (#88 correction 2)"
}
foreach ($count in @(-1, '0', 1.5)) {
    $retryProbe = [ordered]@{attempt_count=$count; retry_limit=3}
    Assert-Throws { Test-GuardentraRetryGate -Contract $retryProbe } "retry policy refuses count '$count' (#88 correction 2)"
}

# Assert-GuardentraAgentResultV1WithinScope: scope widening guard.
$scopeContract = New-GuardentraDefaultContract -IssueNumber 970 -Title 'scope test' -StartingMainSha $headA -FeatureBranch 'tooling/agent-control-plane-970' -WriterTool 'claude'
$withinScopeOk = $true
try { Assert-GuardentraAgentResultV1WithinScope -Result $goodResult -Contract $scopeContract } catch { $withinScopeOk = $false }
Assert-True $withinScopeOk 'agent_result.v1 changed_files within the contract allowlist passes the scope check (#88 Phase D)'
$widenedResult = Copy-GuardentraOrderedForTest -Source $goodResult
$widenedResult.changed_files = @('src/evil.ts')
Assert-Throws { Assert-GuardentraAgentResultV1WithinScope -Result $widenedResult -Contract $scopeContract } 'agent_result.v1 claiming a changed file outside the allowlist is refused (scope widening) (#88 Phase D / required test)' -Match 'REFUSED.*outside allowlist'

# --- Invoke-GuardentraAgentRun: real git, restart-safe state machine. ---
Reset-GuardentraTestProviders
$agentFixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-88-agent-' + [guid]::NewGuid().ToString('n'))
$agentRepoRoot = Join-Path $agentFixtureRoot 'primary'
$prevRootAgent = $script:GuardentraRoot
$prevStateRootAgent = $script:GuardentraStateRoot
try {
    New-Item -ItemType Directory -Force -Path $agentRepoRoot | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $agentRepoRoot) | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $agentRepoRoot -GitArgs @('config', 'user.email', 'native-git-test@guardentra.local') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $agentRepoRoot -GitArgs @('config', 'user.name', 'GuardEntra Native Git Test') | Out-Null
    Set-GuardentraTestSeedMainBranch -RepoDir $agentRepoRoot | Out-Null
    Set-Content -LiteralPath (Join-Path $agentRepoRoot 'README.md') -Value 'main-v1' -Encoding utf8
    Invoke-GuardentraTestGitSetup -WorkDir $agentRepoRoot -GitArgs @('add', 'README.md') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $agentRepoRoot -GitArgs @('commit', '-m', 'main-seed') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $agentRepoRoot -GitArgs @('remote', 'add', 'origin', 'https://github.com/akurteshi-guardentra/guardentra.git') | Out-Null
    $agentBaseSha = (Invoke-GuardentraTestGitSetup -WorkDir $agentRepoRoot -GitArgs @('rev-parse', 'HEAD')).Trim()
    $agentPrimaryRoot = $agentRepoRoot
    $agentWorktreeRoot = Join-Path $agentFixtureRoot 'guardentra-claude-972'
    Invoke-GuardentraTestGitSetup -WorkDir $agentRepoRoot -GitArgs @('worktree', 'add', $agentWorktreeRoot, '-b', 'tooling/agent-control-plane-972', $agentBaseSha) | Out-Null
    $agentRepoRoot = $agentWorktreeRoot

    $script:GuardentraRoot = $agentRepoRoot
    $contract972 = New-GuardentraDefaultContract -IssueNumber 972 -Title 'Agent runner test issue' -StartingMainSha $agentBaseSha `
        -FeatureBranch 'tooling/agent-control-plane-972' -WriterTool 'claude' -AccessTier 'T2'
    $contract972.worktree_path = $agentRepoRoot
    Save-GuardentraContract -IssueNumber 972 -Contract $contract972
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(New-AuthorityComment -Body (New-DispatchBody -Branch 'tooling/agent-control-plane-972' -Sha $agentBaseSha -Writer 'Claude') -Login $owner)
    }

    # 1) Fresh task (nothing committed or pending yet): always
    #    manual_handoff_required -- this slice never fakes autonomously
    #    starting work.
    $freshResult = Invoke-GuardentraAgentRun -IssueNumber 972
    Assert-True ($freshResult.status -eq 'manual_handoff_required') 'agent run on a fresh task with no work yet reports manual_handoff_required (#88 Phase B/C)'
    $stateAfterFresh = Read-GuardentraAgentState -IssueNumber 972
    Assert-True ($stateAfterFresh.state -eq 'manual_handoff_required') 'agent_state.json persists the fresh-task manual_handoff_required state (#88 Phase B)'

    # 2) Wrong worktree: refused before any evaluation, before any mutation.
    # A real (but different, unrelated) git repo with the same expected
    # origin -- so the test proves the worktree-binding check specifically,
    # not an unrelated "not a git repository" failure.
    $wrongWorktreeRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('guardentra-88-agent-wrong-' + [guid]::NewGuid().ToString('n'))
    New-Item -ItemType Directory -Force -Path $wrongWorktreeRoot | Out-Null
    Invoke-GuardentraTestGitSetup -GitArgs @('init', $wrongWorktreeRoot) | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $wrongWorktreeRoot -GitArgs @('remote', 'add', 'origin', 'https://github.com/akurteshi-guardentra/guardentra.git') | Out-Null
    $script:GuardentraRoot = $wrongWorktreeRoot
    Assert-Throws { Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null } `
        'agent run refuses when not physically inside issue #972''s own bound worktree (#88 required test: wrong worktree)' `
        -Match 'REFUSED.*isolated worktree'
    $script:GuardentraRoot = $agentRepoRoot
    Remove-Item -LiteralPath $wrongWorktreeRoot -Recurse -Force -ErrorAction SilentlyContinue

    # 3) Add a real, allowed, pending change plus a FAILING required-tests
    #    stub -- evaluate real current state (regardless of who produced
    #    it), drive the correction loop, tests_failed + attempt_count=1.
    $gDirAgent = Join-Path $agentRepoRoot 'scripts\guardentra'
    $tDirAgent = Join-Path $gDirAgent 'tests'
    New-Item -ItemType Directory -Force -Path $tDirAgent | Out-Null
    Set-Content -LiteralPath (Join-Path $gDirAgent 'Commands.ps1') -Value '# pending change' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $tDirAgent 'Run-Tests.ps1') -Value 'exit 1' -Encoding utf8

    $failResult = Invoke-GuardentraAgentRun -IssueNumber 972
    Assert-True ($failResult.status -eq 'tests_failed') 'agent run evaluates real pending work and reports tests_failed when the required tests fail (#88 Phase D)'
    $contractAfterFail = Read-GuardentraContract -IssueNumber 972
    Assert-True ([int]$contractAfterFail.attempt_count -eq 1) 'agent run failure increments the SAME shared correction-loop counter used by commit/push-and-pr (#88 Phase F)'

    # 4) Restart-safe: a fresh read from disk (simulating a new process)
    #    reflects the persisted state/counter, not a reset.
    $stateAfterFail = Read-GuardentraAgentState -IssueNumber 972
    Assert-True ($stateAfterFail.state -eq 'tests_failed') 'agent_state.json persists tests_failed across a simulated restart (#88 required test: restart-safe state)'
    $contractReReadAfterFail = Read-GuardentraContract -IssueNumber 972
    Assert-True ([int]$contractReReadAfterFail.attempt_count -eq 1) 'contract.attempt_count survives a simulated restart via a fresh Read-GuardentraContract call (#88 required test: restart-safe state)'

    # 5) Fix the stub: passing tests -> review_ready, counter resets to 0.
    Set-Content -LiteralPath (Join-Path $tDirAgent 'Run-Tests.ps1') -Value 'exit 0' -Encoding utf8
    $passResult = Invoke-GuardentraAgentRun -IssueNumber 972
    Assert-True ($passResult.status -eq 'review_ready') 'agent run reports review_ready once the required tests pass (#88 Phase D)'
    $contractAfterPass = Read-GuardentraContract -IssueNumber 972
    Assert-True ([int]$contractAfterPass.attempt_count -eq 0) 'a successful agent run resets the shared correction-loop counter (#88 Phase F)'

    # All attacks below use only disposable contract/state fixtures. No attack
    # command may execute, and no new result may replace the last valid run.
    $safeContractJson = $contractAfterPass | ConvertTo-Json -Depth 8
    $attackMarker = Join-Path $agentRepoRoot 'unauthorized-command-ran'
    foreach ($attack in @(
        @{name='T3'; mutate={param($c) $c.access_tier='T3'}},
        @{name='T4'; mutate={param($c) $c.access_tier='T4'}},
        @{name='blank worktree'; mutate={param($c) $c.worktree_path=''}},
        @{name='forged worktree'; mutate={param($c) $c.worktree_path=$agentPrimaryRoot}},
        @{name='widened scope'; mutate={param($c) $c.allowed_paths=@('scripts/*','src/*')}},
        @{name='weakened deny list'; mutate={param($c) $c.prohibited_paths=@('irrelevant/*')}},
        @{name='wrong writer'; mutate={param($c) $c.selected_writer_tool='codex'}},
        @{name='wrong issue'; mutate={param($c) $c.issue_number=999}},
        @{name='wrong base'; mutate={param($c) $c.starting_main_sha=('b'*40)}},
        @{name='retry widening'; mutate={param($c) $c.retry_limit=99}},
        @{name='shell injection'; mutate={param($c) $c.required_tests=@("New-Item -ItemType File -Path '$attackMarker'")}},
        @{name='empty tests'; mutate={param($c) $c.required_tests=@()}}
    )) {
        $attackContract = ConvertTo-GuardentraContractObject -InputObject ($safeContractJson | ConvertFrom-Json)
        & $attack.mutate $attackContract
        Save-GuardentraContract -IssueNumber 972 -Contract $attackContract
        Assert-Throws { Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null } "runner refuses $($attack.name) before executing tests (#88 correction 2)"
        Assert-True (-not (Test-Path -LiteralPath $attackMarker)) "no unauthorized command executed for $($attack.name) (#88 correction 2)"
    }
    Save-GuardentraContract -IssueNumber 972 -Contract (ConvertTo-GuardentraContractObject -InputObject ($safeContractJson | ConvertFrom-Json))
    $dispatchProvider = $script:GuardentraAuthorityCommentsProvider
    $script:GuardentraAuthorityCommentsProvider = { param($IssueNumber) @() }
    Assert-Throws { Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null } 'runner refuses missing live dispatch rather than trusting cache (#88 correction 2)'
    $script:GuardentraAuthorityCommentsProvider = {
        param($IssueNumber)
        @(New-AuthorityComment -Body (New-DispatchBody -Branch 'changed-by-owner' -Sha $agentBaseSha -Writer 'Claude') -Login $owner)
    }
    Assert-Throws { Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null } 'runner refuses changed live dispatch (#88 correction 2)'
    $script:GuardentraAuthorityCommentsProvider = $dispatchProvider

    foreach ($field in @('head_sha','branch','starting_sha','writer','issue','changed_files','tests','worktree_clean')) {
        $forgedResult = Copy-GuardentraOrderedForTest -Source $passResult
        switch ($field) {
            'head_sha' { $forgedResult[$field]='b'*40 }
            'starting_sha' { $forgedResult[$field]='b'*40 }
            'branch' { $forgedResult[$field]='another-branch' }
            'writer' { $forgedResult[$field]='codex' }
            'issue' { $forgedResult[$field]=999 }
            'changed_files' { $forgedResult[$field]=@('scripts/guardentra/not-changed.ps1') }
            'tests' { $forgedResult[$field]=@('PASS: fabricated') }
            'worktree_clean' { $forgedResult[$field]=$true }
        }
        Assert-Throws {
            Assert-GuardentraAgentResultMatchesLocalEvidence -Result $forgedResult -Contract $contractAfterPass -TestRun ([pscustomobject]@{Passed=$true; Results=$passResult.tests})
        } "forged $field cannot match real git/test evidence (#88 correction 2)"
    }

    $statePath972 = Get-GuardentraAgentStatePath -IssueNumber 972
    $safeStateJson = Get-Content -LiteralPath $statePath972 -Raw
    $forgedState = ConvertTo-GuardentraDataMap -Value ($safeStateJson | ConvertFrom-Json)
    $forgedState.last_result.head_sha = 'b'*40
    $forgedState.last_result.tests = @('PASS: fabricated')
    Set-Content -LiteralPath $statePath972 -Value ($forgedState | ConvertTo-Json -Depth 8) -Encoding utf8
    $cachedReport = Invoke-GuardentraAgentStatus -IssueNumber 972
    Assert-True ($null -eq $cachedReport.last_result -and -not $cachedReport.evidence_verified) 'status discards schema-valid forged cached evidence (#88 correction 2)'
    $cachedWatch = @(Invoke-GuardentraAgentWatch | Where-Object { $_.issue -eq 972 })
    Assert-True ($null -eq $cachedWatch[0].last_result -and -not $cachedWatch[0].evidence_verified) 'watch never republishes forged cached evidence (#88 correction 2)'
    foreach ($field in @('auth_commit','access_tier','allowed_paths','worktree_path','retry_limit')) {
        $forgedState = ConvertTo-GuardentraDataMap -Value ($safeStateJson | ConvertFrom-Json)
        $forgedState[$field] = 'forged'
        Set-Content -LiteralPath $statePath972 -Value ($forgedState | ConvertTo-Json -Depth 8) -Encoding utf8
        Assert-Throws { Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null } "restart state cannot supply $field (#88 correction 2)"
    }
    foreach ($field in @('schema','state')) {
        $forgedState = ConvertTo-GuardentraDataMap -Value ($safeStateJson | ConvertFrom-Json)
        $forgedState[$field] = @()
        Set-Content -LiteralPath $statePath972 -Value ($forgedState | ConvertTo-Json -Depth 8) -Encoding utf8
        Assert-Throws { Read-GuardentraAgentState -IssueNumber 972 | Out-Null } "cache rejects nonscalar $field (#88 correction 2)"
    }
    Set-Content -LiteralPath $statePath972 -Value $safeStateJson -Encoding utf8

    # A test may not certify a different candidate than the one it started on.
    $goodStub = Get-Content -LiteralPath (Join-Path $tDirAgent 'Run-Tests.ps1') -Raw
    Set-Content -LiteralPath (Join-Path $tDirAgent 'Run-Tests.ps1') -Value "Add-Content -LiteralPath 'scripts/guardentra/Commands.ps1' -Value '# changed during test'; exit 0" -Encoding utf8
    Assert-Throws { Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null } 'runner rejects candidate edits during tests (#88 correction 2)' -Match 'REFUSED.*candidate'
    Set-Content -LiteralPath (Join-Path $gDirAgent 'Commands.ps1') -Value '# pending change' -Encoding utf8
    Set-Content -LiteralPath (Join-Path $tDirAgent 'Run-Tests.ps1') -Value $goodStub -Encoding utf8

    # 6) Scope widening: a disallowed pending path is refused before any
    #    tests run or state is overwritten.
    $srcDirAgent = Join-Path $agentRepoRoot 'src'
    New-Item -ItemType Directory -Force -Path $srcDirAgent | Out-Null
    Set-Content -LiteralPath (Join-Path $srcDirAgent 'evil.ts') -Value 'export const evil = true;' -Encoding utf8
    Assert-Throws { Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null } `
        'agent run refuses a disallowed pending path before evaluating tests or persisting a new result (#88 required test: scope widening)' `
        -Match 'REFUSED.*outside allowlist'
    $stateAfterWiden = Read-GuardentraAgentState -IssueNumber 972
    Assert-True ($stateAfterWiden.state -eq 'review_ready') 'agent_state.json is unchanged (still the last legitimate result) after the refused scope-widening attempt (#88 Phase D)'
    Remove-Item -LiteralPath (Join-Path $srcDirAgent 'evil.ts') -Force

    # 7) No implicit merge/deploy: across every run above (fresh, failed,
    #    passed), no grant was ever enabled -- the runner has no path that
    #    touches auth_* at all.
    $finalContract972 = Read-GuardentraContract -IssueNumber 972
    Assert-True (-not [bool]$finalContract972.auth_commit.enabled) 'no agent run ever enabled auth_commit (#88 required test: no implicit merge/deploy)'
    Assert-True (-not [bool]$finalContract972.auth_push_pr.enabled) 'no agent run ever enabled auth_push_pr (#88 required test: no implicit merge/deploy)'
    Assert-True (-not [bool]$finalContract972.auth_merge.enabled) 'no agent run ever enabled auth_merge (#88 required test: no implicit merge/deploy)'
    Assert-True (-not [bool]$finalContract972.auth_deploy_staging.enabled -and -not [bool]$finalContract972.auth_deploy_production.enabled) 'no agent run ever enabled auth_deploy_staging/production (#88 required test: no implicit merge/deploy)'

    # 8) agent status / agent watch are read-only reporting surfaces.
    $statusReport = Invoke-GuardentraAgentStatus -IssueNumber 972
    Assert-True ($statusReport.state -eq 'review_ready') 'agent status reports the persisted state (#88 Phase B)'
    $watchReport = @(Invoke-GuardentraAgentWatch)
    Assert-True (@($watchReport | Where-Object { [int]$_.issue -eq 972 }).Count -eq 1) 'agent watch lists issue #972''s persisted state (#88 Phase B)'

    # Run the actual shared failure path through three invocations, not a
    # separate runner counter. A fourth invocation and success-reset refuse.
    Set-Content -LiteralPath (Join-Path $tDirAgent 'Run-Tests.ps1') -Value 'exit 1' -Encoding utf8
    Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null
    Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null
    Assert-Throws { Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null } 'third runner failure stops and escalates (#88 correction 2)' -Match 'ESCALATE'
    $thirdFailure = Read-GuardentraContract -IssueNumber 972
    Assert-True ($thirdFailure.attempt_count -eq 3) 'third failed attempt survives restart in shared contract (#88 correction 2)'
    Assert-True ((Read-GuardentraAgentState -IssueNumber 972).state -eq 'blocked') 'third failure preserves blocked restart state (#88 correction 2)'
    Assert-Throws { Invoke-GuardentraAgentRun -IssueNumber 972 | Out-Null } 'fourth runner attempt refuses before tests (#88 correction 2)' -Match 'ESCALATE'
    Assert-Throws { Register-GuardentraAttempt -Contract $thirdFailure -Success:$true -IssueNumber 972 } 'success cannot reset exhausted correction budget (#88 correction 2)' -Match 'ESCALATE'
}
finally {
    Reset-GuardentraTestProviders
    $script:GuardentraRoot = $prevRootAgent
    $script:GuardentraStateRoot = $prevStateRootAgent
    if (Test-Path -LiteralPath $agentFixtureRoot) {
        Remove-Item -LiteralPath $agentFixtureRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Reset-GuardentraTestProviders
if (Test-Path $tmpRoot) { Remove-Item $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
$script:GuardentraStateRoot = Join-Path $PSScriptRoot '..\state\issues'

Write-Host ''
. (Join-Path $PSScriptRoot 'Supervisor.Tests.ps1')
. (Join-Path $PSScriptRoot 'ProviderProcesses.Tests.ps1')
. (Join-Path $PSScriptRoot 'CloudInventory.Tests.ps1')
Write-Host "Results: $($script:Passed) passed, $($script:Failed) failed"
if ($script:Failed -gt 0) {
    Write-Host 'Failures:'
    $script:Failures | ForEach-Object { Write-Host " - $_" }
    exit 1
}
exit 0
