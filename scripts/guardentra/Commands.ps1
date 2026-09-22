# GuardEntra orchestration commands (#9C R4 authority closure)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Common.ps1')

function Get-GuardentraIssueRecord {
    param([Parameter(Mandatory)][int]$IssueNumber)
    if ($script:GuardentraIssueRecordProvider) {
        return (& $script:GuardentraIssueRecordProvider $IssueNumber)
    }
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) {
        throw 'REFUSED: gh CLI is required to fetch the GitHub issue task contract (fail closed).'
    }
    $jsonText = & gh issue view $IssueNumber --repo $script:GuardentraExpectedRepo --json number,title,body,state,author 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "REFUSED: unable to fetch GitHub issue #${IssueNumber}: $(Protect-GuardentraSecrets -Text ($jsonText | Out-String))"
    }
    $obj = $jsonText | ConvertFrom-Json
    if (-not $obj -or [int]$obj.number -ne $IssueNumber) {
        throw "REFUSED: GitHub issue #$IssueNumber could not be verified."
    }
    if ([string]::IsNullOrWhiteSpace([string]$obj.title)) {
        throw "REFUSED: GitHub issue #$IssueNumber has an empty title."
    }
    $lines = @()
    foreach ($line in (([string]$obj.body) -split "`n")) {
        if ($line -match '^\s*-\s*\[[ xX]\]\s*(.+)$') {
            $lines += $Matches[1].Trim()
        }
    }
    $authorLogin = ''
    if ($obj.author -and $obj.author.login) { $authorLogin = [string]$obj.author.login }
    return [pscustomobject]@{
        Number             = [int]$obj.number
        Title              = (Protect-GuardentraSecrets -Text ([string]$obj.title).Trim())
        State              = [string]$obj.state
        Body               = [string]$obj.body
        AuthorLogin        = $authorLogin
        AcceptanceCriteria = @($lines | Select-Object -First 20)
    }
}

function Get-GuardentraPrChecks {
    param([Parameter(Mandatory)][int]$Pr)
    if ($script:GuardentraPrChecksProvider) {
        return @(& $script:GuardentraPrChecksProvider $Pr)
    }
    # Strict: only --required with documented fields. No non-required fallback.
    $jsonText = & gh pr checks $Pr --repo $script:GuardentraExpectedRepo --required --json name,state,bucket 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "REFUSED: unable to read required PR checks for #${Pr} via 'gh pr checks --required --json name,state,bucket': $(Protect-GuardentraSecrets -Text ($jsonText | Out-String))"
    }
    return @($jsonText | ConvertFrom-Json)
}

function Expand-GuardentraGhApiCommentPages {
    <#
      Flatten gh api --paginate --slurp page collection into individual comment objects.
      Never read .id on a page array (PowerShell member-enumeration yields Object[] of ids).
      Returns List[object] to avoid PowerShell pipeline array unwrapping.
    #>
    param([Parameter(Mandatory)]$Parsed)
    $flat = New-Object System.Collections.Generic.List[object]
    $queue = New-Object System.Collections.Generic.Queue[object]
    $queue.Enqueue($Parsed)
    while ($queue.Count -gt 0) {
        $node = $queue.Dequeue()
        if ($null -eq $node) { continue }
        if ($node -is [string]) { continue }
        if ($node -is [System.Array]) {
            foreach ($el in $node) { $queue.Enqueue($el) }
            continue
        }
        $hasId = $false
        foreach ($prop in $node.PSObject.Properties) {
            if ([string]$prop.Name -eq 'id') { $hasId = $true; break }
        }
        if (-not $hasId) { continue }
        $rawId = $node.id
        if ($rawId -is [System.Array]) {
            throw 'REFUSED: GitHub comment page was not flattened before reading .id (Object[] cannot cast to Int64)'
        }
        [void]$flat.Add($node)
    }
    return $flat
}

function ConvertFrom-GuardentraGhApiCommentPages {
    <#
      Parse gh api --paginate --slurp JSON text, then flatten pages to comment objects.
      Returns List[object].
    #>
    param([Parameter(Mandatory)][AllowEmptyString()][string]$JsonText)
    if ([string]::IsNullOrWhiteSpace($JsonText)) {
        return (New-Object System.Collections.Generic.List[object])
    }
    $parsed = $JsonText | ConvertFrom-Json
    return (Expand-GuardentraGhApiCommentPages -Parsed $parsed)
}

function ConvertTo-GuardentraAuthorityCommentRecord {
    param(
        [Parameter(Mandatory)]$GhComment
    )
    if ($null -eq $GhComment) {
        throw 'REFUSED: null GitHub comment object'
    }
    if ($GhComment -is [System.Array]) {
        throw 'REFUSED: expected a single GitHub comment object, got Object[] (paginate pages must be flattened first)'
    }
    $rawId = $null
    $propNames = New-Object System.Collections.Generic.List[string]
    foreach ($prop in $GhComment.PSObject.Properties) { [void]$propNames.Add([string]$prop.Name) }
    if ($propNames -contains 'id') { $rawId = $GhComment.id }
    if ($rawId -is [System.Array]) {
        throw 'REFUSED: comment id is Object[] — paginated GitHub comment pages were not flattened'
    }
    $id = [long]0
    if ($null -ne $rawId -and [string]$rawId -ne '') {
        $id = [long]$rawId
    }
    $login = ''
    if ($GhComment.user -and $GhComment.user.login) { $login = [string]$GhComment.user.login }
    $html = ''
    if ($propNames -contains 'html_url' -and $GhComment.html_url) {
        $html = [string]$GhComment.html_url
    }
    $assoc = ''
    if ($propNames -contains 'author_association' -and $GhComment.author_association) {
        $assoc = [string]$GhComment.author_association
    }
    $body = ''
    if ($propNames -contains 'body') { $body = [string]$GhComment.body }
    $created = ''
    if ($propNames -contains 'created_at' -and $GhComment.created_at) {
        $created = [string]$GhComment.created_at
    }
    return (New-Object PSObject -Property @{
            Id                = $id
            HtmlUrl           = $html
            SourceRef         = $html
            AuthorLogin       = $login
            AuthorAssociation = $assoc
            Body              = $body
            CreatedAt         = $created
            IsIssueBody       = $false
        })
}

