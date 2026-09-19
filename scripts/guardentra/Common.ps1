# GuardEntra orchestration common helpers (#9C R4 authority closure)
# Dot-source only. No autonomous commit/push/merge/deploy.
# GitHub author allowlist = identity validation only, not cryptographic provenance.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:GuardentraSchemaVersion = 'guardentra.task_contract.v1'
$script:GuardentraOwnerGrantSchema = 'guardentra.owner_grant.v1'
$script:GuardentraGrantEventSchema = 'guardentra.grant_event.v1'
$script:GuardentraExpectedRepo = 'akurteshi-guardentra/guardentra'
$script:GuardentraRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:GuardentraStateRoot = Join-Path $PSScriptRoot 'state\issues'
$script:GuardentraRequiredCheckName = 'verify'
# Owner / Chief Dispatcher identities accepted for dispatch + grants (login only).
$script:GuardentraAuthorityLogins = @('akurteshi-guardentra')
# Optional test/DI providers (script-scoped).
$script:GuardentraAuthorityCommentsProvider = $null
$script:GuardentraPrChecksProvider = $null
$script:GuardentraCurrentBranchProvider = $null
$script:GuardentraHeadShaProvider = $null
$script:GuardentraIssueRecordProvider = $null
$script:GuardentraOwnerGrantProvider = $null # legacy alias unused in R4

function Get-GuardentraRepoRoot {
    return $script:GuardentraRoot
}

function Get-GuardentraIssueDir {
    param([Parameter(Mandatory)][int]$IssueNumber)
    return (Join-Path $script:GuardentraStateRoot ([string]$IssueNumber))
}

function Get-GuardentraContractPath {
    param([Parameter(Mandatory)][int]$IssueNumber)
    return (Join-Path (Get-GuardentraIssueDir -IssueNumber $IssueNumber) 'contract.json')
}

function Get-GuardentraPacketPath {
    param([Parameter(Mandatory)][int]$IssueNumber)
    return (Join-Path (Get-GuardentraIssueDir -IssueNumber $IssueNumber) 'task-packet.md')
}

function Get-GuardentraEvidencePath {
    param([Parameter(Mandatory)][int]$IssueNumber)
    return (Join-Path (Get-GuardentraIssueDir -IssueNumber $IssueNumber) 'evidence.md')
}

function New-GuardentraEmptyAuthGrant {
    return [ordered]@{
        enabled         = $false
        head_sha        = ''
        content_digest  = ''
        pr_number       = 0
        nonce           = ''
        branch          = ''
        source          = ''
        source_ref      = ''
        author_login    = ''
        issued_utc      = ''
        status          = ''
        consumed        = $false
    }
}

function Get-GuardentraNonceLedgerPath {
    $stateParent = Split-Path -Parent $script:GuardentraStateRoot
    return (Join-Path $stateParent 'nonce-ledger.json')
}

function Test-GuardentraAuthorityAuthor {
    param([AllowNull()][string]$Login)
    if ([string]::IsNullOrWhiteSpace($Login)) { return $false }
    $norm = $Login.Trim().ToLowerInvariant()
    foreach ($allowed in @($script:GuardentraAuthorityLogins)) {
        if ($allowed.ToLowerInvariant() -eq $norm) { return $true }
    }
    return $false
}

function Test-GuardentraSha40 {
    param([string]$Sha)
    return ($Sha -match '^[0-9a-f]{40}$')
}

function Test-GuardentraDigest64 {
    param([string]$Digest)
    return ($Digest -match '^[0-9a-f]{64}$')
}

function Test-GuardentraNonceFormat {
    param([string]$Nonce)
    # Stable unique token: 8+ chars of [A-Za-z0-9_-]
    return ($Nonce -match '^[A-Za-z0-9_-]{8,128}$')
}

function Test-GuardentraIssuedUtc {
    param([string]$IssuedUtc)
    if ([string]::IsNullOrWhiteSpace($IssuedUtc)) { return $false }
    try {
        [void][datetimeoffset]::Parse($IssuedUtc, [System.Globalization.CultureInfo]::InvariantCulture)
        return $true
    }
    catch {
        try {
            [void][datetime]::Parse($IssuedUtc, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::RoundtripKind)
            return $true
        }
        catch { return $false }
    }
}

function Test-GuardentraSourceRef {
    param([string]$SourceRef)
    if ([string]::IsNullOrWhiteSpace($SourceRef)) { return $false }
    # Real GitHub comment URL, issue body ref, or explicit issue-body provenance.
    if ($SourceRef -match '^https://github\.com/akurteshi-guardentra/guardentra/issues/\d+#issuecomment-\d+$') { return $true }
    if ($SourceRef -match '^https://github\.com/akurteshi-guardentra/guardentra/issues/\d+#issue-\d+$') { return $true }
    if ($SourceRef -match '^issue-body:\d+$') { return $true }
    return $false
}

function Read-GuardentraNonceLedger {
    $path = Get-GuardentraNonceLedgerPath
    if (-not (Test-Path -LiteralPath $path)) {
        return [ordered]@{ schema = 'guardentra.nonce_ledger.v1'; entries = @() }
    }
    $obj = (Get-Content -LiteralPath $path -Raw -Encoding utf8) | ConvertFrom-Json
    $entries = @()
    if ($obj.entries) { $entries = @($obj.entries) }
    return [ordered]@{ schema = 'guardentra.nonce_ledger.v1'; entries = $entries }
}

function Save-GuardentraNonceLedger {
    param([Parameter(Mandatory)]$Ledger)
    $path = Get-GuardentraNonceLedgerPath
    $dir = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $entries = @()
    $schema = 'guardentra.nonce_ledger.v1'
    if ($Ledger -is [hashtable] -or $Ledger -is [System.Collections.IDictionary]) {
        if ($Ledger.Contains('entries')) { $entries = @($Ledger['entries']) }
        if ($Ledger.Contains('schema') -and $Ledger['schema']) { $schema = [string]$Ledger['schema'] }
    }
    elseif ($null -ne $Ledger) {
        if ($Ledger.PSObject.Properties.Name -contains 'entries') { $entries = @($Ledger.entries) }
        if ($Ledger.PSObject.Properties.Name -contains 'schema' -and $Ledger.schema) { $schema = [string]$Ledger.schema }
    }
    $payload = New-Object PSObject -Property @{
        schema  = $schema
        entries = @($entries)
    }
    $json = $payload | ConvertTo-Json -Depth 6
    Set-Content -Path $path -Value $json -Encoding utf8
}

