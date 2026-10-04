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
    if (-not (Test-Path -LiteralPath $supervisor)) { return $null }

    try {
        $state = Get-Content -LiteralPath $supervisor -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        return $null
    }

    $phase = [string](Get-GuardentraObserverProperty $state 'phase')
    if ($phase -notin @('owner_gate','blocked')) { return $null }

    $snapshot = Get-GuardentraObserverProperty $state 'snapshot' $null
    return [ordered]@{
        schema = 'guardentra.local_checkpoint.v1'
        issue = [int](Get-GuardentraObserverProperty $state 'issue' 0)
        phase = (Protect-GuardentraObserverText $phase)
        provider = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'provider'))
        reviewer = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'reviewer'))
        branch = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $snapshot 'branch'))
        head = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $snapshot 'head'))
        verification = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'verification' 'MISSING'))
        test_count = @(Get-GuardentraObserverProperty $state 'tests' @()).Count
        attempt_count = @(Get-GuardentraObserverProperty $state 'attempts' @()).Count
        handoff_count = @(Get-GuardentraObserverProperty $state 'handoffs' @()).Count
        blocker = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'blocker'))
        owner_gate = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $state 'owner_gate'))
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