function Get-GuardentraIssueAuthorityComments {
    <#
      Returns issue body + comments with author login and real comment provenance.
      Author allowlist filtering is applied by callers for grants/dispatch.
      Identity validation only — not cryptographic provenance.
    #>
    param([Parameter(Mandatory)][int]$IssueNumber)
    if ($script:GuardentraAuthorityCommentsProvider) {
        return @(& $script:GuardentraAuthorityCommentsProvider $IssueNumber)
    }
    if ($script:GuardentraOwnerGrantProvider) {
        throw 'REFUSED: body-only OwnerGrantProvider is not accepted under R4; supply AuthorityCommentsProvider with author + source_ref'
    }
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) { throw 'REFUSED: gh CLI required to read Owner grants / dispatch from GitHub' }

    $issueJson = & gh issue view $IssueNumber --repo $script:GuardentraExpectedRepo --json number,body,author,url 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "REFUSED: unable to fetch issue #$IssueNumber for authority comments: $(Protect-GuardentraSecrets -Text ($issueJson | Out-String))"
    }
    $issue = $issueJson | ConvertFrom-Json
    $records = New-Object System.Collections.Generic.List[object]
    $issueAuthor = ''
    if ($issue.author -and $issue.author.login) { $issueAuthor = [string]$issue.author.login }
    $issueUrl = if ($issue.url) { [string]$issue.url } else { "https://github.com/$($script:GuardentraExpectedRepo)/issues/$IssueNumber" }
    [void]$records.Add((New-Object PSObject -Property @{
                Id                = [long]0
                HtmlUrl           = "$issueUrl#issue-$IssueNumber"
                SourceRef         = "issue-body:$IssueNumber"
                AuthorLogin       = $issueAuthor
                AuthorAssociation = 'ISSUE_AUTHOR'
                Body              = [string]$issue.body
                CreatedAt         = ''
                IsIssueBody       = $true
            }))

    # Deterministic pagination: --slurp yields [page[], page[], ...]; flatten before .id access.
    $jsonText = & gh api "repos/$($script:GuardentraExpectedRepo)/issues/$IssueNumber/comments" --paginate --slurp 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "REFUSED: unable to fetch issue comments for #${IssueNumber}: $(Protect-GuardentraSecrets -Text ($jsonText | Out-String))"
    }
    $jsonJoined = ($jsonText | Out-String).Trim()
    foreach ($c in (ConvertFrom-GuardentraGhApiCommentPages -JsonText $jsonJoined)) {
        [void]$records.Add((ConvertTo-GuardentraAuthorityCommentRecord -GhComment $c))
    }
    # Do not use @($records): wrapping New-Object List[object] with @() can throw
    # "Argument types do not match" on Windows PowerShell.
    return $records.ToArray()
}


function Get-GuardentraAuthorityGrantsAndEvents {
    param([Parameter(Mandatory)][int]$IssueNumber)
    $comments = Get-GuardentraIssueAuthorityComments -IssueNumber $IssueNumber
    $grants = New-Object System.Collections.Generic.List[object]
    $events = New-Object System.Collections.Generic.List[object]
    $rejectedAuthors = New-Object System.Collections.Generic.List[string]
    foreach ($c in $comments) {
        $hasGrant = [string]$c.Body -match 'GUARDENTRA_OWNER_GRANT'
        $hasEvent = [string]$c.Body -match 'GUARDENTRA_GRANT_EVENT'
        $hasDispatch = [string]$c.Body -match '(?s)##\s*#?9C\s+DISPATCH PACKET'
        if (-not ($hasGrant -or $hasEvent -or $hasDispatch)) { continue }
        if (-not (Test-GuardentraAuthorityAuthor -Login ([string]$c.AuthorLogin))) {
            if ($hasGrant -or $hasEvent -or $hasDispatch) {
                [void]$rejectedAuthors.Add([string]$c.AuthorLogin)
            }
            continue
        }
        $src = [string]$c.SourceRef
        if ([string]::IsNullOrWhiteSpace($src) -and $c.HtmlUrl) { $src = [string]$c.HtmlUrl }
        foreach ($g in (ConvertFrom-GuardentraOwnerGrantText -Text ([string]$c.Body) -SourceRef $src -AuthorLogin ([string]$c.AuthorLogin))) {
            [void]$grants.Add($g)
        }
        foreach ($e in (ConvertFrom-GuardentraGrantEventText -Text ([string]$c.Body) -SourceRef $src -AuthorLogin ([string]$c.AuthorLogin))) {
            [void]$events.Add($e)
        }
    }
    return (New-Object PSObject -Property @{
            Comments        = @($comments)
            Grants          = $grants.ToArray()
            Events          = $events.ToArray()
            RejectedAuthors = @($rejectedAuthors.ToArray() | Select-Object -Unique)
        })
}