function Get-GuardentraNonceTerminalStatus {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [Parameter(Mandatory)][string]$Nonce,
        [object[]]$GrantEvents = @()
    )
    $latest = $null
    $latestUtc = [datetimeoffset]::MinValue
    $ledger = Read-GuardentraNonceLedger
    $ledgerEntries = @()
    if ($null -ne $ledger -and ($ledger -is [hashtable] -or $ledger -is [System.Collections.IDictionary]) -and $ledger.Contains('entries')) {
        $ledgerEntries = @($ledger['entries'])
    }
    elseif ($null -ne $ledger -and ($ledger.PSObject.Properties.Name -contains 'entries')) {
        $ledgerEntries = @($ledger.entries)
    }
    foreach ($e in $ledgerEntries) {
        if ($null -eq $e) { continue }
        if ([int]$e.issue -ne $IssueNumber) { continue }
        if ([string]$e.nonce -ne $Nonce) { continue }
        $st = [string]$e.status
        if ($st -notin @('consumed', 'revoked')) { continue }
        $ts = [datetimeoffset]::MinValue
        if ($e.recorded_utc) {
            try { $ts = [datetimeoffset]::Parse([string]$e.recorded_utc) } catch { $ts = [datetimeoffset]::MinValue }
        }
        if ($null -eq $latest -or $ts -ge $latestUtc) {
            $latest = $st
            $latestUtc = $ts
        }
    }
    foreach ($ev in @($GrantEvents)) {
        if ($null -eq $ev) { continue }
        if ([int]$ev.issue -ne $IssueNumber) { continue }
        if ([string]$ev.nonce -ne $Nonce) { continue }
        $st = [string]$ev.status
        if ($st -notin @('consumed', 'revoked')) { continue }
        $ts = [datetimeoffset]::MinValue
        if ($ev.issued_utc) {
            try { $ts = [datetimeoffset]::Parse([string]$ev.issued_utc) } catch { $ts = [datetimeoffset]::MinValue }
        }
        if ($null -eq $latest -or $ts -ge $latestUtc) {
            $latest = $st
            $latestUtc = $ts
        }
    }
    return $latest
}

function Register-GuardentraNonceTerminal {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [Parameter(Mandatory)][string]$Nonce,
        [Parameter(Mandatory)][ValidateSet('consumed', 'revoked')][string]$Status,
        [string]$SourceRef = '',
        [string]$Action = ''
    )
    if (-not (Test-GuardentraNonceFormat -Nonce $Nonce)) {
        throw "REFUSED: cannot record terminal nonce with invalid format '$Nonce'"
    }
    $ledger = Read-GuardentraNonceLedger
    $entries = New-Object System.Collections.Generic.List[object]
    $existing = @()
    if ($ledger -is [hashtable] -or $ledger -is [System.Collections.IDictionary]) {
        if ($ledger.Contains('entries')) { $existing = @($ledger['entries']) }
    }
    elseif ($null -ne $ledger -and ($ledger.PSObject.Properties.Name -contains 'entries')) {
        $existing = @($ledger.entries)
    }
    foreach ($e in $existing) {
        if ($null -ne $e) { [void]$entries.Add($e) }
    }
    [void]$entries.Add((New-Object PSObject -Property @{
                issue        = $IssueNumber
                nonce        = $Nonce
                status       = $Status
                action       = $Action
                source_ref   = $SourceRef
                recorded_utc = (Get-Date).ToUniversalTime().ToString('o')
            }))
    Save-GuardentraNonceLedger -Ledger (@{
            schema  = 'guardentra.nonce_ledger.v1'
            entries = @($entries.ToArray())
        })
}

function New-GuardentraDefaultContract {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][string]$StartingMainSha,
        [Parameter(Mandatory)][string]$FeatureBranch,
        [Parameter(Mandatory)][string]$WriterTool,
        [string]$PersonaRole = 'Engineering Manager / Architect',
        [string]$PersonaSpecPath = 'docs/agent-ops/personas/engineering-manager.md',
        [ValidateSet('T0', 'T1', 'T2', 'T3', 'T4')][string]$AccessTier = 'T1',
        [string[]]$AllowedPaths = @(
            'scripts/guardentra.ps1',
            'scripts/guardentra/*',
            'docs/agent-ops/orchestration/*'
        ),
        [string[]]$ProhibitedPaths = @(
            'src/*',
            'firebase.json',
            'firestore.rules',
            'storage.rules',
            '.agents/*',
            '.claude/*',
            '.cursor/*',
            '.codex/*'
        ),
        [string[]]$AcceptanceCriteria = @(),
        [string[]]$RequiredTests = @('powershell -File scripts/guardentra/tests/Run-Tests.ps1'),
        [int]$RetryLimit = 3
    )

    $now = (Get-Date).ToUniversalTime().ToString('o')
    return [ordered]@{
        schema_version               = $script:GuardentraSchemaVersion
        issue_number                 = $IssueNumber
        title                        = $Title
        starting_main_sha            = $StartingMainSha
        feature_branch               = $FeatureBranch
        selected_writer_tool         = $WriterTool.ToLowerInvariant()
        persona_role                 = $PersonaRole
        persona_spec_path            = $PersonaSpecPath
        access_tier                  = $AccessTier
        allowed_paths                = @($AllowedPaths)
        prohibited_paths             = @($ProhibitedPaths)
        prohibited_actions           = @(
            'autonomous_push',
            'autonomous_merge',
            'autonomous_deploy',
            'secret_disclosure',
            'force_push',
            'direct_main_write',
            'ci_bypass',
            'sticky_authorization'
        )
        acceptance_criteria          = @($AcceptanceCriteria)
        required_tests               = @($RequiredTests)
        retry_limit                  = $RetryLimit
        evidence_requirements        = @(
            'branch',
            'starting_sha',
            'current_sha',
            'pr',
            'changed_files',
            'tests',
            'worktree',
            'deployment'
        )
        # Single-use scoped grants (not sticky booleans).
        auth_commit                  = (New-GuardentraEmptyAuthGrant)
        auth_push_pr                 = (New-GuardentraEmptyAuthGrant)
        auth_merge                   = (New-GuardentraEmptyAuthGrant)
        auth_deploy_staging          = (New-GuardentraEmptyAuthGrant)
        auth_deploy_production       = (New-GuardentraEmptyAuthGrant)
        repository                   = $script:GuardentraExpectedRepo
        created_utc                  = $now
        updated_utc                  = $now
        attempt_count                = 0
    }
}

