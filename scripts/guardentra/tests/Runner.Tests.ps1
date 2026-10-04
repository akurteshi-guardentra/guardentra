Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Run-LocalSupervisor.ps1'
. $scriptPath
$registrationPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Register-LocalRunnerTask.ps1'
. $registrationPath

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
        [string]$Worktree,
        [string]$Branch,
        [string]$Head,
        [string]$Phase = 'owner_gate',
        [string]$OwnerGate = 'commit',
        [int]$ContractIssue = 0,
        [string]$ContractBranch = '',
        [string]$ContractWorktree = ''
    )
    if ($ContractIssue -le 0) { $ContractIssue = $Issue }
    if ([string]::IsNullOrWhiteSpace($ContractBranch)) { $ContractBranch = $Branch }
    if ([string]::IsNullOrWhiteSpace($ContractWorktree)) { $ContractWorktree = $Worktree }
    @{
        schema = 'guardentra.supervisor.v1'
        issue = $Issue
        task_hash = 'fixture-task-hash'
        phase = $Phase
        provider = 'codex'
        reviewer = 'grok'
        verification = 'TESTED_LOCAL'
        snapshot = @{
            branch = $Branch
            head = $Head
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
        worker_tail = 'proposal body MUST_NOT_PUBLISH api_key=tailsecret'
        updated_utc = [datetime]::UtcNow.ToString('o')
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $IssueDir 'supervisor.json') -Encoding UTF8
    @{
        schema_version = '1'
        issue_number = $ContractIssue
        title = "fixture $ContractIssue"
        starting_main_sha = $Head
        feature_branch = $ContractBranch
        worktree_path = $ContractWorktree
        selected_writer_tool = 'codex'
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $IssueDir 'contract.json') -Encoding UTF8
}

$taskSpec = Get-GuardentraRunnerTaskSpec -IntervalSeconds 30
Assert-Runner ($taskSpec.task_name -eq 'GuardEntra Local Supervisor') 'startup task uses stable task name'
Assert-Runner ($taskSpec.run_level -eq 'Limited') 'startup task is limited privilege'
Assert-Runner ($taskSpec.logon_type -eq 'Interactive') 'startup task runs only in current interactive user context'
Assert-Runner (-not $taskSpec.stores_password) 'startup task stores no password'
Assert-Runner ($taskSpec.arguments -match 'Run-LocalSupervisor\.ps1' -and $taskSpec.arguments -match 'IntervalSeconds 30') 'startup task launches bounded persistent runner'