function Get-GuardentraDispatchEnvelope {
    param([Parameter(Mandatory)][int]$IssueNumber)
    $bundle = Get-GuardentraAuthorityGrantsAndEvents -IssueNumber $IssueNumber
    $authBodies = @()
    foreach ($c in $bundle.Comments) {
        if (Test-GuardentraAuthorityAuthor -Login ([string]$c.AuthorLogin)) {
            $authBodies += [string]$c.Body
        }
    }
    $text = ($authBodies -join "`n`n")
    $envelope = [ordered]@{
        issue_number      = $IssueNumber
        writer            = 'cursor'
        max_access_tier   = 'T2'
        persona_role      = 'Engineering Manager / Architect'
        persona_spec_path = 'docs/agent-ops/personas/engineering-manager.md'
        feature_branch    = "issue/$IssueNumber-pilot"
        starting_main_sha = ''
        allowed_paths     = @('scripts/guardentra.ps1', 'scripts/guardentra/*', 'docs/agent-ops/orchestration/*')
        required_tests    = @('powershell -File scripts/guardentra/tests/Run-Tests.ps1')
        found_dispatch    = $false
        author_login      = ''
        source_ref        = ''
    }
    # Prefer the authoritative comment that contains the dispatch packet.
    foreach ($c in $bundle.Comments) {
        if (-not (Test-GuardentraAuthorityAuthor -Login ([string]$c.AuthorLogin))) { continue }
        if ([string]$c.Body -match '(?s)##\s*#?9C\s+DISPATCH PACKET') {
            $envelope.found_dispatch = $true
            $envelope.author_login = [string]$c.AuthorLogin
            $envelope.source_ref = if ($c.SourceRef) { [string]$c.SourceRef } else { [string]$c.HtmlUrl }
            $text = [string]$c.Body
            break
        }
    }
    if ($text -match '(?im)\*\*Selected writer:\*\*\s*([^\r\n]+)') {
        $w = $Matches[1].Trim().ToLowerInvariant()
        if ($w -match 'cursor') { $envelope.writer = 'cursor' }
        elseif ($w -match 'codex') { $envelope.writer = 'codex' }
        elseif ($w -match 'claude') { $envelope.writer = 'claude' }
    }
    if ($text -match '(?im)\*\*Access tier:\*\*\s*([^\r\n]+)') {
        $tierLine = $Matches[1]
        if ($tierLine -match 'T2') { $envelope.max_access_tier = 'T2' }
        elseif ($tierLine -match 'T1') { $envelope.max_access_tier = 'T1' }
        elseif ($tierLine -match 'T0') { $envelope.max_access_tier = 'T0' }
        if ($tierLine -match 'T3|T4') { $envelope.max_access_tier = 'T2' }
    }
    if ($text -match '(?im)\*\*Branch:\*\*\s*`?([^`\r\n]+)`?') { $envelope.feature_branch = $Matches[1].Trim() }
    if ($text -match '(?im)\*\*Starting SHA:\*\*\s*`?([0-9a-f]{40})`?') { $envelope.starting_main_sha = $Matches[1].Trim() }
    if ($text -match '(?is)\*\*Allowed paths:\*\*\s*(.*?)(?:\*\*Prohibited|\*\*Writer rule|\*\*Required reads|\z)') {
        $paths = New-Object System.Collections.Generic.List[string]
        foreach ($line in ($Matches[1] -split "`n")) {
            if ($line -match '^\s*-\s*`([^`]+)`') { [void]$paths.Add($Matches[1].Trim()) }
        }
        if ($paths.Count -gt 0) { $envelope.allowed_paths = @($paths.ToArray()) }
    }
    if (-not $envelope.found_dispatch) {
        $hint = ''
        if ($bundle.RejectedAuthors.Count -gt 0) {
            $hint = " (dispatch/grant bodies from non-allowlisted authors ignored: $($bundle.RejectedAuthors -join ', '))"
        }
        throw "REFUSED: no #9C DISPATCH PACKET from an accepted Owner/dispatcher identity on GitHub issue #$IssueNumber$hint"
    }
    return [pscustomobject]$envelope
}

function Compare-GuardentraStringSets {
    param([string[]]$Left, [string[]]$Right)
    $a = @($Left | ForEach-Object { $_ } | Sort-Object -Unique)
    $b = @($Right | ForEach-Object { $_ } | Sort-Object -Unique)
    return (($a -join '|') -eq ($b -join '|'))
}