function ConvertTo-GuardentraAuthGrant {
    param($InputObject)
    $g = New-GuardentraEmptyAuthGrant
    if ($null -eq $InputObject) { return $g }
    if ($InputObject -is [bool]) {
        # Legacy sticky boolean is never trusted as an active grant.
        return $g
    }
    $props = @{}
    if ($InputObject -is [hashtable] -or $InputObject -is [System.Collections.IDictionary]) {
        foreach ($k in $InputObject.Keys) { $props[[string]$k] = $InputObject[$k] }
    }
    else {
        foreach ($p in $InputObject.PSObject.Properties) { $props[$p.Name] = $p.Value }
    }
    $g.enabled = [bool]($props['enabled'] -eq $true)
    $g.head_sha = if ($props.ContainsKey('head_sha') -and $props['head_sha']) { [string]$props['head_sha'] } else { '' }
    $g.content_digest = if ($props.ContainsKey('content_digest') -and $props['content_digest']) { [string]$props['content_digest'] } else { '' }
    $g.pr_number = if ($props.ContainsKey('pr_number') -and $props['pr_number']) { [int]$props['pr_number'] } else { 0 }
    $g.nonce = if ($props.ContainsKey('nonce') -and $props['nonce']) { [string]$props['nonce'] } else { '' }
    $g.branch = if ($props.ContainsKey('branch') -and $props['branch']) { [string]$props['branch'] } else { '' }
    $g.source = if ($props.ContainsKey('source') -and $props['source']) { [string]$props['source'] } else { '' }
    $g.source_ref = if ($props.ContainsKey('source_ref') -and $props['source_ref']) { [string]$props['source_ref'] } else { '' }
    $g.author_login = if ($props.ContainsKey('author_login') -and $props['author_login']) { [string]$props['author_login'] } else { '' }
    $g.issued_utc = if ($props.ContainsKey('issued_utc') -and $props['issued_utc']) { [string]$props['issued_utc'] } else { '' }
    $g.status = if ($props.ContainsKey('status') -and $props['status']) { [string]$props['status'] } else { '' }
    $g.consumed = [bool]($props['consumed'] -eq $true)
    if ($g.consumed) { $g.enabled = $false }
    # Local cache string alone is never authority; enabled only after live revalidation.
    # Keep enabled flag for cache UX but mutating gates must call Assert-GuardentraAuthorityLive.
    if ($g.enabled -and $g.source -ne 'github-owner-grant') {
        $g.enabled = $false
    }
    return $g
}

function ConvertTo-GuardentraContractObject {
    param([Parameter(Mandatory)]$InputObject)

    $ht = [ordered]@{}
    if ($InputObject -is [hashtable] -or $InputObject -is [System.Collections.IDictionary]) {
        foreach ($k in $InputObject.Keys) { $ht[$k] = $InputObject[$k] }
    }
    else {
        foreach ($p in $InputObject.PSObject.Properties) { $ht[$p.Name] = $p.Value }
    }

    if (-not $ht.Contains('retry_limit') -or $null -eq $ht['retry_limit']) { $ht['retry_limit'] = 3 }
    if (-not $ht.Contains('attempt_count') -or $null -eq $ht['attempt_count']) { $ht['attempt_count'] = 0 }

    foreach ($key in @('auth_commit', 'auth_push_pr', 'auth_merge', 'auth_deploy_staging', 'auth_deploy_production')) {
        $ht[$key] = ConvertTo-GuardentraAuthGrant -InputObject $(if ($ht.Contains($key)) { $ht[$key] } else { $null })
    }

    # Strip legacy sticky booleans if present; grants are authoritative.
    foreach ($legacy in @(
            'commit_authorized',
            'push_pr_authorized',
            'merge_authorized',
            'deploy_staging_authorized',
            'deploy_production_authorized'
        )) {
        if ($ht.Contains($legacy)) { $ht.Remove($legacy) }
    }

    return $ht
}

function Get-GuardentraAuthGrantSlot {
    param(
        [Parameter(Mandatory)]$Contract,
        [Parameter(Mandatory)][ValidateSet(
            'commit',
            'push-and-pr',
            'merge',
            'deploy-staging',
            'deploy-production'
        )][string]$Action
    )
    switch ($Action) {
        'commit' { return $Contract.auth_commit }
        'push-and-pr' { return $Contract.auth_push_pr }
        'merge' { return $Contract.auth_merge }
        'deploy-staging' { return $Contract.auth_deploy_staging }
        'deploy-production' { return $Contract.auth_deploy_production }
    }
}

function Save-GuardentraContract {
    param(
        [Parameter(Mandatory)][int]$IssueNumber,
        [Parameter(Mandatory)]$Contract
    )
    $dir = Get-GuardentraIssueDir -IssueNumber $IssueNumber
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $Contract.updated_utc = (Get-Date).ToUniversalTime().ToString('o')
    $json = $Contract | ConvertTo-Json -Depth 8
    Set-Content -Path (Get-GuardentraContractPath -IssueNumber $IssueNumber) -Value $json -Encoding utf8
}

function Read-GuardentraContract {
    param([Parameter(Mandatory)][int]$IssueNumber)
    $path = Get-GuardentraContractPath -IssueNumber $IssueNumber
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Contract not found for issue #$IssueNumber at $path. Run: .\scripts\guardentra.ps1 start $IssueNumber <writer>"
    }
    $raw = Get-Content -LiteralPath $path -Raw -Encoding utf8
    $obj = $raw | ConvertFrom-Json
    return (ConvertTo-GuardentraContractObject -InputObject $obj)
}

function Test-GuardentraAuthorization {
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

    $grant = Get-GuardentraAuthGrantSlot -Contract $Contract -Action $Action
    if (-not $grant -or -not [bool]$grant.enabled -or [bool]$grant.consumed) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "no active single-use github-owner-grant for '$Action' (fail closed; local minting is not authority)"
        }
    }
    # Local source=github-owner-grant string alone is insufficient; live revalidation required for mutating gates.
    if ([string]$grant.source -ne 'github-owner-grant') {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant for '$Action' lacks github-owner-grant source marker (still not authority by itself)"
        }
    }
    if (-not (Test-GuardentraAuthorityAuthor -Login ([string]$grant.author_login))) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant for '$Action' author '$($grant.author_login)' is not on the Owner/dispatcher allowlist"
        }
    }
    if (-not (Test-GuardentraSourceRef -SourceRef ([string]$grant.source_ref))) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant for '$Action' missing stable GitHub source_ref provenance"
        }
    }
    if (-not (Test-GuardentraSha40 -Sha ([string]$grant.head_sha))) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant for '$Action' head_sha must be 40-hex"
        }
    }
    if (-not (Test-GuardentraNonceFormat -Nonce ([string]$grant.nonce))) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant for '$Action' nonce format invalid"
        }
    }
    if ([string]::IsNullOrWhiteSpace([string]$grant.branch)) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant for '$Action' missing exact branch"
        }
    }
    if ([string]$grant.branch -ne [string]$Contract.feature_branch) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant branch '$($grant.branch)' != contract feature_branch '$($Contract.feature_branch)'"
        }
    }
    if (-not (Test-GuardentraIssuedUtc -IssuedUtc ([string]$grant.issued_utc))) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant for '$Action' missing/invalid issued_utc"
        }
    }
    if ([string]$grant.status -ne 'active') {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant for '$Action' status must be explicit 'active' (got '$($grant.status)')"
        }
    }
    $terminal = Get-GuardentraNonceTerminalStatus -IssueNumber ([int]$Contract.issue_number) -Nonce ([string]$grant.nonce)
    if ($terminal) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "grant nonce '$($grant.nonce)' has durable terminal status '$terminal' (replay refused)"
        }
    }

    if ($Action -eq 'merge') {
        if ([int]$grant.pr_number -le 0) {
            return [pscustomobject]@{ Allowed = $false; Reason = 'merge grant missing authorized_pr_number' }
        }
        if ($PrNumber -gt 0 -and [int]$grant.pr_number -ne $PrNumber) {
            return [pscustomobject]@{ Allowed = $false; Reason = "PR #$PrNumber != authorized_pr_number $($grant.pr_number)" }
        }
        if ($PrHeadSha -and ($PrHeadSha.ToLowerInvariant() -ne ([string]$grant.head_sha).ToLowerInvariant())) {
            return [pscustomobject]@{ Allowed = $false; Reason = "PR head SHA mismatch vs authorized_head_sha $($grant.head_sha)" }
        }
        return [pscustomobject]@{
            Allowed = $true
            Reason  = "merge cached grant fields match for PR #$($grant.pr_number) @ $($grant.head_sha) (live revalidation still required)"
        }
    }

    if ($CurrentHeadSha -and ($CurrentHeadSha.ToLowerInvariant() -ne ([string]$grant.head_sha).ToLowerInvariant())) {
        return [pscustomobject]@{
            Allowed = $false
            Reason  = "HEAD $CurrentHeadSha != authorized_head_sha $($grant.head_sha) (single-use scope)"
        }
    }

    if ($Action -eq 'commit') {
        if (-not (Test-GuardentraDigest64 -Digest ([string]$grant.content_digest))) {
            return [pscustomobject]@{
                Allowed = $false
                Reason  = 'commit grant missing/invalid 64-hex content_digest (HEAD-only grants are insufficient)'
            }
        }
        if ($ContentDigest -and ($ContentDigest.ToLowerInvariant() -ne ([string]$grant.content_digest).ToLowerInvariant())) {
            return [pscustomobject]@{
                Allowed = $false
                Reason  = "content_digest mismatch: current=$ContentDigest grant=$($grant.content_digest)"
            }
        }
    }

    return [pscustomobject]@{
        Allowed = $true
        Reason  = "$Action cached grant fields present for HEAD $($grant.head_sha) (live revalidation still required)"
    }
}

