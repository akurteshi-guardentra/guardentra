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
        '(?i)\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password)\s*[:=]\s*[^\s,;]+',
        '$1=[REDACTED]'
    )

    if ($text.Length -gt 180) { $text = $text.Substring(0, 177) + '...' }
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

function ConvertTo-GuardentraObserverRow {
    param(
        [Parameter(Mandatory)]$State,
        [Parameter(Mandatory)][int]$IssueNumber,
        [Parameter(Mandatory)][ValidateSet('supervisor','agent','invalid')][string]$Source,
        [string]$Path = ''
    )

    if ($Source -eq 'invalid') {
        return [pscustomobject][ordered]@{
            issue = $IssueNumber
            provider = ''
            reviewer = ''
            phase = 'INVALID_STATE'
            pid = 0
            heartbeat_age_s = $null
            verification = 'UNVERIFIED'
            attempts = 0
            handoffs = 0
            branch = ''
            worktree = ''
            blocker = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'message' 'malformed state file'))
            owner_gate = ''
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

    $attempts = @(Get-GuardentraObserverProperty $State 'attempts' @()).Count
    $handoffs = @(Get-GuardentraObserverProperty $State 'handoffs' @()).Count

    return [pscustomobject][ordered]@{
        issue = $IssueNumber
        provider = (Protect-GuardentraObserverText $provider)
        reviewer = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'reviewer'))
        phase = (Protect-GuardentraObserverText $phase)
        pid = [int](Get-GuardentraObserverProperty $State 'worker_pid' 0)
        heartbeat_age_s = Get-GuardentraHeartbeatAgeSeconds (Get-GuardentraObserverProperty $State 'heartbeat_utc')
        verification = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'verification' 'UNVERIFIED'))
        attempts = $attempts
        handoffs = $handoffs
        branch = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'branch'))
        worktree = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'worktree'))
        blocker = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'blocker'))
        owner_gate = (Protect-GuardentraObserverText (Get-GuardentraObserverProperty $State 'owner_gate'))
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

    foreach ($dir in (Get-ChildItem -LiteralPath $StateRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name)) {
        if ($dir.Name -notmatch '^[1-9][0-9]*$') { continue }
        $issueNumber = [int]$dir.Name
        if ($Issue -gt 0 -and $issueNumber -ne $Issue) { continue }

        $supervisorPath = Join-Path $dir.FullName 'supervisor_state.json'
        $agentPath = Join-Path $dir.FullName 'agent_state.json'
        $source = ''
        $path = ''

        if (Test-Path -LiteralPath $supervisorPath) {
            $source = 'supervisor'
            $path = $supervisorPath
        } elseif (Test-Path -LiteralPath $agentPath) {
            $source = 'agent'
            $path = $agentPath
        } else {
            continue
        }

        try {
            $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8
            $state = $raw | ConvertFrom-Json
            $row = ConvertTo-GuardentraObserverRow -State $state -IssueNumber $issueNumber -Source $source -Path $path
        } catch {
            $safe = [pscustomobject]@{ message = 'malformed or unreadable state file' }
            $row = ConvertTo-GuardentraObserverRow -State $safe -IssueNumber $issueNumber -Source 'invalid' -Path $path
        }

        if (-not [string]::IsNullOrWhiteSpace($Provider) -and [string]$row.provider -ne $Provider) { continue }
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
                Select-Object issue,provider,reviewer,phase,pid,heartbeat_age_s,verification,attempts,handoffs,branch,blocker,owner_gate |
                Format-Table -AutoSize -Wrap
        }

        if ($Once) { break }
        Start-Sleep -Seconds $RefreshSeconds
    } while ($true)
}

if ($MyInvocation.InvocationName -ne '.') {
    Show-GuardentraObserver -StateRoot $StateRoot -RefreshSeconds $RefreshSeconds -Issue $Issue -Provider $Provider -Once:$Once
}