function Assert-GuardentraAuthorityLive {
    <#
      Re-fetch authoritative GitHub dispatch + exact grant before mutating gates.
      Local source=github-owner-grant alone never establishes authority.
    #>
    param(
        [Parameter(Mandatory)]$Contract,
        [Parameter(Mandatory)][ValidateSet(
            'commit',
            'push-and-pr',
            'merge',
            'deploy-staging',
            'deploy-production'
        )][string]$Action,
        [string]$CurrentHeadSha = '',
        [string]$ContentDigest = '',
        [int]$PrNumber = 0,
        [string]$PrHeadSha = ''
    )

    $dispatch = Get-GuardentraDispatchEnvelope -IssueNumber ([int]$Contract.issue_number)
    if ([string]$Contract.feature_branch -ne [string]$dispatch.feature_branch) {
        throw "REFUSED: local feature_branch '$($Contract.feature_branch)' != GitHub dispatch branch '$($dispatch.feature_branch)'"
    }
    if ([string]$Contract.selected_writer_tool -ne [string]$dispatch.writer) {
        throw "REFUSED: local writer '$($Contract.selected_writer_tool)' != GitHub dispatch writer '$($dispatch.writer)'"
    }
    if (-not (Compare-GuardentraStringSets -Left @($Contract.allowed_paths) -Right @($dispatch.allowed_paths))) {
        throw 'REFUSED: local allowed_paths diverge from authoritative GitHub dispatch (scope widening refused)'
    }
    if (-not (Compare-GuardentraStringSets -Left @($Contract.required_tests) -Right @($dispatch.required_tests))) {
        throw 'REFUSED: local required_tests diverge from authoritative GitHub dispatch'
    }
    if ($dispatch.starting_main_sha -and [string]$Contract.starting_main_sha -ne [string]$dispatch.starting_main_sha) {
        throw "REFUSED: local starting_main_sha != dispatch starting SHA $($dispatch.starting_main_sha)"
    }

    $cached = Get-GuardentraAuthGrantSlot -Contract $Contract -Action $Action
    # Never trust local cache marker alone.
    if (-not $cached -or -not [bool]$cached.enabled) {
        throw "REFUSED: no local cache grant for '$Action'; sync-grants after Owner posts GUARDENTRA_OWNER_GRANT"
    }
    if ([string]$cached.source -eq 'github-owner-grant' -and [string]::IsNullOrWhiteSpace([string]$cached.nonce)) {
        throw 'REFUSED: forged/incomplete local github-owner-grant cache (missing nonce)'
    }

    $bundle = Get-GuardentraAuthorityGrantsAndEvents -IssueNumber ([int]$Contract.issue_number)
    $match = $null
    foreach ($g in $bundle.Grants) {
        if ([string]$g.nonce -ne [string]$cached.nonce) { continue }
        if ([string]$g.action -ne $Action) { continue }
        $match = $g
        break
    }
    if (-not $match) {
        throw "REFUSED: cached grant nonce '$($cached.nonce)' for '$Action' not found on authoritative GitHub issue (local source=github-owner-grant is not authority)"
    }
    Assert-GuardentraOwnerGrantStrict -Grant $match -Contract $Contract
    $terminal = Get-GuardentraNonceTerminalStatus -IssueNumber ([int]$Contract.issue_number) -Nonce ([string]$match.nonce) -GrantEvents @($bundle.Events)
    if ($terminal) {
        throw "REFUSED: nonce '$($match.nonce)' has durable terminal status '$terminal' (replay refused)"
    }
    if ([string]$match.head_sha.ToLowerInvariant() -ne [string]$cached.head_sha.ToLowerInvariant()) {
        throw 'REFUSED: cached grant head_sha != live GitHub grant'
    }
    if ([string]$match.source_ref -ne [string]$cached.source_ref) {
        throw 'REFUSED: cached grant source_ref != live GitHub comment provenance'
    }
    if ([string]$match.author_login -ne [string]$cached.author_login) {
        throw 'REFUSED: cached grant author_login != live GitHub author'
    }
    if ($Action -eq 'commit') {
        if ([string]$match.content_digest.ToLowerInvariant() -ne [string]$cached.content_digest.ToLowerInvariant()) {
            throw 'REFUSED: cached content_digest != live GitHub grant'
        }
    }
    if ($Action -eq 'merge' -and [int]$match.pr_number -ne [int]$cached.pr_number) {
        throw 'REFUSED: cached merge pr_number != live GitHub grant'
    }

    # Refresh cache from live grant, then run field checks against current HEAD/digest/PR.
    $Contract = Import-GuardentraOwnerGrant -Contract $Contract -Grant $match -GrantEvents @($bundle.Events)
    Assert-GuardentraAuthorized -Contract $Contract -Action $Action `
        -CurrentHeadSha $CurrentHeadSha -ContentDigest $ContentDigest -PrNumber $PrNumber -PrHeadSha $PrHeadSha
    return $Contract
}

function Invoke-GuardentraStart {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [Parameter(Mandatory)][string]$Writer,
        [string]$Branch = '',
        [ValidateSet('T0', 'T1', 'T2')][string]$AccessTier = 'T2'
    )

    Assert-GuardentraRepository
    $writerNorm = Resolve-GuardentraWriter -Writer $Writer
    $issue = Get-GuardentraIssueRecord -IssueNumber $IssueNumber
    $dispatch = Get-GuardentraDispatchEnvelope -IssueNumber $IssueNumber

    # Throws on refusal; the boolean success return is not part of this
    # function's contract and must not leak into Invoke-GuardentraStart's
    # own return value.
    Test-GuardentraAccessTierAllowed -AccessTier $AccessTier -MaxTier $dispatch.max_access_tier | Out-Null
    if ($writerNorm -ne $dispatch.writer) {
        throw "REFUSED: writer 'tool:$writerNorm' != dispatch writer 'tool:$($dispatch.writer)'. Re-dispatch explicitly."
    }

    $featureBranch = if ($Branch) { $Branch } else { [string]$dispatch.feature_branch }
    if ($featureBranch -ne [string]$dispatch.feature_branch) {
        throw "REFUSED: branch '$featureBranch' != dispatch branch '$($dispatch.feature_branch)'"
    }

    $currentBranch = Get-GuardentraCurrentBranch
    $contractPath = Get-GuardentraContractPath -IssueNumber $IssueNumber

    if ($currentBranch -eq $featureBranch) {
        # #66: a shared primary checkout must never be parked on a feature
        # branch at all -- that state is itself evidence of exactly the
        # unsafe pattern that caused the #62/#63 collision.
        if (Test-GuardentraInPrimaryCheckout) {
            throw "REFUSED: the shared primary checkout is on feature branch '$featureBranch'. Writers must operate from an isolated worktree, never the primary checkout (#66). Remove/recreate the isolated worktree for tool:$writerNorm and re-run start from there."
        }
        if (-not (Test-Path -LiteralPath $contractPath)) {
            throw "REFUSED: feature branch '$featureBranch' exists but no local contract/baseline cache. Will not invent starting_main_sha. Restore durable baseline or recreate branch from main under Owner direction."
        }
        $existing = Read-GuardentraContract -IssueNumber $IssueNumber
        Test-GuardentraRetryGate -Contract $existing
        if ($existing.selected_writer_tool -ne $writerNorm) {
            throw "REFUSED: contract writer is 'tool:$($existing.selected_writer_tool)' but start requested '$writerNorm'."
        }
        if ($dispatch.starting_main_sha -and $existing.starting_main_sha -ne $dispatch.starting_main_sha) {
            throw "REFUSED: contract starting_main_sha $($existing.starting_main_sha) != dispatch starting SHA $($dispatch.starting_main_sha)"
        }
        $existing.feature_branch = $featureBranch
        $existing.title = $issue.Title
        $existing.persona_role = $dispatch.persona_role
        $existing.persona_spec_path = $dispatch.persona_spec_path
        $existing.access_tier = $AccessTier
        $existing.allowed_paths = @($dispatch.allowed_paths)
        $existing.required_tests = @($dispatch.required_tests)
        if (-not $existing.worktree_path) {
            # Contract predates #66, or was created by a manual pre-isolated
            # worktree flow. Backfill from where we actually are now.
            $existing.worktree_path = Get-GuardentraRepoTopLevel
        }
        if ($issue.AcceptanceCriteria.Count -gt 0) {
            $existing.acceptance_criteria = @($issue.AcceptanceCriteria)
        }
        Save-GuardentraContract -IssueNumber $IssueNumber -Contract $existing
        $packet = Protect-GuardentraSecrets -Text (New-GuardentraTaskPacketMarkdown -Contract $existing)
        Set-Content -Path (Get-GuardentraPacketPath -IssueNumber $IssueNumber) -Value $packet -Encoding utf8
        Write-GuardentraHost "Start (continue) on existing branch $featureBranch for #$IssueNumber"
        Write-GuardentraHost "Worktree: $($existing.worktree_path)"
        Write-GuardentraHost "Writer: tool:$writerNorm (dispatch-bound)"
        Write-GuardentraHost "Starting SHA: $($existing.starting_main_sha)"
        Write-GuardentraHost 'Local authorize cannot mint Owner grants. Use sync-grants.'
        return $existing
    }

    $inPrimaryCheckout = Test-GuardentraInPrimaryCheckout

    if (-not $inPrimaryCheckout) {
        # #66 P0 correction: a linked worktree must NEVER be assumed to
        # belong to the issue/writer this `start` call is for -- a user/tool
        # can physically be sitting inside issue A's worktree while invoking
        # start for issue B. Verify ownership before ANY mutation at all
        # (including the worktree-clean check below), so the refusal fires
        # regardless of whether the wrong worktree happens to be clean or
        # dirty at the moment of the mistake.
        $currentWorktreeRoot = Get-GuardentraRepoTopLevel
        $expectedWorktreePath = Get-GuardentraWorktreePath -Writer $writerNorm -IssueNumber $IssueNumber
        $owned = Test-GuardentraWorktreeOwnedByIssue `
            -CurrentWorktreeRoot $currentWorktreeRoot `
            -ExpectedWorktreePath $expectedWorktreePath `
            -IssueNumber $IssueNumber `
            -WriterTool $writerNorm `
            -FeatureBranch $featureBranch
        if (-not $owned) {
            throw "REFUSED: current worktree '$currentWorktreeRoot' is not the isolated worktree for issue #$IssueNumber / tool:$writerNorm (expected '$expectedWorktreePath'). An agent must never switch branches in another tool's worktree (#66). Run start from inside that issue's own worktree, or from the primary checkout to provision one."
        }
    }

    Assert-GuardentraWorktreeClean

    if ($inPrimaryCheckout) {
        # #66: never switch the shared primary checkout's own branch --
        # provision a dedicated isolated worktree for this writer/issue
        # instead, from the exact authorized starting SHA, and leave the
        # primary checkout exactly where it was (on main).
        $startingSha = Sync-GuardentraMainAndValidate `
            -FeatureBranch $featureBranch `
            -CurrentBranch $currentBranch `
            -ExpectedStartingSha $dispatch.starting_main_sha

        $worktreePath = Get-GuardentraWorktreePath -Writer $writerNorm -IssueNumber $IssueNumber
        New-GuardentraIsolatedWorktree -WorktreePath $worktreePath -FeatureBranch $featureBranch -StartingSha $startingSha

        $contract = New-GuardentraDefaultContract `
            -IssueNumber $IssueNumber `
            -Title $issue.Title `
            -StartingMainSha $startingSha `
            -FeatureBranch $featureBranch `
            -WriterTool $writerNorm `
            -PersonaRole $dispatch.persona_role `
            -PersonaSpecPath $dispatch.persona_spec_path `
            -AccessTier $AccessTier `
            -AllowedPaths $dispatch.allowed_paths `
            -AcceptanceCriteria $issue.AcceptanceCriteria `
            -RequiredTests $dispatch.required_tests
        $contract.worktree_path = $worktreePath

        # A freshly created linked worktree has its own independent copy of
        # the whole tracked tree, including scripts/guardentra/state -- write
        # the contract/packet there directly, not into the primary
        # checkout's own (different) state directory.
        Save-GuardentraContractAt -WorktreeRoot $worktreePath -IssueNumber $IssueNumber -Contract $contract
        $packet = Protect-GuardentraSecrets -Text (New-GuardentraTaskPacketMarkdown -Contract $contract)
        Set-GuardentraPacketAt -WorktreeRoot $worktreePath -IssueNumber $IssueNumber -Text $packet

        Write-GuardentraHost "Isolated worktree created: $worktreePath"
        Write-GuardentraHost 'Primary checkout left untouched on main -- writers never operate directly in the shared checkout (#66).'
        Write-GuardentraHost "Run all further dispatcher commands for issue #$IssueNumber from inside that worktree."
        Write-GuardentraHost "Writer: tool:$writerNorm (dispatch-bound)"
        Write-GuardentraHost "Starting SHA: $startingSha"
        Write-GuardentraHost 'Authorization: github-owner-grant only via sync-grants.'
        return $contract
    }

    # Already inside a linked (non-primary) worktree, and ownership for this
    # exact issue/writer was verified above -- safe to operate here.
    $startingSha = Sync-GuardentraMainAndValidate `
        -FeatureBranch $featureBranch `
        -CurrentBranch $currentBranch `
        -ExpectedStartingSha $dispatch.starting_main_sha

    $nb = Invoke-GuardentraGit -GitArgs @('checkout', '-b', $featureBranch)
    if ($nb.ExitCode -ne 0) { throw "create branch $featureBranch failed: $($nb.Output)" }

    $contract = New-GuardentraDefaultContract `
        -IssueNumber $IssueNumber `
        -Title $issue.Title `
        -StartingMainSha $startingSha `
        -FeatureBranch $featureBranch `
        -WriterTool $writerNorm `
        -PersonaRole $dispatch.persona_role `
        -PersonaSpecPath $dispatch.persona_spec_path `
        -AccessTier $AccessTier `
        -AllowedPaths $dispatch.allowed_paths `
        -AcceptanceCriteria $issue.AcceptanceCriteria `
        -RequiredTests $dispatch.required_tests
    $contract.worktree_path = Get-GuardentraRepoTopLevel

    Save-GuardentraContract -IssueNumber $IssueNumber -Contract $contract
    $packet = Protect-GuardentraSecrets -Text (New-GuardentraTaskPacketMarkdown -Contract $contract)
    Set-Content -Path (Get-GuardentraPacketPath -IssueNumber $IssueNumber) -Value $packet -Encoding utf8
    Write-GuardentraHost "Start complete for issue #$IssueNumber"
    Write-GuardentraHost "Worktree: $($contract.worktree_path)"
    Write-GuardentraHost "Writer: tool:$writerNorm (dispatch-bound)"
    Write-GuardentraHost "Starting SHA: $($contract.starting_main_sha)"
    Write-GuardentraHost 'Authorization: github-owner-grant only via sync-grants.'
    return $contract
}