function Assert-GuardentraAuthorized {
    param(
        [Parameter(Mandatory)]$Contract,
        [Parameter(Mandatory)][string]$Action,
        [string]$CurrentHeadSha = '',
        [string]$ContentDigest = '',
        [int]$PrNumber = 0,
        [string]$PrHeadSha = ''
    )
    $result = Test-GuardentraAuthorization -Contract $Contract -Action $Action `
        -CurrentHeadSha $CurrentHeadSha -ContentDigest $ContentDigest -PrNumber $PrNumber -PrHeadSha $PrHeadSha
    if (-not $result.Allowed) {
        throw "REFUSED: unauthorized '$Action'. $($result.Reason). Owner/Chief Dispatcher must post a GUARDENTRA_OWNER_GRANT on the GitHub issue; then run: .\scripts\guardentra.ps1 sync-grants $($Contract.issue_number)"
    }
}

function Clear-GuardentraAuthGrant {
    param(
        [Parameter(Mandatory)]$Contract,
        [Parameter(Mandatory)][ValidateSet(
            'commit',
            'push-and-pr',
            'merge',
            'deploy-staging',
            'deploy-production'
        )][string]$Action
    )
    $prior = Get-GuardentraAuthGrantSlot -Contract $Contract -Action $Action
    if ($prior -and -not [string]::IsNullOrWhiteSpace([string]$prior.nonce)) {
        Register-GuardentraNonceTerminal `
            -IssueNumber ([int]$Contract.issue_number) `
            -Nonce ([string]$prior.nonce) `
            -Status 'consumed' `
            -SourceRef ([string]$prior.source_ref) `
            -Action $Action
    }
    $empty = New-GuardentraEmptyAuthGrant
    $empty.consumed = $true
    switch ($Action) {
        'commit' { $Contract.auth_commit = $empty }
        'push-and-pr' { $Contract.auth_push_pr = $empty }
        'merge' { $Contract.auth_merge = $empty }
        'deploy-staging' { $Contract.auth_deploy_staging = $empty }
        'deploy-production' { $Contract.auth_deploy_production = $empty }
    }
    return $Contract
}

function Assert-GuardentraOwnerGrantStrict {
    param(
        [Parameter(Mandatory)]$Grant,
        [Parameter(Mandatory)]$Contract
    )
    $names = @($Grant.PSObject.Properties | ForEach-Object { $_.Name })
    foreach ($req in @('schema', 'issue', 'action', 'nonce', 'branch', 'head_sha', 'issued_utc', 'status', 'source_ref')) {
        if ($names -notcontains $req -or [string]::IsNullOrWhiteSpace([string]$Grant.$req)) {
            throw "REFUSED: grant missing required field '$req'"
        }
    }
    if ([string]$Grant.schema -ne $script:GuardentraOwnerGrantSchema) {
        throw "REFUSED: unsupported grant schema '$($Grant.schema)'"
    }
    if ([int]$Grant.issue -ne [int]$Contract.issue_number) {
        throw "REFUSED: grant issue $($Grant.issue) != contract issue $($Contract.issue_number)"
    }
    $action = [string]$Grant.action
    $allowed = @('commit', 'push-and-pr', 'merge', 'deploy-staging', 'deploy-production')
    if ($action -notin $allowed) { throw "REFUSED: unsupported grant action '$action'" }
    if ([string]$Grant.status -ne 'active') {
        throw "REFUSED: grant status must be explicit 'active' (got '$($Grant.status)'); missing status is not defaulted"
    }
    if (-not (Test-GuardentraNonceFormat -Nonce ([string]$Grant.nonce))) {
        throw "REFUSED: grant nonce format invalid"
    }
    if ([string]$Grant.branch -ne [string]$Contract.feature_branch) {
        throw "REFUSED: grant branch '$($Grant.branch)' != contract feature_branch '$($Contract.feature_branch)'"
    }
    if (-not (Test-GuardentraSha40 -Sha ([string]$Grant.head_sha))) {
        throw 'REFUSED: grant head_sha must be exactly 40 lowercase/hex chars'
    }
    if (-not (Test-GuardentraIssuedUtc -IssuedUtc ([string]$Grant.issued_utc))) {
        throw 'REFUSED: grant issued_utc missing or not parseable'
    }
    if (-not (Test-GuardentraSourceRef -SourceRef ([string]$Grant.source_ref))) {
        throw 'REFUSED: grant source_ref must be a real GitHub issue comment/body provenance URL'
    }
    if (-not (Test-GuardentraAuthorityAuthor -Login ([string]$Grant.author_login))) {
        throw "REFUSED: grant author '$($Grant.author_login)' is not an accepted Owner/dispatcher identity"
    }
    if ($action -eq 'commit') {
        if (-not (Test-GuardentraDigest64 -Digest ([string]$Grant.content_digest))) {
            throw 'REFUSED: commit grant requires 64-hex content_digest'
        }
    }
    if ($action -eq 'merge' -and [int]$Grant.pr_number -le 0) {
        throw 'REFUSED: merge grant requires pr_number'
    }
}

