[CmdletBinding()]
param(
    [ValidateRange(5, 3600)][int]$IntervalSeconds = 30,
    [switch]$Once,
    [switch]$NoPublish
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'Observe-LocalAgents.ps1')

$script:GuardentraExpectedCheckpointRepo = 'akurteshi-guardentra/guardentra'

function Get-GuardentraCheckpointHash {
    param([string]$Text)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Get-GuardentraLocalCompletionCheckpoint {
    param([string]$IssueDir)

    $supervisor = Join-Path $IssueDir 'supervisor.json'
    $contractPath = Join-Path $IssueDir 'contract.json'
    if (-not (Test-Path -LiteralPath $supervisor) -or -not (Test-Path -LiteralPath $contractPath)) { return $null }

    try {
        $state = Get-Content -LiteralPath $supervisor -Raw -Encoding UTF8 | ConvertFrom-Json
        $contract = Get-Content -LiteralPath $contractPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch { return $null }

    $phase = [string](Get-GuardentraObserverProperty $state 'phase')
    if ($phase -notin @('owner_gate','blocked')) { return $null }

    $directoryIssue = Split-Path $IssueDir -Leaf
    if ($directoryIssue -notmatch '^[1-9][0-9]*$') { return $null }
    $issue = [int](Get-GuardentraObserverProperty $state 'issue' 0)
    $contractIssue = [int](Get-GuardentraObserverProperty $contract 'issue_number' 0)
    if ($issue -le 0 -or $issue -ne [int]$directoryIssue -or $contractIssue -ne $issue) { return $null }

    $snapshot = Get-GuardentraObserverProperty $state 'snapshot' $null
    $branch = [string](Get-GuardentraObserverProperty $snapshot 'branch')
    $head = [string](Get-GuardentraObserverProperty $snapshot 'head')
    $contractBranch = [string](Get-GuardentraObserverProperty $contract 'feature_branch')
    $worktree = [string](Get-GuardentraObserverProperty $contract 'worktree_path')
    if ([string]::IsNullOrWhiteSpace($worktree) -or [string]::IsNullOrWhiteSpace($branch) -or $head -notmatch '^[0-9a-f]{40}$' -or $branch -cne $contractBranch) { return $null }

    try {
        $worktreeFull = [IO.Path]::GetFullPath($worktree).TrimEnd('\')
        $issueFull = [IO.Path]::GetFullPath($IssueDir).TrimEnd('\')
        $expectedIssueDir = [IO.Path]::GetFullPath((Join-Path (Join-Path $worktreeFull 'scripts\guardentra\state\issues') ([string]$issue))).TrimEnd('\')
        if (-not [StringComparer]::OrdinalIgnoreCase.Equals($issueFull,$expectedIssueDir)) { return $null }
        $actualBranch = [string](& git -C $worktreeFull rev-parse --abbrev-ref HEAD 2>$null | Select-Object -First 1)
        if ($LASTEXITCODE -ne 0) { return $null }
        $actualHead = [string](& git -C $worktreeFull rev-parse HEAD 2>$null | Select-Object -First 1)
        if ($LASTEXITCODE -ne 0) { return $null }
        $actualBranch = $actualBranch.Trim()
        $actualHead = $actualHead.Trim()
        if ($actualBranch -cne $branch -or $actualHead -cne $head) { return $null }
    } catch { return $null }

    return [ordered]@{
        schema = 'guardentra.local_checkpoint.v1'
        issue = $issue
        phase = (Protect-GuardentraObserverText $phase)
        provider = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'provider'))
        reviewer = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'reviewer'))
        branch = (Protect-GuardentraObserverText $branch)
        head = (Protect-GuardentraObserverText $head)
        task_hash = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'task_hash'))
        verification = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'verification' 'MISSING'))
        test_count = @(Get-GuardentraObserverProperty $state 'tests' @()).Count
        attempt_count = @(Get-GuardentraObserverProperty $state 'attempts' @()).Count
        handoff_count = @(Get-GuardentraObserverProperty $state 'handoffs' @()).Count
        blocker = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'blocker'))
        owner_gate = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'owner_gate'))
        source = 'owner_local_supervisor+contract+git'
        observed_utc = [datetime]::UtcNow.ToString('o')
    }
}
function New-GuardentraCheckpointComment {
    param($Checkpoint)
    $json = $Checkpoint | ConvertTo-Json -Depth 8 -Compress
    return ('GUARDENTRA_LOCAL_CHECKPOINT v1' + [Environment]::NewLine + $json)
}

function Invoke-GuardentraDefaultCheckpointPublisher {
    param([int]$Issue, [string]$Body)

    $gh = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) { return $false }

    $temp = [IO.Path]::GetTempFileName()
    try {
        Set-Content -LiteralPath $temp -Value $Body -Encoding UTF8
        $output = & gh issue comment $Issue --repo $script:GuardentraExpectedCheckpointRepo --body-file $temp 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warning (Protect-GuardentraObserverText ($output | Out-String))
            return $false
        }
        return $true
    } finally {
        Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    }
}