<#
  Shared fetch/main-sync/branch-availability logic used by both #66 start
  paths (provisioning a new isolated worktree, and continuing in one already
  entered). Returns the verified main HEAD SHA.
#>
function Invoke-GuardentraFetchAndFfPullMain {
    param([Parameter(Mandatory)][string]$CurrentBranch)
    if ($script:GuardentraFetchAndFfPullMainProvider) {
        & $script:GuardentraFetchAndFfPullMainProvider $CurrentBranch
        return
    }
    Write-GuardentraHost 'Fetching origin (ff-only sync path)...'
    $fetch = Invoke-GuardentraGit -GitArgs @('fetch', 'origin')
    if ($fetch.ExitCode -ne 0) { throw "git fetch origin failed: $($fetch.Output)" }
    if ($CurrentBranch -ne 'main') {
        $co = Invoke-GuardentraGit -GitArgs @('checkout', 'main')
        if ($co.ExitCode -ne 0) { throw "checkout main failed: $($co.Output)" }
    }
    $pull = Invoke-GuardentraGit -GitArgs @('pull', '--ff-only', 'origin', 'main')
    if ($pull.ExitCode -ne 0) { throw "git pull --ff-only failed: $($pull.Output)" }
}

function Sync-GuardentraMainAndValidate {
    param(
        [Parameter(Mandatory)][string]$FeatureBranch,
        [Parameter(Mandatory)][string]$CurrentBranch,
        [string]$ExpectedStartingSha = ''
    )
    Invoke-GuardentraFetchAndFfPullMain -CurrentBranch $CurrentBranch

    $startingSha = Get-GuardentraHeadSha
    if ($ExpectedStartingSha -and $startingSha -ne $ExpectedStartingSha) {
        throw "REFUSED: main HEAD $startingSha != dispatch starting SHA $ExpectedStartingSha"
    }

    $branches = Invoke-GuardentraGit -GitArgs @('branch', '--list', $FeatureBranch)
    if ($branches.Output -match [regex]::Escape($FeatureBranch)) {
        throw "REFUSED: feature branch '$FeatureBranch' already exists. Checkout it with a valid contract cache; will not recreate baseline."
    }
    return $startingSha
}