function Import-GuardentraOwnerGrant {
    <#
      Applies a validated GitHub Owner grant into the local cache (evidence only).
      Does not mint authority. Local source=github-owner-grant alone is never authority.
    #>
    param(
        [Parameter(Mandatory)]$Contract,
        [Parameter(Mandatory)]$Grant,
        [object[]]$GrantEvents = @()
    )

    Assert-GuardentraOwnerGrantStrict -Grant $Grant -Contract $Contract
    $terminal = Get-GuardentraNonceTerminalStatus -IssueNumber ([int]$Contract.issue_number) -Nonce ([string]$Grant.nonce) -GrantEvents $GrantEvents
    if ($terminal) {
        throw "REFUSED: nonce '$($Grant.nonce)' has durable terminal status '$terminal' (replay refused)"
    }

    $action = [string]$Grant.action
    $slot = [ordered]@{
        enabled        = $true
        head_sha       = ([string]$Grant.head_sha).ToLowerInvariant()
        content_digest = if ($Grant.content_digest) { ([string]$Grant.content_digest).ToLowerInvariant() } else { '' }
        pr_number      = if ($Grant.pr_number) { [int]$Grant.pr_number } else { 0 }
        nonce          = [string]$Grant.nonce
        branch         = [string]$Grant.branch
        source         = 'github-owner-grant'
        source_ref     = [string]$Grant.source_ref
        author_login   = [string]$Grant.author_login
        issued_utc     = [string]$Grant.issued_utc
        status         = 'active'
        consumed       = $false
    }

    switch ($action) {
        'commit' { $Contract.auth_commit = $slot }
        'push-and-pr' { $Contract.auth_push_pr = $slot }
        'merge' { $Contract.auth_merge = $slot }
        'deploy-staging' { $Contract.auth_deploy_staging = $slot }
        'deploy-production' { $Contract.auth_deploy_production = $slot }
    }
    return $Contract
}

