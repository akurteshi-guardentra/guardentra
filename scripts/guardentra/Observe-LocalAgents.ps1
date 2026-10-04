[CmdletBinding()]
param(
    [string]$StateRoot = (Join-Path $PSScriptRoot 'state\issues'),
    [ValidateRange(1, 60)][int]$RefreshSeconds = 2,
    [int]$Issue = 0,
    [string]$Provider = '',
    [switch]$Once
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Get-GuardentraObserverProperty {
    param($Object, [string]$Name, $Default = '')
    if ($null -eq $Object) { return $Default }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property -or $null -eq $property.Value) { return $Default }
    return $property.Value
}

function Protect-GuardentraObserverText {
    param([object]$Value)
    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) { return '' }

    $text = [regex]::Replace(
        $text,
        '(?i)\b(authorization)\s*:\s*bearer\s+[^\s,;]+',
        '$1: Bearer [REDACTED]'
    )
    $text = [regex]::Replace(
        $text,
        '(?i)\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password)\s*[:=]\s*[^\s,;}"'']+',
        '$1=[REDACTED]'
    )
    $text = [regex]::Replace($text, 'AIza[0-9A-Za-z_-]{20,}', '[REDACTED_GOOGLE_KEY]')
    $text = [regex]::Replace($text, '\bsk-[A-Za-z0-9_-]{10,}\b', '[REDACTED_KEY]')

    if ($text.Length -gt 2048) { $text = $text.Substring($text.Length - 2048) }
    return $text
}

function Get-GuardentraHeartbeatAgeSeconds {
    param([object]$HeartbeatUtc)
    $value = [string]$HeartbeatUtc
    if ([string]::IsNullOrWhiteSpace($value)) { return $null }

    $parsed = [datetime]::MinValue
    if (-not [datetime]::TryParse(
        $value,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AssumeUniversal,
        [ref]$parsed
    )) { return $null }

    $age = [math]::Floor(([datetime]::UtcNow - $parsed.ToUniversalTime()).TotalSeconds)
    if ($age -lt 0) { return 0 }
    return [int]$age
}

function Get-GuardentraObserverPidState {
    param([int]$WorkerPid, [string]$WorkerStarted = '')
    if ($WorkerPid -le 0) { return 'idle' }
    try {
        $process = Get-Process -Id $WorkerPid -ErrorAction Stop
        if ($WorkerStarted) {
            $birth = $process.StartTime.ToUniversalTime().ToString('o')
            if ($birth -cne $WorkerStarted) { return 'pid_reused' }
        }
        return 'alive'
    } catch {
        return 'not_running'
    }
}