function Invoke-GuardentraAuthorize {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [string]$Gate = '',
        [int]$Pr = 0
    )
    Deny-GuardentraLocalAuthorizeMint -Detail 'Use: .\scripts\guardentra.ps1 sync-grants <issue>'
}

function Invoke-GuardentraSyncGrants {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [string]$Action = ''
    )
    Assert-GuardentraRepository
    $contract = Read-GuardentraContract -IssueNumber $IssueNumber
    Test-GuardentraRetryGate -Contract $contract
    Write-GuardentraHost 'NOTE: grant author validation is GitHub identity allowlist only, not cryptographic provenance. Prefer a read-only Issues credential for the writer.'
    $bundle = Get-GuardentraAuthorityGrantsAndEvents -IssueNumber $IssueNumber
    if ($bundle.RejectedAuthors.Count -gt 0) {
        Write-GuardentraHost "Ignored grant/dispatch bodies from non-allowlisted authors: $($bundle.RejectedAuthors -join ', ')"
    }
    if ($bundle.Grants.Count -eq 0) {
        throw "REFUSED: no GUARDENTRA_OWNER_GRANT blocks from accepted Owner/dispatcher identity on GitHub issue #$IssueNumber"
    }
    $imported = 0
    $refusedReplay = 0
    foreach ($g in $bundle.Grants) {
        if ($Action -and [string]$g.action -ne $Action) { continue }
        try {
            $contract = Import-GuardentraOwnerGrant -Contract $contract -Grant $g -GrantEvents @($bundle.Events)
            $imported++
            Write-GuardentraHost "Cached github-owner-grant action=$($g.action) nonce=$($g.nonce) author=$($g.author_login) ref=$($g.source_ref) (cache only; live revalidation required)."
        }
        catch {
            $msg = $_.Exception.Message
            if ($msg -match 'terminal status|replay refused') {
                $refusedReplay++
                Write-GuardentraHost "REFUSED replay for nonce=$($g.nonce): $msg"
                continue
            }
            if ($msg -match 'missing required field|status must be explicit|nonce format|head_sha must|issued_utc|source_ref|author|content_digest|branch') {
                Write-GuardentraHost "Skipped weak/invalid grant nonce=$($g.nonce): $msg"
                continue
            }
            throw
        }
    }
    if ($imported -eq 0) {
        if ($refusedReplay -gt 0) {
            throw "REFUSED: all matching Owner grants were consumed/revoked (replay refused) for issue #$IssueNumber"
        }
        throw "REFUSED: no active matching Owner grants to import for issue #$IssueNumber"
    }
    Save-GuardentraContract -IssueNumber $IssueNumber -Contract $contract
    Write-GuardentraHost "Imported $imported Owner grant(s) into local cache."
}

