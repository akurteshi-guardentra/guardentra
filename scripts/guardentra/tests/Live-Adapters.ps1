# Explicit opt-in live smoke test, separate from the offline regression suite.
# Existing provider auth only; no installation, configuration, or credential changes.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../Common.ps1')
. (Join-Path $PSScriptRoot '../Commands.ps1')
$taskPath=Join-Path $script:GuardentraStateRoot '90/task.v1.json'
$task=Get-Content -LiteralPath $taskPath -Raw | ConvertFrom-Json
Assert-GuardentraAgentContractLive (Read-GuardentraContract 90) 90
Assert-GuardentraTaskV1MatchesDispatch $task (Get-GuardentraDispatchEnvelope 90)
if ((Get-GuardentraHeadSha) -cne $task.starting_sha) { throw 'REFUSED: live probe requires exact starting HEAD' }
$lease=Enter-GuardentraSupervisorLease (Get-GuardentraGitCommonDir)
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('guardentra-live-adapter-' + [guid]::NewGuid().ToString('n'))
$evidence=[ordered]@{ schema='guardentra.live-adapters.v1'; issue=90; utc=[datetime]::UtcNow.ToString('o'); providers=@(); failover='NOT_AVAILABLE: no observed quota/rate-limit and no live issue fallback policy; no exhaustion induced'; deployment='NOT DEPLOYED' }
try {
    $before=Get-GuardentraSupervisorSnapshot $task
    $evidence.snapshot=$before
    $evidence.implementation_hashes=@{}
    foreach ($relative in @('scripts/guardentra/ProviderProcesses.ps1','scripts/guardentra/ProviderDoctor.ps1','scripts/guardentra/Supervisor.ps1','scripts/guardentra/tests/Live-Adapters.ps1')) {
        $evidence.implementation_hashes[$relative]=(Get-FileHash -LiteralPath (Join-Path $script:GuardentraRoot $relative) -Algorithm SHA256).Hash
    }
    $evidence.doctor=Get-GuardentraProviderDoctor
    $probePath='scripts/guardentra/tests/live-adapter-probe.txt'
    $probeContent="GuardEntra issue 90 proposal transport proof.`n"
    $context='This is only a bounded transport smoke test, not implementation of the objective. Return exactly one proposed file at ' + $probePath + ' with content ' + (ConvertTo-Json $probeContent -Compress) + ' and empty findings. Do not inspect files or use tools. Do not write the file yourself.'
    foreach ($provider in @('codex','cursor','gemini','cloud','grok','xai')) {
        $capability=Get-GuardentraProviderCapability $provider
        $script:liveProbeHeartbeats=0; $script:liveProbeWorker=0; $script:liveProbeBirth=''
        $row=[ordered]@{ provider=$provider; capability=$capability; result='NOT_AVAILABLE'; state=$capability.state; proposal_valid=$false; application_roundtrip=$false; heartbeat_count=0; worker_exited=$true; normalized_result=$null; detail=$capability.reason }
        # All providers use the real common adapter, including unavailable-state paths.
        try {
            $outcome=Invoke-GuardentraProposalAdapter -Task $task -Tool $provider -Context $context -Heartbeat { $script:liveProbeHeartbeats++ } -Started { param($workerId,$birth); $script:liveProbeWorker=$workerId; $script:liveProbeBirth=$birth }
            $row.state=$outcome.state; $row.detail=$outcome.detail
            if ($outcome.state -cnotin $script:GuardentraProviderStates) { throw 'REFUSED: invalid live provider state' }
            if ($outcome.state -eq 'available') {
                Assert-GuardentraProposal $outcome.proposal $task
                if ($outcome.proposal.files.Count -ne 1 -or $outcome.proposal.files[0].path -cne $probePath -or $outcome.proposal.files[0].content -cne $probeContent -or $outcome.proposal.findings.Count -ne 0) { throw 'REFUSED: live proposal does not match deterministic probe' }
                $row.proposal_valid=$true
                # Exercise actual supervisor application in a disposable directory only.
                # The provider received the unchanged authoritative task, not this fixture.
                $fixtureTask=ConvertTo-GuardentraDataMap $task
                $fixtureTask.isolated_worktree_path=$fixture
                Set-GuardentraProposalFiles $outcome.proposal $fixtureTask
                $row.application_roundtrip=([IO.File]::ReadAllText((Join-Path $fixture $probePath)) -ceq $probeContent)
                if (-not $row.application_roundtrip) { throw 'REFUSED: proposal application mismatch' }
                $row.result='PASS'
                # Store only the validated deterministic marker, never arbitrary model output.
                $row.normalized_result=@{ state=$outcome.state; proposal=$outcome.proposal; detail=$outcome.detail }
            } elseif ($outcome.state -in @('failed','rate_limited','quota_exhausted')) { $row.result='FAIL' }
            if ($null -eq $row.normalized_result) {
                $row.normalized_result=@{ state=$outcome.state; proposal=$null; detail=$outcome.detail }
            }
        } catch { $row.result='FAIL'; $row.detail='probe refused or failed; raw provider details omitted' }
        $row.heartbeat_count=$script:liveProbeHeartbeats
        if ($script:liveProbeWorker) {
            $worker=Get-Process -Id $script:liveProbeWorker -ErrorAction SilentlyContinue
            $row.worker_exited=(-not $worker -or $worker.StartTime.ToUniversalTime().ToString('o') -cne $script:liveProbeBirth)
        }
        if (-not $row.worker_exited) { throw 'REFUSED: live worker remains; stop all further probes' }
        Assert-GuardentraSnapshotEqual $before (Get-GuardentraSupervisorSnapshot $task)
        $evidence.providers += $row
        Write-Host ($provider + ': ' + $row.result + ' / ' + $row.state)
    }
    $evidence.candidate_unchanged=$true
    # Provider aliases are not independent real-provider proofs.
    $evidence.real_providers=@($evidence.providers | Where-Object { $_.result -eq 'PASS' } | ForEach-Object {
        $providerName=$_.provider
        switch ($providerName) { 'cloud' { 'gemini' } 'xai' { 'grok' } default { $providerName } }
    } | Sort-Object -Unique)
    $evidence.real_provider_count=$evidence.real_providers.Count
    $evidence.two_provider_verdict=if ($evidence.real_provider_count -ge 2) { 'PASS' } else { 'NOT_AVAILABLE' }
    $evidence.proof_boundary='Real common-adapter response, strict proposal validation, disposable application/readback. Not a full live supervisor implementation/failover run.'
    Write-GuardentraAtomicJson (Join-Path $script:GuardentraStateRoot '90/live-adapters.json') $evidence
} finally {
    $lease.ReleaseMutex(); $lease.Dispose()
    $resolved=[IO.Path]::GetFullPath($fixture)
    $prefix=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\guardentra-live-adapter-'
    if (-not $resolved.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'REFUSED: unsafe live fixture cleanup' }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
if (@($evidence.providers | Where-Object { $_.result -eq 'FAIL' }).Count) { exit 1 }