function Get-GuardentraObserverContract {
    param([string]$IssueDir)
    $path = Join-Path $IssueDir 'contract.json'
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    try {
        return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function ConvertTo-GuardentraObserverRow {
    param(
        [Parameter(Mandatory)]$State,
        [Parameter(Mandatory)][int]$IssueNumber,
        [Parameter(Mandatory)][ValidateSet('supervisor','agent','invalid')][string]$Source,
        [string]$Path = '',
        $Contract = $null
    )

    if ($Source -eq 'invalid') {
        return [pscustomobject][ordered]@{
            issue = $IssueNumber
            provider = ''
            reviewer = ''
            phase = 'INVALID_STATE'
            pid = 0
            pid_state = 'invalid'
            heartbeat_age_s = $null
            heartbeat_state = 'unknown'
            verification = 'UNVERIFIED'
            correction_count = 0
            attempts = 0
            handoffs = 0
            exit_state = ''
            branch = ''
            head = ''
            worktree = ''
            blocker = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'message' 'malformed state file'))
            owner_gate = ''
            tail = ''
            source = 'invalid'
            path = $Path
        }
    }

    $provider = if ($Source -eq 'supervisor') {
        Get-GuardentraObserverProperty $State 'provider'
    } else {
        $candidate = Get-GuardentraObserverProperty $State 'writer'
        if ([string]::IsNullOrWhiteSpace([string]$candidate)) {
            $candidate = Get-GuardentraObserverProperty $State 'writer_tool'
        }
        $candidate
    }

    $phase = if ($Source -eq 'supervisor') {
        Get-GuardentraObserverProperty $State 'phase' 'unknown'
    } else {
        Get-GuardentraObserverProperty $State 'state' 'unknown'
    }

    $snapshot = Get-GuardentraObserverProperty $State 'snapshot' $null
    $branch = Get-GuardentraObserverProperty $State 'branch'
    if ([string]::IsNullOrWhiteSpace([string]$branch)) {
        $branch = Get-GuardentraObserverProperty $snapshot 'branch'
    }
    $head = Get-GuardentraObserverProperty $snapshot 'head'

    $worktree = Get-GuardentraObserverProperty $State 'worktree'
    if ([string]::IsNullOrWhiteSpace([string]$worktree) -and $Contract) {
        $worktree = Get-GuardentraObserverProperty $Contract 'worktree_path'
        if ([string]::IsNullOrWhiteSpace([string]$worktree)) {
            $worktree = Get-GuardentraObserverProperty $Contract 'isolated_worktree_path'
        }
    }

    $workerPid = [int](Get-GuardentraObserverProperty $State 'worker_pid' 0)
    $workerStarted = [string](Get-GuardentraObserverProperty $State 'worker_started')
    $heartbeatUtc = [string](Get-GuardentraObserverProperty $State 'heartbeat_utc')
    $heartbeatAge = Get-GuardentraHeartbeatAgeSeconds $heartbeatUtc
    $tests = @(Get-GuardentraObserverProperty $State 'tests' @())
    $lastTest = if ($tests.Count -gt 0) { Protect-GuardentraObserverText $tests[$tests.Count - 1] } else { '' }
    $attemptEntries = @(Get-GuardentraObserverProperty $State 'attempts' @())
    $exitState = if ($attemptEntries.Count -gt 0) {
        Protect-GuardentraObserverText (Get-GuardentraObserverProperty $attemptEntries[$attemptEntries.Count - 1] 'state')
    } else { '' }
    $correctionCount = if ($Contract) { [int](Get-GuardentraObserverProperty $Contract 'attempt_count' 0) } else { 0 }
    $heartbeatState = if ($null -eq $heartbeatAge) {
        'unknown'
    } elseif ($heartbeatAge -le 15) {
        'fresh'
    } else {
        'stale'
    }

    return [pscustomobject][ordered]@{
        issue = $IssueNumber
        provider = (Protect-GuardentraObserverText $provider)
        reviewer = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'reviewer'))
        phase = (Protect-GuardentraObserverText $phase)
        pid = $workerPid
        pid_state = (Get-GuardentraObserverPidState -WorkerPid $workerPid -WorkerStarted $workerStarted)
        worker_started = (Protect-GuardentraObserverText $workerStarted)
        heartbeat_utc = (Protect-GuardentraObserverText $heartbeatUtc)
        heartbeat_age_s = $heartbeatAge
        heartbeat_state = $heartbeatState
        test_count = $tests.Count
        last_test = $lastTest
        verification = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'verification' 'UNVERIFIED'))
        correction_count = $correctionCount
        attempts = $attemptEntries.Count
        handoffs = @(Get-GuardentraObserverProperty $State 'handoffs' @()).Count
        exit_state = $exitState
        branch = (Protect-GuardentraObserverText $branch)
        head = (Protect-GuardentraObserverText $head)
        worktree = (Protect-GuardentraObserverText $worktree)
        blocker = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'blocker'))
        owner_gate = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'owner_gate'))
        tail = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'worker_tail'))
        source = $Source
        path = $Path
    }
}