function Invoke-GuardentraCommit {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [string]$Message = ''
    )
    Assert-GuardentraRepository
    $contract = Read-GuardentraContract -IssueNumber $IssueNumber
    Assert-GuardentraWorktreeMatchesContract -Contract $contract
    Test-GuardentraRetryGate -Contract $contract

    $branch = Get-GuardentraCurrentBranch
    $head = Get-GuardentraHeadSha
    $digest = Get-GuardentraCandidateContentDigest -BaseSha $contract.starting_main_sha
    $contract = Assert-GuardentraAuthorityLive -Contract $contract -Action 'commit' -CurrentHeadSha $head -ContentDigest $digest

    if ($branch -ne $contract.feature_branch) {
        throw "REFUSED: current branch '$branch' != contract feature_branch '$($contract.feature_branch)'"
    }
    if ($branch -eq 'main') {
        throw 'REFUSED: direct commits to main are prohibited.'
    }

    $changed = @(Get-GuardentraChangedFiles -BaseSha $contract.starting_main_sha)
    # Commit stages only uncommitted worktree/index paths still pending.
    $pending = Invoke-GuardentraGit -GitArgs @('status', '--porcelain', '-uall')
    $toStage = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($pending.Output)) {
        foreach ($line in ($pending.Output -split "`r?`n")) {
            if (-not $line.Trim()) { continue }
            $path = $line.Substring(3).Trim()
            if ($path.StartsWith('"') -and $path.EndsWith('"')) { $path = $path.Substring(1, $path.Length - 2) }
            if ($path -match ' -> ') { $path = ($path -split ' -> ')[-1] }
            $path = ($path -replace '\\', '/')
            if ($path) { [void]$toStage.Add($path) }
        }
    }
    $toStage = @($toStage | Sort-Object -Unique)
    if ($toStage.Count -eq 0) { throw 'REFUSED: no changes to commit.' }
    Assert-GuardentraChangedFilesAllowed -Paths $toStage -Contract $contract
    # Also ensure cumulative branch paths remain in allowlist.
    if ($changed.Count -gt 0) {
        Assert-GuardentraChangedFilesAllowed -Paths $changed -Contract $contract
    }

    foreach ($f in $toStage) {
        $add = Invoke-GuardentraGit -GitArgs @('add', '--', $f)
        if ($add.ExitCode -ne 0) { throw "git add failed for ${f}: $($add.Output)" }
    }

    $cached = Invoke-GuardentraGit -GitArgs @('diff', '--cached', '--name-only')
    if ($cached.ExitCode -ne 0) { throw "git diff --cached --name-only failed: $($cached.Output)" }
    $staged = @()
    if (-not [string]::IsNullOrWhiteSpace($cached.Output)) {
        $staged = @(($cached.Output -split "`r?`n") | ForEach-Object { ($_ -replace '\\', '/').Trim() } | Where-Object { $_ })
    }
    if ($staged.Count -eq 0) { throw 'REFUSED: nothing staged after git add.' }
    Assert-GuardentraChangedFilesAllowed -Paths $staged -Contract $contract

    $expected = @($toStage | Sort-Object)
    $actual = @($staged | Sort-Object)
    if (($expected -join '|') -ne ($actual -join '|')) {
        throw "REFUSED: staged file list mismatch. expected=[$($expected -join ', ')] actual=[$($actual -join ', ')]"
    }

    $check = Invoke-GuardentraGit -GitArgs @('diff', '--cached', '--check')
    if ($check.ExitCode -ne 0) {
        $null = Register-GuardentraAttempt -Contract $contract -Success:$false -IssueNumber $IssueNumber
        throw "REFUSED: git diff --cached --check failed: $($check.Output)"
    }

    try {
        Invoke-GuardentraRequiredTests -Contract $contract | Out-Null
    }
    catch {
        $null = Register-GuardentraAttempt -Contract $contract -Success:$false -IssueNumber $IssueNumber
        throw
    }

    # Recompute digest after staging; refuse if grant no longer matches reviewed content.
    $digest2 = Get-GuardentraCandidateContentDigest -BaseSha $contract.starting_main_sha -Paths $staged
    $contract = Assert-GuardentraAuthorityLive -Contract $contract -Action 'commit' -CurrentHeadSha $head -ContentDigest $digest2

    if (-not $Message) {
        $Message = "tooling: issue #$IssueNumber orchestration checkpoint"
    }

    $commit = Invoke-GuardentraGit -GitArgs @('commit', '-m', $Message)
    if ($commit.ExitCode -ne 0) {
        $null = Register-GuardentraAttempt -Contract $contract -Success:$false -IssueNumber $IssueNumber
        throw "commit failed: $($commit.Output)"
    }

    $contract = Clear-GuardentraAuthGrant -Contract $contract -Action 'commit'
    $contract = Register-GuardentraAttempt -Contract $contract -Success:$true -IssueNumber $IssueNumber
    Save-GuardentraContract -IssueNumber $IssueNumber -Contract $contract
    Write-GuardentraHost "Commit created on $($contract.feature_branch) @ $(Get-GuardentraHeadSha)"
    Write-GuardentraHost 'Commit grant consumed (durable nonce ledger). Push/PR/merge/deploy NOT performed.'
}

function Invoke-GuardentraPushAndPr {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [string]$Title = '',
        [string]$BodyFile = ''
    )
    Assert-GuardentraRepository
    $contract = Read-GuardentraContract -IssueNumber $IssueNumber
    Assert-GuardentraWorktreeMatchesContract -Contract $contract
    Test-GuardentraRetryGate -Contract $contract

    $branch = Get-GuardentraCurrentBranch
    $head = Get-GuardentraHeadSha
    $contract = Assert-GuardentraAuthorityLive -Contract $contract -Action 'push-and-pr' -CurrentHeadSha $head

    if ($branch -ne $contract.feature_branch) {
        throw "REFUSED: current branch '$branch' != '$($contract.feature_branch)'"
    }
    Assert-GuardentraWorktreeClean

    $changed = @(Get-GuardentraChangedFiles -BaseSha $contract.starting_main_sha)
    if ($changed.Count -eq 0) {
        throw 'REFUSED: no commits/changes relative to starting_main_sha to push.'
    }
    Assert-GuardentraChangedFilesAllowed -Paths $changed -Contract $contract

    try {
        Invoke-GuardentraRequiredTests -Contract $contract | Out-Null
    }
    catch {
        $null = Register-GuardentraAttempt -Contract $contract -Success:$false -IssueNumber $IssueNumber
        throw
    }

    $push = Invoke-GuardentraGit -GitArgs @('push', '-u', 'origin', 'HEAD')
    if ($push.ExitCode -ne 0) {
        $null = Register-GuardentraAttempt -Contract $contract -Success:$false -IssueNumber $IssueNumber
        throw "git push failed: $($push.Output)"
    }

    if (-not $Title) { $Title = "$($contract.title) (#$IssueNumber)" }
    $bodyArgs = @()
    if ($BodyFile -and (Test-Path -LiteralPath $BodyFile)) {
        $bodyArgs = @('--body-file', $BodyFile)
    }
    else {
        $bodyArgs = @('--body', "Closes #$IssueNumber`n`nPilot orchestration PR. Merge/deploy require separate Owner authorization.")
    }

    $pr = & gh pr create --repo $script:GuardentraExpectedRepo --title $Title @bodyArgs --base main 2>&1
    if ($LASTEXITCODE -ne 0) {
        $null = Register-GuardentraAttempt -Contract $contract -Success:$false -IssueNumber $IssueNumber
        throw "gh pr create failed: $pr"
    }

    $contract = Clear-GuardentraAuthGrant -Contract $contract -Action 'push-and-pr'
    $contract = Register-GuardentraAttempt -Contract $contract -Success:$true -IssueNumber $IssueNumber
    Save-GuardentraContract -IssueNumber $IssueNumber -Contract $contract
    Write-GuardentraHost (Protect-GuardentraSecrets -Text "PR created: $pr")
    Write-GuardentraHost 'Push/PR grant consumed. Merge/deploy NOT performed.'
}

