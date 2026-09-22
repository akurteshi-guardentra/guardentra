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
    param([string]$Branch = $branchName, [string]$Sha = $headA)
    return @"
## #9C DISPATCH PACKET
**Branch:** ``$Branch``
**Starting SHA:** ``$Sha``
**Selected writer:** Cursor
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

Reset-GuardentraTestProviders
if (Test-Path $tmpRoot) { Remove-Item $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
$script:GuardentraStateRoot = Join-Path $PSScriptRoot '..\state\issues'

Write-Host ''
Write-Host "Results: $($script:Passed) passed, $($script:Failed) failed"
if ($script:Failed -gt 0) {
    Write-Host 'Failures:'
    $script:Failures | ForEach-Object { Write-Host " - $_" }
    exit 1
}
exit 0
