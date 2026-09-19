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