function Invoke-GuardentraMerge {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [Parameter(Mandatory)][int]$Pr
    )
    Assert-GuardentraRepository
    $contract = Read-GuardentraContract -IssueNumber $IssueNumber
    Test-GuardentraRetryGate -Contract $contract

    $view = & gh pr view $Pr --repo $script:GuardentraExpectedRepo --json number,headRefOid,headRefName,baseRefName,state 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gh pr view failed: $view" }
    $prObj = $view | ConvertFrom-Json

    $contract = Assert-GuardentraAuthorityLive -Contract $contract -Action 'merge' -PrNumber $Pr -PrHeadSha ([string]$prObj.headRefOid)

    if ([int]$prObj.number -ne $Pr) { throw 'REFUSED: PR number mismatch' }
    if ([int]$contract.auth_merge.pr_number -ne $Pr) {
        throw "REFUSED: PR #$Pr is not the authorized_pr_number $($contract.auth_merge.pr_number)"
    }
    if ($prObj.baseRefName -ne 'main') { throw "REFUSED: PR base is '$($prObj.baseRefName)', expected main." }
    if ($prObj.state -ne 'OPEN') { throw "REFUSED: PR state is $($prObj.state)" }
    if ($prObj.headRefName -ne $contract.feature_branch) {
        throw "REFUSED: PR head branch '$($prObj.headRefName)' != feature_branch '$($contract.feature_branch)'"
    }
    if (([string]$prObj.headRefOid).ToLowerInvariant() -ne ([string]$contract.auth_merge.head_sha).ToLowerInvariant()) {
        throw "REFUSED: PR head SHA '$($prObj.headRefOid)' != authorized_head_sha '$($contract.auth_merge.head_sha)'"
    }

    $checks = Get-GuardentraPrChecks -Pr $Pr
    try {
        Test-GuardentraRequiredCi -Checks $checks -RequiredName $script:GuardentraRequiredCheckName | Out-Null
    }
    catch {
        $null = Register-GuardentraAttempt -Contract $contract -Success:$false -IssueNumber $IssueNumber
        throw
    }

    $merge = & gh pr merge $Pr --repo $script:GuardentraExpectedRepo --merge 2>&1
    if ($LASTEXITCODE -ne 0) {
        $null = Register-GuardentraAttempt -Contract $contract -Success:$false -IssueNumber $IssueNumber
        throw "gh pr merge failed: $merge"
    }

    $contract = Clear-GuardentraAuthGrant -Contract $contract -Action 'merge'
    $contract = Register-GuardentraAttempt -Contract $contract -Success:$true -IssueNumber $IssueNumber
    Save-GuardentraContract -IssueNumber $IssueNumber -Contract $contract
    Write-GuardentraHost "Merged PR #$Pr"
    Write-GuardentraHost 'Merge grant consumed. Deploy NOT authorized by merge.'
}

function Invoke-GuardentraDeploy {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [Parameter(Mandatory)][ValidateSet('staging', 'production')][string]$Environment
    )
    Assert-GuardentraRepository
    $contract = Read-GuardentraContract -IssueNumber $IssueNumber
    Test-GuardentraRetryGate -Contract $contract
    $action = if ($Environment -eq 'staging') { 'deploy-staging' } else { 'deploy-production' }
    $head = Get-GuardentraHeadSha
    Assert-GuardentraAuthorized -Contract $contract -Action $action -CurrentHeadSha $head
    throw "REFUSED: deploy $Environment is Owner-gated and not implemented in the #9C pilot tooling (no autonomous deploy path)."
}

function Invoke-GuardentraEvidence {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [string]$TestResults = ''
    )
    Assert-GuardentraRepository
    $contract = Read-GuardentraContract -IssueNumber $IssueNumber
    Assert-GuardentraWorktreeMatchesContract -Contract $contract
    $branch = Get-GuardentraCurrentBranch
    if ($branch -ne $contract.feature_branch) {
        throw "REFUSED: evidence branch '$branch' != contract.feature_branch '$($contract.feature_branch)'"
    }
    $current = Get-GuardentraHeadSha
    $pr = Get-GuardentraPrLink -IssueNumber $IssueNumber
    $files = Get-GuardentraChangedFiles -BaseSha $contract.starting_main_sha
    $wt = Get-GuardentraWorktreeState

    if (-not $TestResults) {
        $testScript = Join-Path $script:GuardentraRoot 'scripts\guardentra\tests\Run-Tests.ps1'
        if (Test-Path -LiteralPath $testScript) {
            $out = & powershell -NoProfile -File $testScript 2>&1 | Out-String
            $code = $LASTEXITCODE
            $status = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
            $TestResults = "- ``powershell -File scripts/guardentra/tests/Run-Tests.ps1``: **$status**`n``````text`n$((Protect-GuardentraSecrets -Text $out).Trim())`n``````"
        }
        else {
            $TestResults = '- dispatcher tests: BLOCKED/NOT RUN (Run-Tests.ps1 missing)'
        }
    }

    $md = Protect-GuardentraSecrets -Text (New-GuardentraEvidenceMarkdown `
            -Contract $contract `
            -Branch $branch `
            -CurrentSha $current `
            -PrLink $pr `
            -ChangedFiles $files `
            -TestResults $TestResults `
            -Worktree $wt `
            -Deployment 'NONE')

    $path = Get-GuardentraEvidencePath -IssueNumber $IssueNumber
    New-Item -ItemType Directory -Force -Path (Split-Path $path -Parent) | Out-Null
    Set-Content -Path $path -Value $md -Encoding utf8
    Write-GuardentraHost $md
    Write-GuardentraHost "Evidence written: $path"
    return $md
}

function Invoke-GuardentraStatus {
    param([Parameter(Mandatory)][int]$IssueNumber)
    $contract = Read-GuardentraContract -IssueNumber $IssueNumber
    Write-GuardentraHost "Issue: #$IssueNumber"
    Write-GuardentraHost "Branch (contract): $($contract.feature_branch)"
    Write-GuardentraHost "Worktree (contract): $($contract.worktree_path)"
    Write-GuardentraHost "Writer: tool:$($contract.selected_writer_tool)"
    Write-GuardentraHost "Starting SHA: $($contract.starting_main_sha)"
    Write-GuardentraHost "Current SHA: $(Get-GuardentraHeadSha)"
    Write-GuardentraHost "auth_commit.enabled=$($contract.auth_commit.enabled) head=$($contract.auth_commit.head_sha)"
    Write-GuardentraHost "auth_push_pr.enabled=$($contract.auth_push_pr.enabled) head=$($contract.auth_push_pr.head_sha)"
    Write-GuardentraHost "auth_merge.enabled=$($contract.auth_merge.enabled) pr=$($contract.auth_merge.pr_number) head=$($contract.auth_merge.head_sha)"
    Write-GuardentraHost "Contract: $(Get-GuardentraContractPath -IssueNumber $IssueNumber)"
    Write-GuardentraHost "Packet: $(Get-GuardentraPacketPath -IssueNumber $IssueNumber)"
}