function ConvertFrom-GuardentraOwnerGrantText {
    param(
        [Parameter(Mandatory)][string]$Text,
        [string]$SourceRef = '',
        [string]$AuthorLogin = ''
    )
    $grants = New-Object System.Collections.Generic.List[object]
    if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
    if ($Text -notmatch 'GUARDENTRA_OWNER_GRANT') { return @() }

    $rx = [regex]::new('\{[^{}]*"schema"\s*:\s*"guardentra\.owner_grant\.v1"[^{}]*\}', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    foreach ($m in $rx.Matches($Text)) {
        try { $obj = $m.Value | ConvertFrom-Json } catch { continue }
        if (-not $obj) { continue }
        $names = @($obj.PSObject.Properties | ForEach-Object { $_.Name })
        if ($names -notcontains 'schema' -or [string]$obj.schema -ne 'guardentra.owner_grant.v1') { continue }
        if ($names -notcontains 'issue' -or $names -notcontains 'action' -or $names -notcontains 'nonce' -or $names -notcontains 'head_sha') { continue }
        # Explicit fields only — never default missing status to active.
        $branch = ''
        if ($names -contains 'branch') { $branch = [string]$obj.branch }
        $digest = ''
        if ($names -contains 'content_digest') { $digest = [string]$obj.content_digest }
        $prNumber = 0
        if ($names -contains 'pr_number') { $prNumber = [int]$obj.pr_number }
        $issued = ''
        if ($names -contains 'issued_utc') { $issued = [string]$obj.issued_utc }
        $status = ''
        if ($names -contains 'status') { $status = [string]$obj.status }
        $row = New-Object PSObject -Property @{
            schema         = [string]$obj.schema
            issue          = [int]$obj.issue
            action         = [string]$obj.action
            nonce          = [string]$obj.nonce
            branch         = $branch
            head_sha       = [string]$obj.head_sha
            content_digest = $digest
            pr_number      = $prNumber
            issued_utc     = $issued
            status         = $status
            source_ref     = $SourceRef
            author_login   = $AuthorLogin
        }
        [void]$grants.Add($row)
    }
    return , @($grants.ToArray())
}

function ConvertFrom-GuardentraGrantEventText {
    param(
        [Parameter(Mandatory)][string]$Text,
        [string]$SourceRef = '',
        [string]$AuthorLogin = ''
    )
    $events = New-Object System.Collections.Generic.List[object]
    if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
    if ($Text -notmatch 'GUARDENTRA_GRANT_EVENT') { return @() }
    $rx = [regex]::new('\{[^{}]*"schema"\s*:\s*"guardentra\.grant_event\.v1"[^{}]*\}', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    foreach ($m in $rx.Matches($Text)) {
        try { $obj = $m.Value | ConvertFrom-Json } catch { continue }
        if (-not $obj) { continue }
        $names = @($obj.PSObject.Properties | ForEach-Object { $_.Name })
        if ($names -notcontains 'schema' -or [string]$obj.schema -ne $script:GuardentraGrantEventSchema) { continue }
        if ($names -notcontains 'issue' -or $names -notcontains 'nonce' -or $names -notcontains 'status') { continue }
        $issued = ''
        if ($names -contains 'issued_utc') { $issued = [string]$obj.issued_utc }
        [void]$events.Add((New-Object PSObject -Property @{
                    schema       = [string]$obj.schema
                    issue        = [int]$obj.issue
                    nonce        = [string]$obj.nonce
                    status       = [string]$obj.status
                    issued_utc   = $issued
                    source_ref   = $SourceRef
                    author_login = $AuthorLogin
                }))
    }
    return , @($events.ToArray())
}

function Get-GuardentraCandidateContentDigest {
    param(
        [Parameter(Mandatory)][string]$BaseSha,
        [string[]]$Paths = @()
    )
    if (-not $Paths -or $Paths.Count -eq 0) {
        $Paths = @(Get-GuardentraChangedFiles -BaseSha $BaseSha)
    }
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($rel in ($Paths | Sort-Object -Unique)) {
        $norm = ($rel -replace '\\', '/')
        $full = Join-Path $script:GuardentraRoot (($norm -replace '/', [IO.Path]::DirectorySeparatorChar))
        if (Test-Path -LiteralPath $full -PathType Leaf) {
            $h = Invoke-GuardentraGit -GitArgs @('hash-object', '--', $norm)
            if ($h.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($h.Output)) {
                throw "REFUSED: unable to hash-object for digest: $norm"
            }
            [void]$lines.Add("$norm`t$($h.Output.Trim())")
        }
        else {
            [void]$lines.Add("$norm`tDELETED")
        }
    }
    $payload = ($lines -join "`n")
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $hash = $sha.ComputeHash($bytes)
        return (([System.BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant())
    }
    finally {
        $sha.Dispose()
    }
}

function Test-GuardentraAccessTierAllowed {
    param(
        [Parameter(Mandatory)][string]$AccessTier,
        [Parameter(Mandatory)][string]$MaxTier
    )
    $rank = @{ T0 = 0; T1 = 1; T2 = 2; T3 = 3; T4 = 4 }
    if (-not $rank.ContainsKey($AccessTier) -or -not $rank.ContainsKey($MaxTier)) {
        throw "REFUSED: invalid access tier '$AccessTier' / max '$MaxTier'"
    }
    if ($rank[$AccessTier] -gt $rank[$MaxTier]) {
        throw "REFUSED: access tier '$AccessTier' exceeds dispatch max '$MaxTier'"
    }
    if ($AccessTier -in @('T3', 'T4') -or $MaxTier -in @('T3', 'T4')) {
        # Issue #59 pilot: T3/T4 never allowed via dispatcher CLI.
        if ($AccessTier -in @('T3', 'T4')) {
            throw 'REFUSED: T3/T4 are not permitted for this pilot dispatcher'
        }
    }
    return $true
}

function Test-GuardentraPathAllowed {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$AllowedPaths,
        [string[]]$ProhibitedPaths = @()
    )

    $norm = ($Path -replace '\\', '/').TrimStart('./')
    foreach ($deny in $ProhibitedPaths) {
        if (Test-GuardentraGlobMatch -Path $norm -Pattern $deny) { return $false }
    }
    foreach ($allow in $AllowedPaths) {
        if (Test-GuardentraGlobMatch -Path $norm -Pattern $allow) { return $true }
    }
    return $false
}

function Test-GuardentraGlobMatch {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Pattern
    )
    $p = ($Pattern -replace '\\', '/')
    if ($p -eq $Path) { return $true }
    if ($p.EndsWith('/*')) {
        $root = $p.Substring(0, $p.Length - 2)
        if ($Path -eq $root) { return $true }
        if ($Path.StartsWith($root + '/')) { return $true }
        return $false
    }
    if ($p.EndsWith('*')) {
        $prefix = $p.Substring(0, $p.Length - 1)
        return $Path.StartsWith($prefix)
    }
    return $false
}

function Assert-GuardentraChangedFilesAllowed {
    param(
        [Parameter(Mandatory)][string[]]$Paths,
        [Parameter(Mandatory)]$Contract
    )
    $bad = @()
    foreach ($path in $Paths) {
        if (-not (Test-GuardentraPathAllowed -Path $path -AllowedPaths @($Contract.allowed_paths) -ProhibitedPaths @($Contract.prohibited_paths))) {
            $bad += $path
        }
    }
    if ($bad.Count -gt 0) {
        throw "REFUSED: paths outside allowlist: $($bad -join ', ')"
    }
}

function Protect-GuardentraSecrets {
    param([AllowNull()][string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return $Text }

    $patterns = @(
        @{ Re = '(?i)(api[_-]?key|secret|token|password|passwd|authorization)\s*[=:]\s*([^\s''"]+)'; Rep = '${1}=***REDACTED***' },
        @{ Re = '(?i)Bearer\s+[A-Za-z0-9\-._~+/]+=*'; Rep = 'Bearer ***REDACTED***' },
        @{ Re = '-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----'; Rep = '***REDACTED PRIVATE KEY***' },
        @{ Re = '(?i)AIza[0-9A-Za-z\-_]{20,}'; Rep = '***REDACTED_GOOGLE_KEY***' },
        @{ Re = '(?i)ghp_[A-Za-z0-9]{20,}'; Rep = '***REDACTED_GH_TOKEN***' },
        @{ Re = '(?i)github_pat_[A-Za-z0-9_]{20,}'; Rep = '***REDACTED_GH_PAT***' },
        @{ Re = '(?i)sk-[A-Za-z0-9]{20,}'; Rep = '***REDACTED_SK***' }
    )

    $out = $Text
    foreach ($p in $patterns) {
        $out = [regex]::Replace($out, $p.Re, $p.Rep)
    }
    return $out
}

function Write-GuardentraHost {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host (Protect-GuardentraSecrets -Text $Message)
}

function Invoke-GuardentraGit {
    param([Parameter(Mandatory)][string[]]$GitArgs)
    $out = & git -C $script:GuardentraRoot @GitArgs 2>&1
    $code = $LASTEXITCODE
    $text = ($out | Out-String).TrimEnd()
    return [pscustomobject]@{
        ExitCode = $code
        Output   = $text
    }
}

function Test-GuardentraOriginUrl {
    param([Parameter(Mandatory)][string]$Url)
    $u = $Url.Trim()
    $patterns = @(
        '^https://github\.com/akurteshi-guardentra/guardentra(\.git)?/?$',
        '^git@github\.com:akurteshi-guardentra/guardentra(\.git)?$',
        '^ssh://git@github\.com/akurteshi-guardentra/guardentra(\.git)?$'
    )
    foreach ($p in $patterns) {
        if ($u -match $p) { return $true }
    }
    return $false
}

function Assert-GuardentraRepository {
    $remote = Invoke-GuardentraGit -GitArgs @('remote', 'get-url', 'origin')
    if ($remote.ExitCode -ne 0) { throw "Unable to read origin remote: $($remote.Output)" }
    $url = ($remote.Output -split "`r?`n")[0].Trim()
    if (-not (Test-GuardentraOriginUrl -Url $url)) {
        throw "REFUSED: unexpected repository origin '$url'. Expected GitHub HTTPS/SSH for $script:GuardentraExpectedRepo"
    }
}

function Test-GuardentraWorktreeClean {
    $status = Invoke-GuardentraGit -GitArgs @('status', '--porcelain', '-uall')
    if ($status.ExitCode -ne 0) { throw "git status failed: $($status.Output)" }
    return [string]::IsNullOrWhiteSpace($status.Output)
}

function Assert-GuardentraWorktreeClean {
    if (-not (Test-GuardentraWorktreeClean)) {
        throw 'REFUSED: worktree is not clean. Issue #59 requires clean baseline for sync/mutating push paths.'
    }
}

function Get-GuardentraCurrentBranch {
    if ($script:GuardentraCurrentBranchProvider) {
        return [string](& $script:GuardentraCurrentBranchProvider)
    }
    $r = Invoke-GuardentraGit -GitArgs @('branch', '--show-current')
    if ($r.ExitCode -ne 0) { throw "Unable to read current branch: $($r.Output)" }
    return $r.Output.Trim()
}

function Get-GuardentraHeadSha {
    if ($script:GuardentraHeadShaProvider) {
        return [string](& $script:GuardentraHeadShaProvider)
    }
    $r = Invoke-GuardentraGit -GitArgs @('rev-parse', 'HEAD')
    if ($r.ExitCode -ne 0) { throw "Unable to read HEAD: $($r.Output)" }
    return $r.Output.Trim()
}

function Get-GuardentraChangedFiles {
    param([string]$BaseSha)
    $files = New-Object System.Collections.Generic.List[string]

    if ($BaseSha) {
        $diff = Invoke-GuardentraGit -GitArgs @('diff', '--name-only', "$BaseSha...HEAD")
        if ($diff.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($diff.Output)) {
            foreach ($line in ($diff.Output -split "`r?`n")) {
                if ($line.Trim()) { [void]$files.Add(($line.Trim() -replace '\\', '/')) }
            }
        }
    }

    # -uall enumerates individual untracked files (never directory collapse).
    $wt = Invoke-GuardentraGit -GitArgs @('status', '--porcelain', '-uall')
    if ($wt.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($wt.Output)) {
        foreach ($line in ($wt.Output -split "`r?`n")) {
            if (-not $line.Trim()) { continue }
            $path = $line.Substring(3).Trim()
            if ($path.StartsWith('"') -and $path.EndsWith('"')) {
                $path = $path.Substring(1, $path.Length - 2)
            }
            if ($path -match ' -> ') { $path = ($path -split ' -> ')[-1] }
            $path = ($path -replace '\\', '/')
            if ($path -and -not $files.Contains($path)) { [void]$files.Add($path) }
        }
    }

    return @($files | Sort-Object -Unique)
}

function Get-GuardentraWorktreeState {
    $r = Invoke-GuardentraGit -GitArgs @('status', '--short', '-uall')
    if ($r.ExitCode -ne 0) { return "ERROR: $($r.Output)" }
    if ([string]::IsNullOrWhiteSpace($r.Output)) { return 'Clean' }
    return $r.Output.TrimEnd()
}

function Get-GuardentraPrLink {
    param([Parameter(Mandatory)][int]$IssueNumber)
    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) { return 'NONE' }
    try {
        $json = & gh pr list --repo $script:GuardentraExpectedRepo --state open --search "head:$(Get-GuardentraCurrentBranch)" --json url,number 2>$null | ConvertFrom-Json
        if ($json -and $json.Count -gt 0) {
            return "$($json[0].url)"
        }
    }
    catch {
        return 'NONE'
    }
    return 'NONE'
}

function Register-GuardentraAttempt {
    param(
        [Parameter(Mandatory)]$Contract,
        [Parameter(Mandatory)][bool]$Success,
        [int]$IssueNumber = 0
    )
    if ($Success) {
        $Contract.attempt_count = 0
        if ($IssueNumber -gt 0) { Save-GuardentraContract -IssueNumber $IssueNumber -Contract $Contract }
        return $Contract
    }
    $Contract.attempt_count = [int]$Contract.attempt_count + 1
    # Persist BEFORE escalate so the third failure cannot be replayed forever.
    if ($IssueNumber -gt 0) {
        Save-GuardentraContract -IssueNumber $IssueNumber -Contract $Contract
    }
    if ([int]$Contract.attempt_count -ge [int]$Contract.retry_limit) {
        throw "ESCALATE TO OWNER: retry_limit=$($Contract.retry_limit) reached (attempt_count=$($Contract.attempt_count)). Stop further correction cycles."
    }
    return $Contract
}

function Test-GuardentraRetryGate {
    param([Parameter(Mandatory)]$Contract)
    if ([int]$Contract.attempt_count -ge [int]$Contract.retry_limit) {
        throw "ESCALATE TO OWNER: retry_limit already reached ($($Contract.attempt_count)/$($Contract.retry_limit))."
    }
}

function Test-GuardentraRequiredCi {
    param(
        [Parameter(Mandatory)]$Checks,
        [string]$RequiredName = 'verify'
    )

    $list = @($Checks | Where-Object { $null -ne $_ })
    if ($list.Count -eq 0) {
        throw 'REFUSED: no required CI checks present (fail closed)'
    }

    $verify = $list | Where-Object {
        $n = if ($_.name) { [string]$_.name } elseif ($_.Name) { [string]$_.Name } else { '' }
        $n -eq $RequiredName
    } | Select-Object -First 1

    if (-not $verify) {
        throw "REFUSED: required check '$RequiredName' is missing from --required checks"
    }

    $state = ''
    if ($verify.PSObject.Properties.Name -contains 'state' -and $verify.state) { $state = [string]$verify.state }
    elseif ($verify.PSObject.Properties.Name -contains 'State' -and $verify.State) { $state = [string]$verify.State }

    $bucket = ''
    if ($verify.PSObject.Properties.Name -contains 'bucket' -and $verify.bucket) { $bucket = [string]$verify.bucket }
    elseif ($verify.PSObject.Properties.Name -contains 'Bucket' -and $verify.Bucket) { $bucket = [string]$verify.Bucket }

    $stateU = $state.ToUpperInvariant()
    $bucketL = $bucket.ToLowerInvariant()

    # Accept only explicit PASS/SUCCESS. Refuse pending/skip/neutral/fail/cancel.
    $pass = ($stateU -eq 'SUCCESS') -or ($bucketL -eq 'pass')
    if (-not $pass) {
        throw "REFUSED: required check '$RequiredName' is not PASS/SUCCESS (state=$state bucket=$bucket)"
    }
    if ($stateU -in @('PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED', 'CANCELLED', 'FAILURE', 'TIMED_OUT', 'NEUTRAL', 'SKIPPED') -and $stateU -ne 'SUCCESS') {
        throw "REFUSED: required check '$RequiredName' state '$state' is not SUCCESS"
    }
    if ($bucketL -in @('pending', 'skip', 'fail', 'cancel') ) {
        throw "REFUSED: required check '$RequiredName' bucket '$bucket' is not pass"
    }

    return $true
}

function Invoke-GuardentraRequiredTests {
    param([Parameter(Mandatory)]$Contract)
    $results = New-Object System.Collections.Generic.List[string]
    foreach ($cmd in @($Contract.required_tests)) {
        if ([string]::IsNullOrWhiteSpace($cmd)) { continue }
        Write-GuardentraHost "Running required check: $cmd"
        $out = & powershell -NoProfile -Command "Set-Location -LiteralPath '$($script:GuardentraRoot)'; $cmd" 2>&1 | Out-String
        $code = $LASTEXITCODE
        if ($code -ne 0) {
            throw "REFUSED: required test failed ($cmd): $(Protect-GuardentraSecrets -Text $out)"
        }
        [void]$results.Add("PASS: $cmd")
    }
    return @($results)
}

function New-GuardentraTaskPacketMarkdown {
    param([Parameter(Mandatory)]$Contract)

    $ac = ($Contract.acceptance_criteria | ForEach-Object { "- $_" }) -join "`n"
    if (-not $ac) { $ac = '- (see GitHub issue)' }
    $tests = ($Contract.required_tests | ForEach-Object { "- $_" }) -join "`n"
    $allowed = ($Contract.allowed_paths | ForEach-Object { "- ``$_``" }) -join "`n"
    $prohibited = ($Contract.prohibited_paths | ForEach-Object { "- ``$_``" }) -join "`n"
    $actions = ($Contract.prohibited_actions | ForEach-Object { "- $_" }) -join "`n"

    $fmtGrant = {
        param($g, $label)
        if (-not $g -or -not $g.enabled -or $g.consumed) { return "- ${label}: DENIED (no active github-owner-grant)" }
        $pr = if ([int]$g.pr_number -gt 0) { " pr#$($g.pr_number)" } else { '' }
        $dig = if ($g.content_digest) { " digest=$($g.content_digest.Substring(0, [Math]::Min(12, $g.content_digest.Length)))..." } else { '' }
        return "- ${label}: ACTIVE source=$($g.source) head=$($g.head_sha)$pr$dig nonce=$($g.nonce)"
    }

    $authLines = @(
        (& $fmtGrant $Contract.auth_commit 'commit')
        (& $fmtGrant $Contract.auth_push_pr 'push-and-pr')
        (& $fmtGrant $Contract.auth_merge 'merge')
        (& $fmtGrant $Contract.auth_deploy_staging 'deploy-staging')
        (& $fmtGrant $Contract.auth_deploy_production 'deploy-production')
    ) -join "`n"

    @"
# GuardEntra Task Packet (generated)

- Packet ID: issue-$($Contract.issue_number)
- Updated UTC: $($Contract.updated_utc)
- Repository: $($Contract.repository)
- GitHub issue: #$($Contract.issue_number) -- $($Contract.title)
- Base branch and verified SHA: ``main`` @ ``$($Contract.starting_main_sha)``
- Feature branch: ``$($Contract.feature_branch)``
- Primary writing tool (``tool:*``): ``tool:$($Contract.selected_writer_tool)``
- Persona / role: $($Contract.persona_role)
- Persona spec: ``$($Contract.persona_spec_path)``
- Access tier: $($Contract.access_tier)
- Owner / merge authority: ``@akurteshi-guardentra``
- Retry limit: $($Contract.retry_limit)

## Authorization state (fail closed, single-use, live-revalidated)

$authLines

Edit/commit permission does **not** imply push. Push does **not** imply merge. Merge does **not** imply deploy.
Local ``contract.json`` is cache/evidence only. ``source=github-owner-grant`` alone is never authority.
Owner/Chief Dispatcher posts ``## GUARDENTRA_OWNER_GRANT`` on the GitHub issue; writer runs ``.\scripts\guardentra.ps1 sync-grants $($Contract.issue_number)``.
Mutating gates re-fetch the authoritative GitHub dispatch + exact grant nonce before acting. Consumed/revoked nonces cannot be replayed.

## Scope and authority

### Allowed paths
$allowed

### Prohibited paths
$prohibited

### Prohibited actions
$actions

### Owner command authorized
NONE unless an ACTIVE grant is listed above **and** live GitHub revalidation succeeds.
Do **not** use local ``authorize`` — it cannot mint Owner authority.
Record grants on GitHub, then: ``.\scripts\guardentra.ps1 sync-grants $($Contract.issue_number)``.
Author validation is GitHub identity allowlist only (not cryptographic provenance). Prefer a read-only Issues credential for the writer.

## Required reads

1. ``AGENTS.md``
2. ``docs/agent-ops/AGENCY_AGENT_ROSTER.md``
3. ``docs/agent-ops/personas/README.md``
4. ``$($Contract.persona_spec_path)``
5. GitHub issue #$($Contract.issue_number)

## Acceptance criteria
$ac

## Required tests/checks
$tests

## Evidence requirements

Run:

``````powershell
.\scripts\guardentra.ps1 evidence $($Contract.issue_number)
``````

Return branch, starting SHA, current SHA, PR or NONE, changed files, tests/results, worktree, deployment=NONE.

## Handoff rules

- Exactly one writer on this branch: ``tool:$($Contract.selected_writer_tool)``
- STOP at the Owner-authorized boundary
- Do not auto-commit / auto-push / auto-PR / auto-merge / auto-deploy
- Do not disclose secrets
- After three failed correction cycles: stop and escalate to Owner
"@
}

function New-GuardentraEvidenceMarkdown {
    param(
        [Parameter(Mandatory)]$Contract,
        [Parameter(Mandatory)][string]$Branch,
        [Parameter(Mandatory)][string]$CurrentSha,
        [Parameter(Mandatory)][string]$PrLink,
        [Parameter(Mandatory)][string[]]$ChangedFiles,
        [Parameter(Mandatory)][string]$TestResults,
        [Parameter(Mandatory)][string]$Worktree,
        [Parameter(Mandatory)][string]$Deployment
    )

    $fileList = if ($ChangedFiles.Count -eq 0) { '- (none)' } else { ($ChangedFiles | ForEach-Object { "- ``$_``" }) -join "`n" }

    @"
# GuardEntra Orchestration Evidence

Issue: #$($Contract.issue_number)
Generated UTC: $((Get-Date).ToUniversalTime().ToString('o'))

## Mandatory evidence

1. **Branch name:** ``$Branch``
2. **Starting SHA:** ``$($Contract.starting_main_sha)``
3. **Current SHA:** ``$CurrentSha``
4. **GitHub PR:** $PrLink
5. **Exact changed files:**
$fileList
6. **Test results:**
$TestResults
7. **Remaining uncommitted files / worktree:**
``````
$Worktree
``````
8. **Deployment status:** $Deployment

## Authorization snapshot (single-use grants)

- commit.enabled=$($Contract.auth_commit.enabled) head=$($Contract.auth_commit.head_sha) consumed=$($Contract.auth_commit.consumed)
- push_pr.enabled=$($Contract.auth_push_pr.enabled) head=$($Contract.auth_push_pr.head_sha) consumed=$($Contract.auth_push_pr.consumed)
- merge.enabled=$($Contract.auth_merge.enabled) pr=$($Contract.auth_merge.pr_number) head=$($Contract.auth_merge.head_sha) consumed=$($Contract.auth_merge.consumed)
- attempt_count: $($Contract.attempt_count) / retry_limit $($Contract.retry_limit)
- writer: tool:$($Contract.selected_writer_tool)

## Notes

- Autonomous push/merge/deploy: NO
- Secrets: none should appear in this report (redacted if present)
"@
}

function Resolve-GuardentraWriter {
    param([Parameter(Mandatory)][string]$Writer)
    $w = $Writer.Trim().ToLowerInvariant()
    $allowed = @('cursor', 'codex', 'claude', 'claude-code')
    if ($w -notin $allowed) {
        throw "REFUSED: unsupported writer '$Writer'. Allowed for pilot: $($allowed -join ', ')"
    }
    return $w
}

function Deny-GuardentraLocalAuthorizeMint {
    param([string]$Detail = '')
    $msg = 'REFUSED: local authorize cannot mint Owner authority. Post GUARDENTRA_OWNER_GRANT on the GitHub issue (Owner/Chief Dispatcher), then sync-grants.'
    if ($Detail) { $msg = "$msg $Detail" }
    throw $msg
}
