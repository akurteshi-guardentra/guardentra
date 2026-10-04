Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Run-LocalSupervisor.ps1'
. $scriptPath

$passes = 0
$failures = 0
$script:runnerPublished = New-Object 'System.Collections.Generic.List[object]'

function Assert-Runner {
    param([bool]$Condition, [string]$Name)
    if ($Condition) {
        $script:passes++
        Write-Host "PASS $Name"
    } else {
        $script:failures++
        Write-Host "FAIL $Name" -ForegroundColor Red
    }
}

function Write-RunnerSupervisorState {
    param(
        [string]$IssueDir,
        [int]$Issue,
        [string]$Phase = 'owner_gate',
        [string]$OwnerGate = 'commit'
    )
    @{
        schema = 'guardentra.supervisor.v1'
        issue = $Issue
        task_hash = 'fixture'
        phase = $Phase
        provider = 'codex'
        reviewer = 'grok'
        verification = 'TESTED_LOCAL'
        snapshot = @{
            branch = "tooling/fixture-$Issue"
            head = '0123456789abcdef0123456789abcdef01234567'
            digest = 'fixture'
            paths = @('scripts/guardentra/example.txt')
        }
        tests = @('fixture test PASS','git diff --check exit=0')
        attempts = @(@{ provider='codex'; state='available' })
        handoffs = @()
        blocker = 'token=supersecret blocked detail'
        owner_gate = $OwnerGate
        worker_pid = 0
        worker_started = ''
        heartbeat_utc = [datetime]::UtcNow.ToString('o')
        worker_tail = 'stderr: api_key=tailsecret must never publish'
        updated_utc = [datetime]::UtcNow.ToString('o')
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $IssueDir 'supervisor.json') -Encoding UTF8
}

$root = Join-Path ([IO.Path]::GetTempPath()) ('guardentra-runner-tests-' + [guid]::NewGuid().ToString('n'))
try {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    $issue90 = Join-Path $root '90'
    New-Item -ItemType Directory -Path $issue90 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue90 -Issue 90

    $publisher = {
        param($Issue,$Body)
        [void]$script:runnerPublished.Add([pscustomobject]@{ issue=$Issue; body=$Body })
        return $true
    }

    $first = Publish-GuardentraLocalCheckpoints -StateRoots @($root) -Publisher $publisher
    Assert-Runner ($first -eq 1) 'first terminal checkpoint publishes exactly once'
    Assert-Runner ($script:runnerPublished.Count -eq 1 -and $script:runnerPublished[0].issue -eq 90) 'publisher receives exact issue'
    Assert-Runner ($script:runnerPublished[0].body -match '^GUARDENTRA_LOCAL_CHECKPOINT v1') 'checkpoint has machine-readable prefix'
    Assert-Runner ($script:runnerPublished[0].body -match '\[REDACTED\]') 'checkpoint redacts blocker secret'
    Assert-Runner ($script:runnerPublished[0].body -notmatch 'supersecret') 'checkpoint does not expose blocker secret value'
    Assert-Runner ($script:runnerPublished[0].body -notmatch 'tailsecret') 'checkpoint never exposes provider tail secret'
    Assert-Runner ($script:runnerPublished[0].body -notmatch 'worker_tail') 'checkpoint schema excludes provider tail entirely'
    Assert-Runner ((Test-Path -LiteralPath (Join-Path $issue90 'checkpoint-published.json'))) 'successful publish writes local dedupe ledger'

    $second = Publish-GuardentraLocalCheckpoints -StateRoots @($root) -Publisher $publisher
    Assert-Runner ($second -eq 0 -and $script:runnerPublished.Count -eq 1) 'identical checkpoint is idempotent despite new observed timestamp'

    Write-RunnerSupervisorState -IssueDir $issue90 -Issue 90 -OwnerGate 'push-and-pr'
    $changed = Publish-GuardentraLocalCheckpoints -StateRoots @($root) -Publisher $publisher
    Assert-Runner ($changed -eq 1 -and $script:runnerPublished.Count -eq 2) 'meaningful terminal checkpoint change publishes again'

    # A failed publication must not poison the dedupe ledger.
    $issue91 = Join-Path $root '91'
    New-Item -ItemType Directory -Path $issue91 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue91 -Issue 91
    $rejectPublisher = { param($Issue,$Body); return $false }
    $failed = Publish-GuardentraLocalCheckpoints -StateRoots @($root) -Publisher $rejectPublisher
    Assert-Runner ($failed -eq 0) 'failed publisher reports no successful checkpoints'
    Assert-Runner (-not (Test-Path -LiteralPath (Join-Path $issue91 'checkpoint-published.json'))) 'failed publish writes no dedupe ledger'

    $retried = Publish-GuardentraLocalCheckpoints -StateRoots @($root) -Publisher $publisher
    Assert-Runner ($retried -eq 1 -and $script:runnerPublished[-1].issue -eq 91) 'failed checkpoint retries on later successful publication'

    # Nonterminal work is never published.
    $issue92 = Join-Path $root '92'
    New-Item -ItemType Directory -Path $issue92 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue92 -Issue 92 -Phase 'running' -OwnerGate ''
    $before = $script:runnerPublished.Count
    $running = Publish-GuardentraLocalCheckpoints -StateRoots @($root) -Publisher $publisher
    Assert-Runner ($running -eq 0 -and $script:runnerPublished.Count -eq $before) 'running phase is not published as completion'

    # Malformed state is ignored, never interpreted as authority or completion.
    $issue93 = Join-Path $root '93'
    New-Item -ItemType Directory -Path $issue93 -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $issue93 'supervisor.json') -Value '{bad-json' -Encoding UTF8
    $malformed = Publish-GuardentraLocalCheckpoints -StateRoots @($root) -Publisher $publisher
    Assert-Runner ($malformed -eq 0) 'malformed supervisor state is ignored safely'

    $comment = New-GuardentraCheckpointComment (Get-GuardentraLocalCompletionCheckpoint -IssueDir $issue90)
    Assert-Runner ($comment.Length -lt 4096) 'checkpoint body remains bounded'
}
finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Runner tests: $passes PASS / $failures FAIL"
if ($failures -gt 0) { exit 1 }
