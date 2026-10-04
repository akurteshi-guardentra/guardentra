Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Observe-LocalAgents.ps1'
. $scriptPath

$passes = 0
$failures = 0

function Assert-Observer {
    param([bool]$Condition, [string]$Name)
    if ($Condition) {
        $script:passes++
        Write-Host "PASS $Name"
    } else {
        $script:failures++
        Write-Host "FAIL $Name" -ForegroundColor Red
    }
}

$root = Join-Path ([IO.Path]::GetTempPath()) ('guardentra-observer-tests-' + [guid]::NewGuid().ToString('n'))
try {
    New-Item -ItemType Directory -Path $root -Force | Out-Null

    $issue90 = Join-Path $root '90'
    $issue67 = Join-Path $root '67'
    $issue99 = Join-Path $root '99'
    New-Item -ItemType Directory -Path $issue90,$issue67,$issue99 -Force | Out-Null

    $heartbeat = [datetime]::UtcNow.AddSeconds(-3).ToString('o')
    @{
        issue = 90
        phase = 'implementing'
        provider = 'codex'
        reviewer = 'grok'
        worker_pid = 18432
        heartbeat_utc = $heartbeat
        verification = 'TESTED_LOCAL'
        attempts = @(@{ state='available' }, @{ state='available' })
        handoffs = @(@{ from='cursor'; to='codex' })
        branch = 'tooling/autonomous-supervisor-90'
        blocker = 'token=supersecret provider retry'
        owner_gate = ''
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $issue90 'supervisor_state.json') -Encoding UTF8

    @{
        issue = 67
        writer = 'cursor'
        state = 'auth_required'
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $issue67 'agent_state.json') -Encoding UTF8

    Set-Content -LiteralPath (Join-Path $issue99 'agent_state.json') -Value '{not-json' -Encoding UTF8

    $rows = @(Get-GuardentraObserverRows -StateRoot $root)
    Assert-Observer ($rows.Count -eq 3) 'reads supervisor, legacy agent, and malformed rows without crashing'

    $supervisor = $rows | Where-Object { $_.issue -eq 90 }
    Assert-Observer ($supervisor.provider -eq 'codex') 'shows provider'
    Assert-Observer ($supervisor.reviewer -eq 'grok') 'shows reviewer'
    Assert-Observer ($supervisor.pid -eq 18432) 'shows worker pid'
    Assert-Observer ($supervisor.attempts -eq 2) 'counts attempts'
    Assert-Observer ($supervisor.handoffs -eq 1) 'counts handoffs'
    Assert-Observer ($supervisor.heartbeat_age_s -ge 0) 'computes heartbeat age'
    Assert-Observer ($supervisor.blocker -match '\[REDACTED\]') 'redacts secret-like blocker values'
    Assert-Observer ($supervisor.blocker -notmatch 'supersecret') 'does not emit secret-like value'

    $legacy = $rows | Where-Object { $_.issue -eq 67 }
    Assert-Observer ($legacy.provider -eq 'cursor') 'reads legacy writer'
    Assert-Observer ($legacy.phase -eq 'auth_required') 'reads legacy state'

    $invalid = $rows | Where-Object { $_.issue -eq 99 }
    Assert-Observer ($invalid.phase -eq 'INVALID_STATE') 'malformed state is isolated to invalid row'

    $issueFilter = @(Get-GuardentraObserverRows -StateRoot $root -Issue 90)
    Assert-Observer ($issueFilter.Count -eq 1 -and $issueFilter[0].issue -eq 90) 'issue filter is exact'

    $providerFilter = @(Get-GuardentraObserverRows -StateRoot $root -Provider 'codex')
    Assert-Observer ($providerFilter.Count -eq 1 -and $providerFilter[0].issue -eq 90) 'provider filter is exact'

    $emptyRoot = Join-Path $root 'missing'
    $empty = @(Get-GuardentraObserverRows -StateRoot $emptyRoot)
    Assert-Observer ($empty.Count -eq 0) 'missing state root returns empty result'
}
finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Observer tests: $passes PASS / $failures FAIL"
if ($failures -gt 0) { exit 1 }