$root = Join-Path ([IO.Path]::GetTempPath()) ('guardentra-runner-tests-' + [guid]::NewGuid().ToString('n'))
try {
    $repo = Join-Path $root 'repo'
    New-Item -ItemType Directory -Path $repo -Force | Out-Null
    & git -C $repo init | Out-Null
    & git -C $repo config user.name 'GuardEntra Runner Fixture'
    & git -C $repo config user.email 'runner-fixture@guardentra.local'
    Set-Content -LiteralPath (Join-Path $repo 'fixture.txt') -Value 'fixture' -Encoding UTF8
    & git -C $repo add fixture.txt
    & git -C $repo commit -m 'fixture' | Out-Null
    & git -C $repo checkout -b tooling/runner-fixture | Out-Null
    $branch = (& git -C $repo rev-parse --abbrev-ref HEAD).Trim()
    $head = (& git -C $repo rev-parse HEAD).Trim()
    $stateRoot = Join-Path $repo 'scripts\guardentra\state\issues'
    $issue90 = Join-Path $stateRoot '90'
    New-Item -ItemType Directory -Path $issue90 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue90 -Issue 90 -Worktree $repo -Branch $branch -Head $head

    $fixtureState = Get-Content -LiteralPath (Join-Path $issue90 'supervisor.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $fixtureContract = Get-Content -LiteralPath (Join-Path $issue90 'contract.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $fixtureExpectedDir = [IO.Path]::GetFullPath((Join-Path (Join-Path ([IO.Path]::GetFullPath($repo)) 'scripts\guardentra\state\issues') '90')).TrimEnd('\')
    $fixtureActualDir = [IO.Path]::GetFullPath($issue90).TrimEnd('\')
    $fixtureGitBranch = (& git -C $repo rev-parse --abbrev-ref HEAD).Trim()
    $fixtureGitHead = (& git -C $repo rev-parse HEAD).Trim()
    Assert-Runner ([int]$fixtureState.issue -eq 90 -and [int]$fixtureContract.issue_number -eq 90) 'fixture binds state and contract to directory issue'
    Assert-Runner ([StringComparer]::OrdinalIgnoreCase.Equals($fixtureActualDir,$fixtureExpectedDir)) 'fixture issue path is inside registered worktree state root'
    Assert-Runner ([string]$fixtureState.snapshot.branch -ceq [string]$fixtureContract.feature_branch -and [string]$fixtureState.snapshot.branch -ceq $fixtureGitBranch) 'fixture branch matches state, contract and git'
    Assert-Runner ([string]$fixtureState.snapshot.head -ceq $fixtureGitHead) 'fixture head matches actual git head'
    Assert-Runner ([StringComparer]::OrdinalIgnoreCase.Equals([IO.Path]::GetFullPath([string]$fixtureContract.worktree_path).TrimEnd('\'),[IO.Path]::GetFullPath($repo).TrimEnd('\'))) 'fixture contract worktree matches actual worktree'

    $publisher = {
        param($Issue,$Body)
        [void]$script:runnerPublished.Add([pscustomobject]@{ issue=$Issue; body=$Body })
        return $true
    }

    $first = Publish-GuardentraLocalCheckpoints -StateRoots @($stateRoot) -Publisher $publisher
    Assert-Runner ($first -eq 1) 'first terminal checkpoint publishes exactly once'
    Assert-Runner ($script:runnerPublished.Count -eq 1 -and $script:runnerPublished[0].issue -eq 90) 'publisher receives exact issue'
    Assert-Runner ($script:runnerPublished[0].body -match '^GUARDENTRA_LOCAL_CHECKPOINT v1') 'checkpoint has machine-readable prefix'
    Assert-Runner ($script:runnerPublished[0].body -match '\[REDACTED\]') 'checkpoint redacts blocker secret'
    Assert-Runner ($script:runnerPublished[0].body -notmatch 'supersecret') 'checkpoint does not expose blocker secret value'
    Assert-Runner ($script:runnerPublished[0].body -notmatch 'tailsecret') 'checkpoint never exposes provider tail secret'
    Assert-Runner ($script:runnerPublished[0].body -notmatch 'worker_tail') 'checkpoint schema excludes provider tail entirely'
    Assert-Runner ((Test-Path -LiteralPath (Join-Path $issue90 'checkpoint-published.json'))) 'successful publish writes local dedupe ledger'

    $second = Publish-GuardentraLocalCheckpoints -StateRoots @($stateRoot) -Publisher $publisher
    Assert-Runner ($second -eq 0 -and $script:runnerPublished.Count -eq 1) 'identical checkpoint is idempotent despite new observed timestamp'

    Write-RunnerSupervisorState -IssueDir $issue90 -Issue 90 -Worktree $repo -Branch $branch -Head $head -OwnerGate 'push-and-pr'
    $changed = Publish-GuardentraLocalCheckpoints -StateRoots @($stateRoot) -Publisher $publisher
    Assert-Runner ($changed -eq 1 -and $script:runnerPublished.Count -eq 2) 'meaningful terminal checkpoint change publishes again'

    # A failed publication must not poison the dedupe ledger.
    $issue91 = Join-Path $stateRoot '91'
    New-Item -ItemType Directory -Path $issue91 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue91 -Issue 91 -Worktree $repo -Branch $branch -Head $head
    $rejectPublisher = { param($Issue,$Body); return $false }
    $failed = Publish-GuardentraLocalCheckpoints -StateRoots @($stateRoot) -Publisher $rejectPublisher
    Assert-Runner ($failed -eq 0) 'failed publisher reports no successful checkpoints'
    Assert-Runner (-not (Test-Path -LiteralPath (Join-Path $issue91 'checkpoint-published.json'))) 'failed publish writes no dedupe ledger'

    $retried = Publish-GuardentraLocalCheckpoints -StateRoots @($stateRoot) -Publisher $publisher
    Assert-Runner ($retried -eq 1 -and $script:runnerPublished[-1].issue -eq 91) 'failed checkpoint retries on later successful publication'

    # Nonterminal work is never published.
    $issue92 = Join-Path $stateRoot '92'
    New-Item -ItemType Directory -Path $issue92 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue92 -Issue 92 -Worktree $repo -Branch $branch -Head $head -Phase 'running' -OwnerGate ''
    $before = $script:runnerPublished.Count
    $running = Publish-GuardentraLocalCheckpoints -StateRoots @($stateRoot) -Publisher $publisher
    Assert-Runner ($running -eq 0 -and $script:runnerPublished.Count -eq $before) 'running phase is not published as completion'

    # Malformed state is ignored, never interpreted as authority or completion.
    $issue93 = Join-Path $stateRoot '93'
    New-Item -ItemType Directory -Path $issue93 -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $issue93 'supervisor.json') -Value '{bad-json' -Encoding UTF8
    $malformed = Publish-GuardentraLocalCheckpoints -StateRoots @($stateRoot) -Publisher $publisher
    Assert-Runner ($malformed -eq 0) 'malformed supervisor state is ignored safely'

    # Evidence binding fails closed for mismatched issue, stale SHA, branch, or worktree.
    $issue94 = Join-Path $stateRoot '94'
    New-Item -ItemType Directory -Path $issue94 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue94 -Issue 95 -Worktree $repo -Branch $branch -Head $head -ContractIssue 94
    Assert-Runner ($null -eq (Get-GuardentraLocalCompletionCheckpoint -IssueDir $issue94)) 'checkpoint refuses state issue mismatch'

    $issue95 = Join-Path $stateRoot '95'
    New-Item -ItemType Directory -Path $issue95 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue95 -Issue 95 -Worktree $repo -Branch $branch -Head ('0' * 40)
    Assert-Runner ($null -eq (Get-GuardentraLocalCompletionCheckpoint -IssueDir $issue95)) 'checkpoint refuses stale or mismatched head'

    $issue96 = Join-Path $stateRoot '96'
    New-Item -ItemType Directory -Path $issue96 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue96 -Issue 96 -Worktree $repo -Branch 'tooling/wrong-branch' -Head $head -ContractBranch 'tooling/wrong-branch'
    Assert-Runner ($null -eq (Get-GuardentraLocalCompletionCheckpoint -IssueDir $issue96)) 'checkpoint refuses non-current branch'

    $issue97 = Join-Path $stateRoot '97'
    New-Item -ItemType Directory -Path $issue97 -Force | Out-Null
    Write-RunnerSupervisorState -IssueDir $issue97 -Issue 97 -Worktree $repo -Branch $branch -Head $head -ContractWorktree (Join-Path $root 'wrong-worktree')
    Assert-Runner ($null -eq (Get-GuardentraLocalCompletionCheckpoint -IssueDir $issue97)) 'checkpoint refuses wrong registered worktree'

    $forgedState = Get-Content -LiteralPath (Join-Path $issue90 'supervisor.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $forgedState.verification = 'PRODUCTION_LIVE_VERIFIED'
    $forgedState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $issue90 'supervisor.json') -Encoding UTF8
    Assert-Runner ($null -eq (Get-GuardentraLocalCompletionCheckpoint -IssueDir $issue90)) 'checkpoint refuses forged production verification'
    Write-RunnerSupervisorState -IssueDir $issue90 -Issue 90 -Worktree $repo -Branch $branch -Head $head -OwnerGate 'push-and-pr'

    $forgedState = Get-Content -LiteralPath (Join-Path $issue90 'supervisor.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $forgedState.schema = 'forged.supervisor.v9'
    $forgedState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $issue90 'supervisor.json') -Encoding UTF8
    Assert-Runner ($null -eq (Get-GuardentraLocalCompletionCheckpoint -IssueDir $issue90)) 'checkpoint refuses invalid supervisor schema'
    Write-RunnerSupervisorState -IssueDir $issue90 -Issue 90 -Worktree $repo -Branch $branch -Head $head -OwnerGate 'push-and-pr'

    $forgedState = Get-Content -LiteralPath (Join-Path $issue90 'supervisor.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $forgedState.task_hash = ''
    $forgedState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $issue90 'supervisor.json') -Encoding UTF8
    Assert-Runner ($null -eq (Get-GuardentraLocalCompletionCheckpoint -IssueDir $issue90)) 'checkpoint refuses missing task identity'
    Write-RunnerSupervisorState -IssueDir $issue90 -Issue 90 -Worktree $repo -Branch $branch -Head $head -OwnerGate 'push-and-pr'

    $bound = Get-GuardentraLocalCompletionCheckpoint -IssueDir $issue90
    Assert-Runner ($bound.source -eq 'owner_local_supervisor+contract+git' -and $bound.head -eq $head -and $bound.branch -eq $branch) 'checkpoint records exact bound local provenance'
    $comment = New-GuardentraCheckpointComment $bound
    Assert-Runner ($comment.Length -lt 4096) 'checkpoint body remains bounded'
}
finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Runner tests: $passes PASS / $failures FAIL"
if ($failures -gt 0) { exit 1 }
