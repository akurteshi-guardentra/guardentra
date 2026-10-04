# Dot-sourced by Run-Tests.ps1; real Git/process fixtures, synthetic provider responses.
Write-Host '=== GuardEntra #90 supervisor tests ==='
$supervisorOldRoot=$script:GuardentraRoot
$supervisorOldState=$script:GuardentraStateRoot
$supervisorAdapter=(Get-Item Function:Invoke-GuardentraProposalAdapter).ScriptBlock
$supervisorBase=Join-Path ([IO.Path]::GetTempPath()) ('guardentra-supervisor-' + [guid]::NewGuid().ToString('n'))
$supervisorRepo=Join-Path $supervisorBase 'guardentra-codex-990'
$supervisorSeed=Join-Path $supervisorBase 'seed'
$supervisorStatePath=''
try {
    Reset-GuardentraTestProviders
    New-Item -ItemType Directory -Path (Join-Path $supervisorSeed 'scripts/guardentra/tests') -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $supervisorSeed '.gitignore'), "scripts/guardentra/state/`n")
    [IO.File]::WriteAllText((Join-Path $supervisorSeed 'scripts/guardentra/tests/Run-Tests.ps1'), "exit 0`n")
    Invoke-GuardentraTestGitSetup -GitArgs @('init',$supervisorSeed) | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $supervisorSeed -GitArgs @('config','user.name','GuardEntra Fixture') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $supervisorSeed -GitArgs @('config','user.email','fixture@guardentra.local') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $supervisorSeed -GitArgs @('add','.') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $supervisorSeed -GitArgs @('commit','-m','fixture') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $supervisorSeed -GitArgs @('remote','add','origin','https://github.com/akurteshi-guardentra/guardentra.git') | Out-Null
    Invoke-GuardentraTestGitSetup -WorkDir $supervisorSeed -GitArgs @('worktree','add','-b','tooling/supervisor-990',$supervisorRepo) | Out-Null
    $script:GuardentraRoot=$supervisorRepo
    $script:GuardentraStateRoot=Join-Path $supervisorRepo 'scripts/guardentra/state/issues'
    $supervisorSha=Get-GuardentraHeadSha
    $supervisorContract=New-GuardentraDefaultContract -IssueNumber 990 -Title 'Supervisor fixture' -StartingMainSha $supervisorSha -FeatureBranch 'tooling/supervisor-990' -WriterTool 'codex'
    $supervisorContract.worktree_path=$supervisorRepo
    $supervisorContract.access_tier='T2'
    Save-GuardentraContract 990 $supervisorContract
    $supervisorIssue=[pscustomobject]@{ Number=990; Title='Supervisor fixture'; State='OPEN'; Body=''; AuthorLogin=$owner; AcceptanceCriteria=@('local fixture') }
    $supervisorTask=New-GuardentraTaskV1 $supervisorContract $supervisorIssue
    $supervisorStatePath=Join-Path (Get-GuardentraIssueDir 990) 'supervisor.json'
    $supervisorPolicyText=''
    $script:GuardentraIssueRecordProvider={ param($IssueNumber); return $supervisorIssue }
    $script:GuardentraAuthorityCommentsProvider={
        param($IssueNumber)
        @(New-AuthorityComment -Body ((New-DispatchBody -Branch 'tooling/supervisor-990' -Sha $supervisorSha -Writer 'Codex') + $supervisorPolicyText) -Login $owner -Id 1 -SourceRef 'https://github.com/akurteshi-guardentra/guardentra/issues/990#issuecomment-1')
    }
    Assert-GuardentraAgentContractLive $supervisorContract 990
    Assert-True ((Get-GuardentraSupervisorPolicy $supervisorTask).providers.Count -eq 1) 'supervisor default policy grants no fallback writer'

    $good=[pscustomobject]@{ files=@([pscustomobject]@{ path='scripts/guardentra/example.txt'; content="example`n" }); findings=@() }
    Assert-GuardentraProposal $good $supervisorTask
    $hardlinkSource=Join-Path $supervisorBase 'hardlink-source.txt'
    $hardlinkTarget=Join-Path $supervisorRepo 'scripts/guardentra/hardlink.txt'
    [IO.File]::WriteAllText($hardlinkSource,'original')
    New-Item -ItemType HardLink -Path $hardlinkTarget -Value $hardlinkSource | Out-Null
    Set-GuardentraProposalFiles ([pscustomobject]@{ files=@([pscustomobject]@{ path='scripts/guardentra/hardlink.txt'; content='replacement' }); findings=@() }) $supervisorTask
    Assert-True ([IO.File]::ReadAllText($hardlinkSource) -eq 'original' -and [IO.File]::ReadAllText($hardlinkTarget) -eq 'replacement') 'proposal replacement cannot mutate external hardlink target'
    Remove-Item -LiteralPath $hardlinkTarget -Force
    foreach ($badPath in @('../escape','src/product.ts','.git/config','scripts/guardentra/state/issues/990/contract.json','scripts/guardentra/NUL.txt','scripts/guardentra/alias./file','scripts/guardentra/../escape')) {
        $bad=[pscustomobject]@{ files=@([pscustomobject]@{ path=$badPath; content='bad' }); findings=@() }
        Assert-Throws { Assert-GuardentraProposal $bad $supervisorTask } "proposal refuses $badPath"
    }
    $mint=[pscustomobject]@{ files=@(); findings=@(); auth_commit=$true }
    Assert-Throws { Assert-GuardentraProposal $mint $supervisorTask } 'provider result cannot mint owner authority'
    Assert-Throws { Assert-GuardentraProposal $good $supervisorTask -Review } 'reviewer cannot propose writes'
    $tierTask=ConvertTo-GuardentraDataMap $supervisorTask
    $tierTask.access_tier='T0'
    Assert-Throws { Assert-GuardentraProposal $good $tierTask } 'proposal cannot widen T0 access'
    $tierTask.access_tier='T1'
    Assert-Throws { Assert-GuardentraProposal $good $tierTask } 'proposal cannot widen T1 access'
    $tierTask.access_tier='T3'
    Assert-Throws { Assert-GuardentraProposal $good $tierTask } 'proposal rejects T3 task escalation'
    foreach ($action in @('commit','push','merge','deploy-staging','deploy-production','IAM','secrets','DNS','force-push','migration')) {
        Assert-Throws { Invoke-GuardentraNightRun -Action $action } "night-run refuses $action"
    }
    Assert-Throws { New-GuardentraVerificationEvidence -Stage PRODUCTION_LIVE_VERIFIED -Sha $supervisorSha -Evidence @('fixture') } 'live verification refuses missing environment'
    Assert-Throws { New-GuardentraVerificationEvidence -Stage STAGING_LIVE_VERIFIED -Sha $supervisorSha -Environment production -Evidence @('fixture') } 'live verification refuses wrong environment'
    Assert-Throws { New-GuardentraVerificationEvidence -Stage TESTED_LOCAL -Sha 'short' -Evidence @('fixture') } 'verification refuses inexact SHA'
    Assert-True ((New-GuardentraVerificationEvidence -Stage PRODUCTION_LIVE_VERIFIED -Sha $supervisorSha -Environment production -Evidence @('fixture')).provenance -eq 'UNVERIFIED_EXTERNAL_RECORD') 'schema-valid live record is not promoted to verified truth'
    Assert-True ((Get-GuardentraProviderFailureState 1 'rate_limit_exceeded' $false) -eq 'rate_limited') 'recognized rate-limit normalized'
    Assert-True ((Get-GuardentraProviderFailureState 1 'insufficient_quota' $false) -eq 'quota_exhausted') 'recognized quota normalized'
    Assert-True ((Get-GuardentraProviderFailureState 0 'rate_limit_exceeded in ordinary output' $false) -eq 'available') 'successful prose does not trigger failover'
    Assert-True ((Get-GuardentraProviderFailureState 1 'unknown' $true) -eq 'owner_action_required') 'timeout is explicit failure'

    $initial=New-GuardentraSupervisorState $supervisorTask
    Save-GuardentraSupervisorState $initial $supervisorStatePath
    $forged=ConvertTo-GuardentraDataMap $initial
    $forged.verification='PRODUCTION_LIVE_VERIFIED'
    Save-GuardentraSupervisorState $forged $supervisorStatePath
    Assert-Throws { Read-GuardentraSupervisorState $supervisorTask $supervisorStatePath } 'local state cannot promote production verification'
    Save-GuardentraSupervisorState $initial $supervisorStatePath
    $restored=Read-GuardentraSupervisorState $supervisorTask $supervisorStatePath
    Assert-True ($restored.task_hash -eq $initial.task_hash -and $restored.snapshot.digest -eq $initial.snapshot.digest) 'atomic persisted task/snapshot survives restart'
    $legacyState=ConvertTo-GuardentraDataMap $initial
    [void]$legacyState.Remove('worker_tail')
    Write-GuardentraAtomicJson $supervisorStatePath $legacyState
    $migratedState=Read-GuardentraSupervisorState $supervisorTask $supervisorStatePath
    Assert-True ($migratedState.worker_tail -eq '') 'pre-observer supervisor state migrates with empty non-authority worker tail'
    Save-GuardentraSupervisorState $initial $supervisorStatePath
    $restored=Read-GuardentraSupervisorState $supervisorTask $supervisorStatePath
    $restored.phase='running'; $restored.worker_pid=$PID; $restored.worker_started=(Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o')
    Save-GuardentraSupervisorState $restored $supervisorStatePath
    Assert-Throws { Read-GuardentraSupervisorState $supervisorTask $supervisorStatePath } 'live stale worker prevents concurrent restart'
    $restored.worker_pid=2147483647
    Save-GuardentraSupervisorState $restored $supervisorStatePath
    Assert-True ((Read-GuardentraSupervisorState $supervisorTask $supervisorStatePath).phase -eq 'queued') 'dead read-only worker recovery preserves exact snapshot'
    $restored.worker_pid=0
    Save-GuardentraSupervisorState $restored $supervisorStatePath
    Assert-Throws { Read-GuardentraSupervisorState $supervisorTask $supervisorStatePath } 'crash in launch window refuses unknown worker'
    $restored.phase='applying'
    Save-GuardentraSupervisorState $restored $supervisorStatePath
    Assert-Throws { Read-GuardentraSupervisorState $supervisorTask $supervisorStatePath } 'interrupted file application fails closed'
    Save-GuardentraSupervisorState $initial $supervisorStatePath

    # Actual separate process attempts the same named repository mutex while parent owns it.
    $leaseIdentity=Join-Path $supervisorBase 'exclusive-test'
    $lease=Enter-GuardentraSupervisorLease $leaseIdentity
    try {
        $mutexName='Global\Guardentra-' + (Get-GuardentraTextHash $leaseIdentity.ToLowerInvariant())
        $source='$m=New-Object Threading.Mutex($false,"' + $mutexName + '"); if($m.WaitOne(0)){$m.ReleaseMutex();exit 2}else{exit 0}'
        $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($source))
        $probe=Invoke-GuardentraProviderProcess -Executable (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-EncodedCommand',$encoded) -Directory $supervisorRepo -TimeoutSeconds 10
        Assert-True ($probe.ExitCode -eq 0) 'exclusive repository lease prevents second process writer'
    } finally { $lease.ReleaseMutex(); $lease.Dispose() }

    # A fast-exiting native child must not turn an empty stdin EOF race into a dispatcher exception.
    $fastEmpty=Invoke-GuardentraProviderProcess -Executable (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-Command','exit 7') -Directory $supervisorRepo -TimeoutSeconds 10
    Assert-True ($fastEmpty.ExitCode -eq 7 -and -not $fastEmpty.TimedOut) 'fast-exit child with empty stdin returns its real exit'

    # A child that closes stdin while a large write is pending must still return its real exit.
    $closedStdinSource='$s=[Console]::OpenStandardInput(); $s.Close(); exit 9'
    $fastClosed=Invoke-GuardentraProviderProcess -Executable (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-Command',$closedStdinSource) -InputText ('x' * 1048576) -Directory $supervisorRepo -TimeoutSeconds 10
    Assert-True ($fastClosed.ExitCode -eq 9 -and -not $fastClosed.TimedOut) 'closed stdin during payload write returns real child exit'

    # Delayed redirected output and non-zero exit status are separate lifecycle facts.
    # Capture both before reading ExitCode; this reproduces the remaining Windows fixture.
    $delayedOutputSource='Start-Sleep -Milliseconds 350; [Console]::Out.Write("late-output"); [Console]::Error.Write("late-error"); exit 13'
    $delayedOutput=Invoke-GuardentraProviderProcess -Executable (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-Command',$delayedOutputSource) -Directory $supervisorRepo -TimeoutSeconds 10
    Assert-True ($delayedOutput.ExitCode -eq 13 -and -not $delayedOutput.TimedOut) 'delayed-output child preserves exact nonzero exit status'
    Assert-True ($delayedOutput.Output -match 'late-output') 'delayed stdout is drained before provider result'
    Assert-True ($delayedOutput.Error -match 'late-error') 'delayed stderr is drained before provider result'
    Assert-True ($delayedOutput.TelemetryTail -match 'late-output' -and $delayedOutput.TelemetryTail -match 'late-error') 'observer telemetry tail preserves delayed stdout and stderr'

    $telemetrySecretSource='[Console]::Error.Write("token=supersecret"); [Console]::Out.Write("api_key=anothersecret"); exit 0'
    $telemetrySecret=Invoke-GuardentraProviderProcess -Executable (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-Command',$telemetrySecretSource) -Directory $supervisorRepo -TimeoutSeconds 10
    Assert-True ($telemetrySecret.TelemetryTail -match '\[REDACTED\]') 'observer telemetry redacts secret-like provider output'
    Assert-True ($telemetrySecret.TelemetryTail -notmatch 'supersecret|anothersecret') 'observer telemetry never persists secret-like values'
    Assert-True ($telemetrySecret.TelemetryTail.Length -le 2048) 'observer telemetry tail is bounded'

    $script:supervisorHeartbeats=0
    $timeoutRun=Invoke-GuardentraProviderProcess -Executable (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-Command','Start-Sleep -Seconds 30') -Directory $supervisorRepo -TimeoutSeconds 1 -Heartbeat { $script:supervisorHeartbeats++ }
    Assert-True ($timeoutRun.TimedOut -and (Get-GuardentraProviderFailureState $timeoutRun.ExitCode $timeoutRun.Error $timeoutRun.TimedOut) -eq 'owner_action_required') 'watchdog timeout returns valid non-failover state after parent termination'
    Assert-True ($script:supervisorHeartbeats -gt 0) 'watchdog emits heartbeats while worker runs'
    $watch=[Diagnostics.Stopwatch]::StartNew()
    $backpressure=Invoke-GuardentraProviderProcess -Executable (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-Command','Start-Sleep -Seconds 30') -InputText ('x' * 1048576) -Directory $supervisorRepo -TimeoutSeconds 1
    Assert-True ($backpressure.TimedOut -and $watch.Elapsed.TotalSeconds -lt 8) 'watchdog covers blocked stdin before provider begins reading'
    Assert-Throws { Invoke-GuardentraProviderProcess -Executable 'agent.exe' -Arguments @('--help') -Directory $supervisorRepo } 'bare provider command cannot collide on PATH' -Match 'REFUSED'

    # Synthetic transport, real supervisor/Git/required-test/state path.
    $script:supervisorCalls=@()
    function Invoke-GuardentraProposalAdapter {
        param($Task,$Tool,$Context,$Correction,[switch]$Review,$Heartbeat,$Started)
        $script:supervisorCalls += $Tool
        return [pscustomobject]@{ state='available'; proposal=$good; detail='fixture' }
    }
    $success=Invoke-GuardentraSupervisorTask 990
    Assert-True ($success.phase -eq 'owner_gate' -and $success.owner_gate -eq 'commit' -and $success.verification -eq 'TESTED_LOCAL') 'supervisor applies scoped proposal, tests, and stops before commit'
    Assert-True ((Get-GuardentraHeadSha) -eq $supervisorSha) 'supervisor does not commit'
    $callsBefore=$script:supervisorCalls.Count
    Invoke-GuardentraSupervisorTask 990 | Out-Null
    Assert-True ($script:supervisorCalls.Count -eq $callsBefore) 'restart at Owner gate does not relaunch provider'
    Assert-True ((Get-GuardentraSupervisorReport -Period night).tasks[0].evidence -eq 'CACHED_UNVERIFIED') 'night report labels cached evidence unverified'

    # Preserve the quota proof and add the owner-requested auth-required condition.
    foreach ($simulationMode in @('quota_exhausted','auth_required')) {
    # Persist exact current candidate for failover; no reset/checkout of work is used.
    $handoff=New-GuardentraSupervisorState $supervisorTask
    $handoff.tests=@('prior fixture test PASS')
    Save-GuardentraSupervisorState $handoff $supervisorStatePath
    $policyJson=@{ issue=990; branch='tooling/supervisor-990'; starting_sha=$supervisorSha; providers=@('codex','cursor'); reviewer='' } | ConvertTo-Json -Compress
    $supervisorPolicyText="`n## GUARDENTRA_SUPERVISOR_POLICY`n" + '```json' + "`n$policyJson`n" + '```'
    function Invoke-GuardentraProposalAdapter {
        param($Task,$Tool,$Context,$Correction,[switch]$Review,$Heartbeat,$Started)
        $script:supervisorCalls += $Tool
        if ($Tool -eq 'codex') {
            # Real harmless child lifecycle; the failure response is explicitly simulated.
            $failureText=if ($simulationMode -eq 'auth_required') { 'Not logged in' } else { 'insufficient_quota' }
            $childSource='[Console]::Error.WriteLine("' + $failureText + '"); exit 1'
            $run=Invoke-GuardentraProviderProcess -Executable (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-Command',$childSource) -Directory $Task.isolated_worktree_path -TimeoutSeconds 10 -Heartbeat $Heartbeat -Started $Started
            $script:simulationEvents.Add('first_child_exited')
            return [pscustomobject]@{ state=(Get-GuardentraProviderFailureState $run.ExitCode $run.Error $run.TimedOut); proposal=$null; detail='SIMULATION: no provider quota consumed' }
        }
        $persisted=Get-Content -LiteralPath $supervisorStatePath -Raw | ConvertFrom-Json
        $script:simulationFallbackState=$persisted
        $script:simulationEvents.Add('fallback_selected_from_persisted_state')
        return [pscustomobject]@{ state='available'; proposal=$good; detail='fixture' }
    }
    # Instrument the actual mutex without changing the supervisor state machine.
    $realEnterLease=(Get-Item Function:Enter-GuardentraSupervisorLease).ScriptBlock
    $script:simulationEvents=New-Object 'System.Collections.Generic.List[string]'
    $script:simulationLeases=@(); $script:simulationFallbackState=$null
    $script:simulationBetweenLeases=$false; $script:simulationExclusive=@()
    function Test-SimulationMutexAvailable {
        param([string]$RepositoryIdentity)
        $canonical=Resolve-GuardentraAbsolutePath -BasePath $script:GuardentraRoot -MaybeRelative $RepositoryIdentity
        $name='Global\Guardentra-' + (Get-GuardentraTextHash $canonical.ToLowerInvariant())
        $source='$m=New-Object Threading.Mutex($false,"' + $name + '"); try { if($m.WaitOne(0)){$m.ReleaseMutex();exit 0}else{exit 2} } finally { $m.Dispose() }'
        $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($source))
        $probe=Invoke-GuardentraProviderProcess -Executable (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-EncodedCommand',$encoded) -Directory $supervisorRepo -TimeoutSeconds 10
        return ($probe.ExitCode -eq 0)
    }
    function Enter-GuardentraSupervisorLease {
        param([string]$RepositoryIdentity)
        if ($script:simulationLeases.Count -gt 0) {
            $script:simulationBetweenLeases=(Test-SimulationMutexAvailable $RepositoryIdentity)
            $script:simulationEvents.Add('between_leases_observed')
        }
        $mutex=& $realEnterLease $RepositoryIdentity
        $wrapper=[pscustomobject]@{ mutex=$mutex; released=$false; disposed=$false; id=($script:simulationLeases.Count + 1) }
        $wrapper | Add-Member ScriptMethod ReleaseMutex {
            $this.mutex.ReleaseMutex(); $this.released=$true
            $script:simulationEvents.Add("lease_$($this.id)_released")
        }
        $wrapper | Add-Member ScriptMethod Dispose {
            $this.mutex.Dispose(); $this.disposed=$true
            $script:simulationEvents.Add("lease_$($this.id)_disposed")
        }
        $script:simulationLeases += $wrapper
        $script:simulationEvents.Add("lease_$($wrapper.id)_acquired")
        $script:simulationExclusive += (-not (Test-SimulationMutexAvailable $RepositoryIdentity))
        return $wrapper
    }
    try { $fallback=Invoke-GuardentraSupervisorTask 990 }
    finally { Set-Item Function:Enter-GuardentraSupervisorLease $realEnterLease }
    Assert-True ($fallback.provider -eq 'cursor' -and $fallback.handoffs.Count -eq 1 -and $fallback.handoffs[0].snapshot.digest -eq $handoff.snapshot.digest) 'quota failover preserves exact candidate and persists authorized handoff'
    $simulationChecks=[ordered]@{
        first_lease_closed=($script:simulationLeases.Count -eq 2 -and $script:simulationLeases[0].released -and $script:simulationLeases[0].disposed)
        old_mutex_available_between_leases=$script:simulationBetweenLeases
        no_overlapping_lease=($script:simulationExclusive.Count -eq 2 -and @($script:simulationExclusive | Where-Object { -not $_ }).Count -eq 0)
        persisted_fallback=($script:simulationFallbackState.provider -eq 'cursor' -and $script:simulationFallbackState.handoffs.Count -eq 1)
        prior_worker_cleared=($script:simulationFallbackState.worker_pid -eq 0 -and $script:simulationFallbackState.worker_started -eq '')
        task_identity_preserved=($script:simulationFallbackState.task_hash -ceq $handoff.task_hash -and $fallback.task_hash -ceq $handoff.task_hash)
        previous_tests_preserved=($script:simulationFallbackState.tests[0] -ceq 'prior fixture test PASS' -and $fallback.handoffs[0].tests[0] -ceq 'prior fixture test PASS')
        candidate_preserved=($fallback.snapshot.digest -ceq $handoff.snapshot.digest -and $fallback.snapshot.head -ceq $handoff.snapshot.head -and $fallback.snapshot.diff_hash -ceq $handoff.snapshot.diff_hash)
        exact_lifecycle=(($script:simulationEvents -join ',') -ceq 'lease_1_acquired,first_child_exited,lease_1_released,lease_1_disposed,between_leases_observed,lease_2_acquired,fallback_selected_from_persisted_state,lease_2_released,lease_2_disposed')
        owner_gate_retained=($fallback.phase -eq 'owner_gate' -and $fallback.owner_gate -eq 'commit' -and (Get-GuardentraHeadSha) -ceq $supervisorSha)
    }
    foreach ($check in $simulationChecks.Keys) { Assert-True $simulationChecks[$check] "failover simulation: $check" }
    $simulationEvidence=@{
        schema='guardentra.failover-simulation.v1'; utc=[datetime]::UtcNow.ToString('o')
        verdict=$(if (@($simulationChecks.Values | Where-Object { -not $_ }).Count) { 'FAIL' } else { 'PASS' })
        authority='SIMULATION ONLY: fixture issue 990; never a live Issue 90 grant or fallback policy'
        provider_calls=('simulated Codex ' + $simulationMode + ' and Cursor proposal; not live inference')
        controlled_condition=$simulationMode
        checks=$simulationChecks; events=@($script:simulationEvents.ToArray())
        before=$handoff; fallback_entry=$script:simulationFallbackState; after=$fallback
    }
    $simulationFile=if ($simulationMode -eq 'auth_required') { 'failover-auth-simulation.json' } else { 'failover-simulation.json' }
    Write-GuardentraAtomicJson (Join-Path $supervisorOldRoot ('scripts/guardentra/state/tests/' + $simulationFile)) $simulationEvidence
    }

    # Review HIGH -> same writer; third failed correction persists and stops.
    $policyJson=@{ issue=990; branch='tooling/supervisor-990'; starting_sha=$supervisorSha; providers=@('codex','cursor'); reviewer='cursor' } | ConvertTo-Json -Compress
    $supervisorPolicyText="`n## GUARDENTRA_SUPERVISOR_POLICY`n" + '```json' + "`n$policyJson`n" + '```'
    Save-GuardentraSupervisorState (New-GuardentraSupervisorState $supervisorTask) $supervisorStatePath
    $script:supervisorCalls=@()
    function Invoke-GuardentraProposalAdapter {
        param($Task,$Tool,$Context,$Correction,[switch]$Review,$Heartbeat,$Started)
        $script:supervisorCalls += $Tool
        $proposal=if ($Review) { [pscustomobject]@{ files=@(); findings=@([pscustomobject]@{ severity='HIGH'; path='scripts/guardentra/example.txt'; reason='fixture finding'; fix='correct fixture' }) } } else { $good }
        return [pscustomobject]@{ state='available'; proposal=$proposal; detail='fixture' }
    }
    Assert-Throws { Invoke-GuardentraSupervisorTask 990 } 'third failed correction stops supervisor' -Match 'ESCALATE'
    Assert-True ((Read-GuardentraContract 990).attempt_count -eq 3) 'correction exhaustion persists in shared dispatcher counter'
    $failedState=Get-Content -LiteralPath $supervisorStatePath -Raw | ConvertFrom-Json
    Assert-True ($failedState.attempts.Count -eq 3 -and @($failedState.attempts | Where-Object { $_.tests.Count -gt 0 -and $_.findings.Count -gt 0 }).Count -eq 3) 'all correction cycles retain exact candidate, tests and review findings'
    Assert-True (($script:supervisorCalls -join ',') -eq 'codex,cursor,codex,cursor,codex,cursor') 'review corrections return to same healthy writer without resource failover'
    Assert-Throws { Invoke-GuardentraSupervisorTask 990 } 'restart cannot bypass third correction failure' -Match 'ESCALATE'
    $night=Invoke-GuardentraNightRun
    Assert-True ($night.phase -eq 'blocked') 'night-run records blocked task without unsafe action'
    $secondRepo=Join-Path $supervisorBase 'guardentra-codex-991'
    Invoke-GuardentraTestGitSetup -WorkDir $supervisorSeed -GitArgs @('worktree','add','-b','tooling/supervisor-991',$secondRepo) | Out-Null
    $secondContract=New-GuardentraDefaultContract -IssueNumber 991 -Title 'Second fixture' -StartingMainSha $supervisorSha -FeatureBranch 'tooling/supervisor-991' -WriterTool 'codex'
    $secondContract.access_tier='T2'; $secondContract.worktree_path=$secondRepo
    $script:GuardentraStateRoot=Join-Path $secondRepo 'scripts/guardentra/state/issues'
    Save-GuardentraContract 991 $secondContract
    $script:GuardentraStateRoot=Join-Path $supervisorRepo 'scripts/guardentra/state/issues'
    $script:GuardentraIssueRecordProvider={ param($IssueNumber); [pscustomobject]@{ Number=$IssueNumber; Title='Fixture'; State='OPEN'; Body=''; AuthorLogin=$owner; AcceptanceCriteria=@('fixture') } }
    $script:GuardentraAuthorityCommentsProvider={
        param($IssueNumber)
        @(New-AuthorityComment -Body (New-DispatchBody -Branch "tooling/supervisor-$IssueNumber" -Sha $supervisorSha -Writer 'Codex') -Login $owner -Id 1 -SourceRef "https://github.com/akurteshi-guardentra/guardentra/issues/$IssueNumber#issuecomment-1")
    }
    $night=@(Invoke-GuardentraNightRun)
    Assert-True (@($night | Where-Object { $_.issue -eq 990 -and $_.phase -eq 'blocked' }).Count -eq 1 -and @($night | Where-Object { $_.issue -eq 991 -and $_.gate -eq 'commit' }).Count -eq 1) 'night-run continues to a second registered safe worktree after blocked task'
} finally {
    Set-Item Function:Invoke-GuardentraProposalAdapter $supervisorAdapter
    Reset-GuardentraTestProviders
    $script:GuardentraRoot=$supervisorOldRoot
    $script:GuardentraStateRoot=$supervisorOldState
    # Verify the resolved recursive cleanup target belongs to this unique temp fixture.
    $resolved=[IO.Path]::GetFullPath($supervisorBase)
    $tempPrefix=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\guardentra-supervisor-'
    if (-not $resolved.StartsWith($tempPrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'REFUSED: unsafe fixture cleanup path' }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