function Get-GuardentraObserverRows {
    [CmdletBinding()]
    param(
        [string]$StateRoot = (Join-Path $PSScriptRoot 'state\issues'),
        [int]$Issue = 0,
        [string]$Provider = ''
    )

    $rows = New-Object System.Collections.Generic.List[object]
    if (-not (Test-Path -LiteralPath $StateRoot)) { return @() }

    $providerSet = @(
        $Provider -split ',' |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    foreach ($dir in (Get-ChildItem -LiteralPath $StateRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name)) {
        if ($dir.Name -notmatch '^[1-9][0-9]*$') { continue }
        $issueNumber = [int]$dir.Name
        if ($Issue -gt 0 -and $issueNumber -ne $Issue) { continue }

        # #90 writes supervisor.json. #95's supervisor_state.json remains a
        # compatibility fallback for older workstation state.
        $supervisorPath = Join-Path $dir.FullName 'supervisor.json'
        $legacySupervisorPath = Join-Path $dir.FullName 'supervisor_state.json'
        $agentPath = Join-Path $dir.FullName 'agent_state.json'
        $source = ''
        $path = ''

        if (Test-Path -LiteralPath $supervisorPath) {
            $source = 'supervisor'
            $path = $supervisorPath
        } elseif (Test-Path -LiteralPath $legacySupervisorPath) {
            $source = 'supervisor'
            $path = $legacySupervisorPath
        } elseif (Test-Path -LiteralPath $agentPath) {
            $source = 'agent'
            $path = $agentPath
        } else {
            continue
        }

        try {
            $state = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
            $contract = Get-GuardentraObserverContract $dir.FullName
            $row = ConvertTo-GuardentraObserverRow -State $state -IssueNumber $issueNumber -Source $source -Path $path -Contract $contract
        } catch {
            $safe = [pscustomobject]@{ message = 'malformed or unreadable state file' }
            $row = ConvertTo-GuardentraObserverRow -State $safe -IssueNumber $issueNumber -Source 'invalid' -Path $path
        }

        if ($providerSet.Count -gt 0 -and $providerSet -cnotcontains [string]$row.provider) { continue }
        [void]$rows.Add($row)
    }

    return @($rows.ToArray())
}

function Show-GuardentraObserver {
    [CmdletBinding()]
    param(
        [string]$StateRoot = (Join-Path $PSScriptRoot 'state\issues'),
        [ValidateRange(1, 60)][int]$RefreshSeconds = 2,
        [int]$Issue = 0,
        [string]$Provider = '',
        [switch]$Once
    )

    do {
        $rows = @(Get-GuardentraObserverRows -StateRoot $StateRoot -Issue $Issue -Provider $Provider)

        if (-not $Once) { Clear-Host }
        Write-Host 'GuardEntra Local Agent Observer (READ ONLY)' -ForegroundColor Cyan
        Write-Host ('UTC: ' + [datetime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss') + 'Z')
        Write-Host ('State root: ' + $StateRoot)
        Write-Host ''

        if ($rows.Count -eq 0) {
            Write-Host 'No persisted agent/supervisor state matched the filter.' -ForegroundColor DarkYellow
        } else {
            $rows |
                Select-Object issue,provider,reviewer,phase,pid,pid_state,worker_started,heartbeat_utc,heartbeat_age_s,heartbeat_state,test_count,last_test,verification,correction_count,attempts,handoffs,exit_state,branch,head,blocker,owner_gate |
                Format-Table -AutoSize -Wrap

            foreach ($row in $rows) {
                if (-not [string]::IsNullOrWhiteSpace([string]$row.tail)) {
                    Write-Host ''
                    Write-Host ("#$($row.issue) $($row.provider) redacted tail:") -ForegroundColor DarkCyan
                    Write-Host $row.tail
                }
            }
        }

        if ($Once) { break }
        Start-Sleep -Seconds $RefreshSeconds
    } while ($true)
}

if ($MyInvocation.InvocationName -ne '.') {
    Show-GuardentraObserver -StateRoot $StateRoot -RefreshSeconds $RefreshSeconds -Issue $Issue -Provider $Provider -Once:$Once
}
