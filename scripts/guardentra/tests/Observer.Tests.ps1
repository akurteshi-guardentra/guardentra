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
    $issue95 = Join-Path $root '95'
    $issue99 = Join-Path $root '99'
    New-Item -ItemType Directory -Path $issue90,$issue67,$issue95,$issue99 -Force | Out-Null

    $process = Get-Process -Id $PID
    $heartbeat = [datetime]::UtcNow.AddSeconds(-3).ToString('o')
    $head = '0123456789abcdef0123456789abcdef01234567'
    $worktree = 'C:\Users\Admin\repos\guardentra-codex-90'

    @{
        schema = 'guardentra.supervisor.v1'
        issue = 90
        task_hash = 'fixture'
        phase = 'running'
        provider = 'codex'
        reviewer = 'grok'
        verification = 'TESTED_LOCAL'
        snapshot = @{
            branch = 'tooling/autonomous-supervisor-90'
            head = $head
            paths = @('scripts/guardentra/example.txt')
        }
        tests = @('fixture PASS')
        attempts = @(@{ state='available' }, @{ state='available' })
        handoffs = @(@{ from='cursor'; to='codex' })
        blocker = 'token=supersecret provider retry'
        owner_gate = ''
        worker_pid = $PID
        worker_started = $process.StartTime.ToUniversalTime().ToString('o')
        heartbeat_utc = $heartbeat
        worker_tail = 'stderr: api_key=tailsecret provider message'
        updated_utc = [datetime]::UtcNow.ToString('o')
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $issue90 'supervisor.json') -Encoding UTF8

    @{
        worktree_path = $worktree
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $issue90 'contract.json') -Encoding UTF8

    # Legacy #95 supervisor filename remains readable during workstation upgrade.
    @{
        issue = 95
        phase = 'owner_gate'
        provider = 'gemini'
        reviewer = 'cloud'
        worker_pid = 0
        heartbeat_utc = [datetime]::UtcNow.AddSeconds(-30).ToString('o')
        verification = 'IMPLEMENTED_LOCAL'
        attempts = @()
        handoffs = @()
        branch = 'legacy/observer'
        blocker = ''
        owner_gate = 'auth required'
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $issue95 'supervisor_state.json') -Encoding UTF8

    @{
        issue = 67
        writer = 'cursor'
        state = 'auth_required'
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $issue67 'agent_state.json') -Encoding UTF8

    Set-Content -LiteralPath (Join-Path $issue99 'agent_state.json') -Value '{not-json' -Encoding UTF8

    $rows = @(Get-GuardentraObserverRows -StateRoot $root)
    Assert-Observer ($rows.Count -eq 4) 'reads live supervisor, legacy supervisor, agent, and malformed rows without crashing'

    $supervisor = $rows | Where-Object { $_.issue -eq 90 }
    Assert-Observer ($supervisor.source -eq 'supervisor') 'prefers live supervisor source'
    Assert-Observer ($supervisor.path -like '*supervisor.json') 'prefers #90 supervisor.json filename'
    Assert-Observer ($supervisor.provider -eq 'codex') 'shows provider'
    Assert-Observer ($supervisor.reviewer -eq 'grok') 'shows reviewer'
    Assert-Observer ($supervisor.pid -eq $PID) 'shows exact worker pid'
    Assert-Observer ($supervisor.pid_state -eq 'alive') 'validates exact live pid and start time'
    Assert-Observer ($supervisor.worker_started -eq $process.StartTime.ToUniversalTime().ToString('o')) 'shows worker start timestamp'
    Assert-Observer ($supervisor.heartbeat_utc -eq $heartbeat) 'shows raw heartbeat timestamp'
    Assert-Observer ($supervisor.test_count -eq 1) 'counts supervisor tests'
    Assert-Observer ($supervisor.last_test -eq 'fixture PASS') 'shows last bounded supervisor test'
    Assert-Observer ($supervisor.attempts -eq 2) 'counts attempts'
    Assert-Observer ($supervisor.handoffs -eq 1) 'counts handoffs'
    Assert-Observer ($supervisor.heartbeat_age_s -ge 0) 'computes heartbeat age'
    Assert-Observer ($supervisor.heartbeat_state -eq 'fresh') 'classifies recent heartbeat as fresh'
    Assert-Observer ($supervisor.branch -eq 'tooling/autonomous-supervisor-90') 'reads nested snapshot branch'
    Assert-Observer ($supervisor.head -eq $head) 'reads nested snapshot head'
    Assert-Observer ($supervisor.worktree -eq $worktree) 'reads worktree from contract'
    Assert-Observer ($supervisor.blocker -match '\[REDACTED\]') 'redacts secret-like blocker values'
    Assert-Observer ($supervisor.blocker -notmatch 'supersecret') 'does not emit blocker secret value'
    Assert-Observer ($supervisor.tail -match '\[REDACTED\]') 'redacts provider telemetry tail'
    Assert-Observer ($supervisor.tail -notmatch 'tailsecret') 'does not emit provider tail secret value'

    $legacySupervisor = $rows | Where-Object { $_.issue -eq 95 }
    Assert-Observer ($legacySupervisor.provider -eq 'gemini') 'reads legacy supervisor provider'
    Assert-Observer ($legacySupervisor.heartbeat_state -eq 'stale') 'classifies old heartbeat as stale'

    $legacyAgent = $rows | Where-Object { $_.issue -eq 67 }
    Assert-Observer ($legacyAgent.provider -eq 'cursor') 'reads legacy agent writer'
    Assert-Observer ($legacyAgent.phase -eq 'auth_required') 'reads legacy agent state'

    $invalid = $rows | Where-Object { $_.issue -eq 99 }
    Assert-Observer ($invalid.phase -eq 'INVALID_STATE') 'malformed state is isolated to invalid row'

    $issueFilter = @(Get-GuardentraObserverRows -StateRoot $root -Issue 90)
    Assert-Observer ($issueFilter.Count -eq 1 -and $issueFilter[0].issue -eq 90) 'issue filter is exact'

    $providerFilter = @(Get-GuardentraObserverRows -StateRoot $root -Provider 'codex')
    Assert-Observer ($providerFilter.Count -eq 1 -and $providerFilter[0].issue -eq 90) 'single provider filter is exact'

    $providerAliasFilter = @(Get-GuardentraObserverRows -StateRoot $root -Provider 'gemini,cloud')
    Assert-Observer ($providerAliasFilter.Count -eq 1 -and $providerAliasFilter[0].issue -eq 95) 'comma-separated provider filter supports provider families'

    $emptyRoot = Join-Path $root 'missing'
    $empty = @(Get-GuardentraObserverRows -StateRoot $emptyRoot)
    Assert-Observer ($empty.Count -eq 0) 'missing state root returns empty result'
}
finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Observer tests: $passes PASS / $failures FAIL"
if ($failures -gt 0) { exit 1 }