function Publish-GuardentraLocalCheckpoints {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string[]]$StateRoots,
        [scriptblock]$Publisher = $null
    )

    if (-not $Publisher) {
        $Publisher = (Get-Item Function:\Invoke-GuardentraDefaultCheckpointPublisher).ScriptBlock
    }

    $published = 0
    foreach ($stateRoot in $StateRoots | Select-Object -Unique) {
        if (-not (Test-Path -LiteralPath $stateRoot)) { continue }

        foreach ($dir in Get-ChildItem -LiteralPath $stateRoot -Directory -ErrorAction SilentlyContinue) {
            if ($dir.Name -notmatch '^[1-9][0-9]*$') { continue }

            $checkpoint = Get-GuardentraLocalCompletionCheckpoint -IssueDir $dir.FullName
            if (-not $checkpoint -or $checkpoint.issue -le 0) { continue }

            # observed_utc changes every scan and is deliberately excluded from
            # the idempotency digest. Every other field represents checkpoint state.
            $digestSource = [ordered]@{}
            foreach ($key in $checkpoint.Keys) {
                if ($key -ne 'observed_utc') { $digestSource[$key] = $checkpoint[$key] }
            }
            $digest = Get-GuardentraCheckpointHash ($digestSource | ConvertTo-Json -Depth 8 -Compress)

            $ledger = Join-Path $dir.FullName 'checkpoint-published.json'
            $prior = ''
            if (Test-Path -LiteralPath $ledger) {
                try {
                    $prior = [string]((Get-Content -LiteralPath $ledger -Raw -Encoding UTF8 | ConvertFrom-Json).digest)
                } catch {
                    $prior = ''
                }
            }
            if ($prior -ceq $digest) { continue }

            $body = New-GuardentraCheckpointComment $checkpoint
            $ok = & $Publisher ([int]$checkpoint.issue) $body

            # Only a confirmed publish writes the local dedupe ledger. Failed or
            # unavailable GitHub publication is retried on the next runner cycle.
            if ($ok -eq $true) {
                [ordered]@{
                    schema = 'guardentra.checkpoint_publish.v1'
                    digest = $digest
                    published_utc = [datetime]::UtcNow.ToString('o')
                } | ConvertTo-Json -Compress | Set-Content -LiteralPath $ledger -Encoding UTF8
                $published++
            }
        }
    }

    return $published
}

function Get-GuardentraRunnerStateRoots {
    param([string]$RepositoryRoot)

    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) { throw 'REFUSED: git unavailable for registered worktree discovery' }

    $raw = & git -C $RepositoryRoot -c core.quotepath=false worktree list --porcelain 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'REFUSED: registered worktree inventory unavailable' }

    $roots = @(
        $raw |
            Where-Object { $_ -is [string] -and $_.StartsWith('worktree ') } |
            ForEach-Object { $_.Substring(9) }
    )

    return @(
        $roots |
            ForEach-Object { Join-Path $_ 'scripts\guardentra\state\issues' }
    )
}

function Invoke-GuardentraPersistentRunner {
    [CmdletBinding()]
    param(
        [ValidateRange(5, 3600)][int]$IntervalSeconds = 30,
        [switch]$Once,
        [switch]$PublishCheckpoints
    )

    $scriptsRoot = Split-Path $PSScriptRoot -Parent
    $repoRoot = Split-Path $scriptsRoot -Parent
    $dispatcher = Join-Path $scriptsRoot 'guardentra.ps1'
    $powershell = Join-Path $PSHOME 'powershell.exe'

    if (-not (Test-Path -LiteralPath $dispatcher)) { throw 'REFUSED: GuardEntra dispatcher unavailable' }
    if (-not (Test-Path -LiteralPath $powershell)) { throw 'REFUSED: Windows PowerShell executable unavailable' }

    do {
        Write-Host ('GuardEntra local runner cycle UTC ' + [datetime]::UtcNow.ToString('o')) -ForegroundColor Cyan

        # Use the existing public night-run command. The runner creates no new
        # authority path and cannot bypass task leases or Owner gates.
        & $powershell -NoProfile -ExecutionPolicy Bypass -File $dispatcher night-run -Passes 1 -IntervalSeconds 0
        $nightExit = $LASTEXITCODE
        if ($nightExit -ne 0) {
            Write-Warning "GuardEntra night-run cycle exited $nightExit; continuing after bounded interval."
        }

        if ($PublishCheckpoints) {
            try {
                $roots = Get-GuardentraRunnerStateRoots -RepositoryRoot $repoRoot
                $count = Publish-GuardentraLocalCheckpoints -StateRoots $roots
                Write-Host "Published local completion checkpoints: $count"
            } catch {
                Write-Warning ('Checkpoint publication deferred: ' + (Protect-GuardentraObserverText $_.Exception.Message))
            }
        }

        if ($Once) { break }
        Start-Sleep -Seconds $IntervalSeconds
    } while ($true)
}

if ($MyInvocation.InvocationName -ne '.') {
    Invoke-GuardentraPersistentRunner -IntervalSeconds $IntervalSeconds -Once:$Once -PublishCheckpoints:(-not $NoPublish)
}
