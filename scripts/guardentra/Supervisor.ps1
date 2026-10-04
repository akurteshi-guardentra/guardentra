# #90 local supervisor. GitHub authorizes scope; local state never authorizes gates.
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'ProviderProcesses.ps1')

function Get-GuardentraTextHash {
    param([string]$Text)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-','').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
}

function Write-GuardentraAtomicJson {
    param([string]$Path, $Value)
    $parent = Split-Path $Path -Parent
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $temporary = Join-Path $parent ([guid]::NewGuid().ToString('n') + '.tmp')
    $backup = $temporary + '.bak'
    try {
        [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 30), (New-Object Text.UTF8Encoding($false)))
        if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($temporary, $Path, $backup) }
        else { [IO.File]::Move($temporary, $Path) }
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
        if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
    }
}

function Enter-GuardentraSupervisorLease {
    param([string]$RepositoryIdentity)
    # Conservative repository-wide lease prevents branch aliases and two linked-worktree writers.
    $canonical=Resolve-GuardentraAbsolutePath -BasePath $script:GuardentraRoot -MaybeRelative $RepositoryIdentity
    $name = 'Global\Guardentra-' + (Get-GuardentraTextHash $canonical.ToLowerInvariant())
    $mutex = New-Object Threading.Mutex($false, $name)
    try {
        try { $acquired = $mutex.WaitOne(0) }
        catch [Threading.AbandonedMutexException] {
            $mutex.ReleaseMutex()
            throw 'REFUSED: abandoned supervisor lease; reconcile prior worker before restart'
        }
        if (-not $acquired) { throw 'REFUSED: busy exclusive writer lease' }
        return $mutex
    } catch { $mutex.Dispose(); throw }
}

function Get-GuardentraSupervisorSnapshot {
    param($Task)
    $paths = @(Get-GuardentraChangedFiles -BaseSha $Task.starting_sha)
    if ($paths.Count) { Assert-GuardentraChangedFilesAllowed -Paths $paths -Contract $Task }
    $diff = Invoke-GuardentraGit -GitArgs @('diff','--binary',$Task.starting_sha,'--')
    if ($diff.ExitCode -ne 0) { throw 'REFUSED: snapshot diff unavailable' }
    return [ordered]@{
        branch=(Get-GuardentraCurrentBranch); head=(Get-GuardentraHeadSha)
        paths=$paths; digest=(Get-GuardentraCandidateContentDigest -BaseSha $Task.starting_sha)
        diff_hash=(Get-GuardentraTextHash $diff.Output); worktree=(Get-GuardentraWorktreeState)
    }
}

function Assert-GuardentraSnapshotEqual {
    param($Expected, $Actual)
    foreach ($field in @('branch','head','digest','diff_hash','worktree')) {
        if ([string]$Expected.$field -cne [string]$Actual.$field) { throw "REFUSED: candidate changed outside supervisor ($field)" }
    }
    if (-not (Compare-GuardentraStringSets @($Expected.paths) @($Actual.paths))) { throw 'REFUSED: candidate file set changed' }
}

function New-GuardentraSupervisorState {
    param($Task)
    return [ordered]@{
        schema='guardentra.supervisor.v1'; issue=$Task.issue; task_hash=(Get-GuardentraTaskIdentity $Task)
        phase='queued'; provider=$Task.writer_tool; reviewer=$Task.reviewer_tool; verification='MISSING'
        snapshot=(Get-GuardentraSupervisorSnapshot $Task); tests=@(); attempts=@(); handoffs=@()
        blocker=''; owner_gate=''; worker_pid=0; worker_started=''; heartbeat_utc=''; updated_utc=[datetime]::UtcNow.ToString('o')
    }
}

function Get-GuardentraTaskIdentity {
    param($Task)
    $identity = ConvertTo-GuardentraDataMap $Task
    $identity.Remove('generated_utc')
    return Get-GuardentraTextHash ($identity | ConvertTo-Json -Depth 12 -Compress)
}

function Read-GuardentraSupervisorState {
    param($Task, [string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return New-GuardentraSupervisorState $Task }
    $state = ConvertTo-GuardentraDataMap (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
    $expected = New-GuardentraSupervisorState $Task
    Assert-GuardentraExactKeys $state @($expected.Keys)
    if ($state.schema -cne 'guardentra.supervisor.v1' -or $state.issue -ne $Task.issue -or $state.task_hash -cne (Get-GuardentraTaskIdentity $Task)) { throw 'REFUSED: supervisor task identity changed' }
    if ($state.phase -cnotin @('queued','running','applying','testing','reviewing','correction','handoff','owner_gate','blocked')) { throw 'REFUSED: invalid supervisor phase' }
    if ($state.verification -cnotin @('MISSING','IMPLEMENTED_LOCAL','TESTED_LOCAL')) { throw 'REFUSED: local state cannot claim repository or live verification' }
    if ($state.worker_pid -isnot [int] -or $state.worker_pid -lt 0) { throw 'REFUSED: invalid worker identity' }
    if ($state.phase -in @('running','reviewing')) {
        if ($state.worker_pid -eq 0) { throw 'REFUSED: interrupted launch with unknown worker; owner reconciliation required' }
        $worker = Get-Process -Id $state.worker_pid -ErrorAction SilentlyContinue
        if ($worker -and $worker.StartTime.ToUniversalTime().ToString('o') -eq $state.worker_started) { throw 'REFUSED: prior worker still alive; no concurrent fallback' }
        # The adapter was read-only; a dead worker may be retried only on the exact candidate.
        $state.phase='queued'; $state.worker_pid=0; $state.worker_started=''
    }
    if ($state.phase -in @('applying','testing')) { throw 'REFUSED: interrupted mutation/test; owner reconciliation required' }
    Assert-GuardentraSnapshotEqual $state.snapshot (Get-GuardentraSupervisorSnapshot $Task)
    return $state
}

function Save-GuardentraSupervisorState {
    param($State, [string]$Path)
    $State.updated_utc=[datetime]::UtcNow.ToString('o')
    Write-GuardentraAtomicJson $Path $State
}

function Get-GuardentraSupervisorPolicy {
    param($Task)
    # Additional providers/reviewer must be named by the accepted GitHub owner, never local/model state.
    $policy = [ordered]@{ providers=@($Task.writer_tool); reviewer=$Task.reviewer_tool }
    $bundle = Get-GuardentraAuthorityGrantsAndEvents -IssueNumber $Task.issue
    $matchesFound = @()
    foreach ($comment in $bundle.Comments) {
        if (-not (Test-GuardentraAuthorityAuthor ([string]$comment.AuthorLogin))) { continue }
        if ([string]$comment.Body -match '(?s)## GUARDENTRA_SUPERVISOR_POLICY\s+```json\s*(.*?)\s*```') { $matchesFound += ($Matches[1] | ConvertFrom-Json) }
    }
    if ($matchesFound.Count -gt 1) { throw 'REFUSED: ambiguous supervisor provider policy' }
    if ($matchesFound.Count -eq 1) {
        $entry = $matchesFound[0]
        Assert-GuardentraExactKeys $entry @('issue','branch','starting_sha','providers','reviewer')
        if ($entry.issue -ne $Task.issue -or $entry.branch -cne $Task.feature_branch -or $entry.starting_sha -cne $Task.starting_sha) { throw 'REFUSED: supervisor policy identity mismatch' }
        Assert-GuardentraStringArray $entry.providers 'providers' -NonEmpty
        if ($entry.providers[0] -cne $Task.writer_tool) { throw 'REFUSED: provider policy must start with assigned writer' }
        foreach ($provider in $entry.providers) { if ($provider -cnotin @('codex','cursor','gemini','cloud','grok','xai')) { throw 'REFUSED: unknown provider in policy' } }
        if ($entry.reviewer -and $entry.reviewer -cnotin @('codex','cursor','gemini','cloud','grok','xai')) { throw 'REFUSED: unknown reviewer' }
        $policy.providers=@($entry.providers | Select-Object -Unique); $policy.reviewer=[string]$entry.reviewer
    }
    return $policy
}

function Assert-GuardentraProposal {
    param($Proposal, $Task, [switch]$Review)
    Assert-GuardentraTaskV1Valid $Task | Out-Null
    Assert-GuardentraExactKeys $Proposal @('files','findings')
    if ($Proposal.files -isnot [array] -or $Proposal.findings -isnot [array]) { throw 'REFUSED: proposal arrays required' }
    if ($Review -and $Proposal.files.Count) { throw 'REFUSED: reviewer cannot write' }
    if ($Proposal.files.Count -gt 100 -or $Proposal.findings.Count -gt 100) { throw 'REFUSED: oversized proposal' }
    $seen = @{}
    foreach ($file in $Proposal.files) {
        Assert-GuardentraExactKeys $file @('path','content')
        if ($file.path -isnot [string] -or $file.content -isnot [string] -or $file.content.Length -gt 524288) { throw 'REFUSED: invalid file proposal' }
        Assert-GuardentraRelativePath $file.path
        # These are authority/runtime metadata, even if an issue allows a parent directory.
        if ($file.path -match '(?i)(^|/)(\.git|\.agents|\.codex|\.claude|\.cursor)(/|$)|^scripts/guardentra/state(/|$)|(^|/)AGENTS\.md$|(^|/)[^/]*[. ](/|$)' -or
            $file.path -match '(?i)(^|/)(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])([.]|/|$)') { throw 'REFUSED: protected or ambiguous proposal path' }
        if ($Task.access_tier -eq 'T0') { throw 'REFUSED: T0 cannot write' }
        if ($Task.access_tier -eq 'T1' -and $file.path -notmatch '^(docs/|scripts/guardentra/tests/)') { throw 'REFUSED: T1 cannot edit implementation' }
        if (-not (Test-GuardentraPathAllowed $file.path $Task.allowed_paths $Task.prohibited_paths)) { throw 'REFUSED: proposal outside allowed paths' }
        if ($seen.ContainsKey($file.path)) { throw 'REFUSED: duplicate proposal path' }; $seen[$file.path]=$true
        $full = [IO.Path]::GetFullPath((Join-Path $Task.isolated_worktree_path $file.path))
        $root = [IO.Path]::GetFullPath($Task.isolated_worktree_path).TrimEnd('\','/')
        if (-not $full.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'REFUSED: proposal escapes worktree' }
        $check = $full
        while ($check.Length -ge $root.Length) {
            if (Test-Path -LiteralPath $check) {
                $item = Get-Item -LiteralPath $check -Force
                if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'REFUSED: proposal traverses reparse point' }
                if ($check -eq $full -and $item.PSIsContainer) { throw 'REFUSED: proposal target is a directory' }
            }
            $check=Split-Path $check -Parent
        }
        if ((Protect-GuardentraSecrets $file.content) -cne $file.content) { throw 'REFUSED: secret-like provider content' }
    }
    foreach ($finding in $Proposal.findings) {
        Assert-GuardentraExactKeys $finding @('severity','path','reason','fix')
        if ($finding.severity -cnotin @('BLOCKER','HIGH','MEDIUM','LOW')) { throw 'REFUSED: invalid review severity' }
        foreach ($field in @('path','reason','fix')) {
            if ($finding.$field -isnot [string] -or $finding.$field.Length -gt 8192 -or (Protect-GuardentraSecrets $finding.$field) -cne $finding.$field) { throw 'REFUSED: unsafe review finding' }
        }
    }
}

function Set-GuardentraProposalFiles {
    param($Proposal, $Task)
    Assert-GuardentraProposal $Proposal $Task
    foreach ($file in $Proposal.files) {
        $full=Join-Path $Task.isolated_worktree_path $file.path
        New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force | Out-Null
        # Replace the directory entry instead of following an existing hard link in place.
        $temporary=Join-Path (Split-Path $full -Parent) ([guid]::NewGuid().ToString('n') + '.tmp')
        $backup=$temporary + '.bak'
        try {
            [IO.File]::WriteAllText($temporary, $file.content, (New-Object Text.UTF8Encoding($false)))
            if (Test-Path -LiteralPath $full) { [IO.File]::Replace($temporary,$full,$backup) }
            else { [IO.File]::Move($temporary,$full) }
        } finally {
            foreach ($temporaryPath in @($temporary,$backup)) {
                if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
            }
        }
    }
}

function Get-GuardentraProviderContext {
    param($Task, $Snapshot, $Tests)
    # Only in-scope tracked text; exclude credentials, runtime caches and binary files.
    $listed=Invoke-GuardentraGit -GitArgs @('ls-files')
    if ($listed.ExitCode -ne 0) { throw 'REFUSED: context file inventory unavailable' }
    $files=@()
    $length=0
    foreach ($path in @(($listed.Output -split '\r?\n') + @($Snapshot.paths) | Sort-Object -Unique)) {
        if (-not $path -or $path -match '(?i)(^|/)(state|node_modules)(/|$)|\.env|credential|secret|\.pem$|\.key$') { continue }
        if (-not (Test-GuardentraPathAllowed $path $Task.allowed_paths $Task.prohibited_paths)) { continue }
        $full=Join-Path $Task.isolated_worktree_path $path
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
        $content=[IO.File]::ReadAllText($full)
        if ($content.Contains([string][char]0)) { continue }
        if ((Protect-GuardentraSecrets $content) -cne $content) { $files += @{ path=$path; omitted='secret-like content; owner-safe context required' }; continue }
        $length += $content.Length
        if ($length -gt 1500000) { throw 'REFUSED: context exceeds bounded transport size' }
        $files += @{ path=$path; content=$content }
    }
    return (@{ snapshot=$Snapshot; tests=@($Tests); files=$files } | ConvertTo-Json -Depth 12 -Compress)
}

function New-GuardentraVerificationEvidence {
    param([ValidateSet('MISSING','IMPLEMENTED_LOCAL','TESTED_LOCAL','COMMITTED','PR_VERIFIED','MERGED','STAGING_DEPLOYED','STAGING_LIVE_VERIFIED','PRODUCTION_DEPLOYED','PRODUCTION_LIVE_VERIFIED')][string]$Stage,
        [string]$Sha='', [string]$Environment='', [string[]]$Evidence=@())
    if ($Stage -ne 'MISSING' -and (-not (Test-GuardentraSha40 $Sha) -or -not $Evidence.Count)) { throw 'REFUSED: verification requires exact SHA and evidence' }
    if ($Stage -match '^(STAGING|PRODUCTION)_') {
        $expected=if ($Stage.StartsWith('STAGING')) { 'staging' } else { 'production' }
        if ($Environment -cne $expected) { throw 'REFUSED: verification environment mismatch' }
    } elseif ($Environment) { throw 'REFUSED: local/repository stage cannot imply environment verification' }
    # This is a record validator, not a state promotion API. Supervisor only produces local stages.
    return [pscustomobject]@{ stage=$Stage; sha=$Sha; environment=$Environment; evidence=@($Evidence); provenance='UNVERIFIED_EXTERNAL_RECORD' }
}

function Invoke-GuardentraSupervisorTask {
    param([int]$IssueNumber)
    $lease=$null
    $state=$null
    $statePath=Join-Path (Get-GuardentraIssueDir $IssueNumber) 'supervisor.json'
    try {
        Assert-GuardentraRepository
        $lease=Enter-GuardentraSupervisorLease (Get-GuardentraGitCommonDir)
        $contract=Read-GuardentraContract $IssueNumber
        Assert-GuardentraAgentContractLive $contract $IssueNumber
        $issue=Get-GuardentraIssueRecord $IssueNumber
        if ($issue.State -cne 'OPEN') { throw 'REFUSED: task issue is not open' }
        $task=New-GuardentraTaskV1 $contract $issue
        foreach ($dependency in $task.dependencies) {
            if ($dependency -notmatch '^#?([1-9][0-9]*)$') { throw 'REFUSED: ambiguous dependency' }
            if ((Get-GuardentraIssueRecord ([int]$Matches[1])).State -cne 'CLOSED') { throw 'REFUSED: task dependency remains open' }
        }
        if ((Get-GuardentraHeadSha) -cne $task.starting_sha) { throw 'REFUSED: supervisor requires exact starting HEAD; commit remains an Owner gate' }
        $existed=Test-Path -LiteralPath $statePath
        if (-not $existed) { Assert-GuardentraWorktreeClean }
        $state=Read-GuardentraSupervisorState $task $statePath
        $policy=Get-GuardentraSupervisorPolicy $task
        if ($policy.providers -cnotcontains $state.provider) { throw 'REFUSED: persisted provider no longer authorized' }
        $state.reviewer=$policy.reviewer
        if ($state.phase -in @('owner_gate','blocked')) { return $state }
        # A bounded pass persists all progress. night-run supplies further passes.
        for ($cycle=0; $cycle -lt ($policy.providers.Count + 4); $cycle++) {
            Assert-GuardentraAgentContractLive $contract $IssueNumber
            Test-GuardentraRetryGate $contract
            $policyNow=Get-GuardentraSupervisorPolicy $task
            if (($policyNow | ConvertTo-Json -Compress) -cne ($policy | ConvertTo-Json -Compress)) { throw 'REFUSED: provider policy changed during run' }
            Assert-GuardentraSnapshotEqual $state.snapshot (Get-GuardentraSupervisorSnapshot $task)
            $state.phase='running'; $state.worker_pid=0; $state.worker_started=''
            $state.heartbeat_utc=[datetime]::UtcNow.ToString('o')
            Save-GuardentraSupervisorState $state $statePath
            $heartbeat={ $state.heartbeat_utc=[datetime]::UtcNow.ToString('o'); Save-GuardentraSupervisorState $state $statePath }
            $started={ param($workerId,$birth); $state.worker_pid=$workerId; $state.worker_started=$birth; Save-GuardentraSupervisorState $state $statePath }
            $context=Get-GuardentraProviderContext $task $state.snapshot $state.tests
            $outcome=Invoke-GuardentraProposalAdapter -Task $task -Tool $state.provider -Context $context -Correction $state.blocker -Heartbeat $heartbeat -Started $started
            Assert-GuardentraSnapshotEqual $state.snapshot (Get-GuardentraSupervisorSnapshot $task)
            if ($outcome.state -cnotin $script:GuardentraProviderStates) { throw 'REFUSED: unknown provider state' }
            $state.worker_pid=0; $state.worker_started=''
            $state.attempts += @{ provider=$state.provider; state=$outcome.state; snapshot=$state.snapshot; tests=@(); findings=@(); utc=[datetime]::UtcNow.ToString('o') }
            if ($outcome.state -ne 'available') {
                $state.phase='handoff'; $state.blocker=$outcome.state
                $index=[array]::IndexOf(@($policy.providers), $state.provider)
                if ($outcome.state -in @('rate_limited','quota_exhausted','auth_required','manual_handoff_required') -and $index -ge 0 -and $index+1 -lt $policy.providers.Count) {
                    $next=$policy.providers[$index+1]
                    $state.handoffs += @{ from=$state.provider; to=$next; reason=$outcome.state; snapshot=$state.snapshot; tests=@($state.tests); utc=[datetime]::UtcNow.ToString('o') }
                    $state.provider=$next
                    Save-GuardentraSupervisorState $state $statePath
                    # Release/reacquire the exclusive lease only AFTER the old process exited and handoff persisted.
                    $lease.ReleaseMutex(); $lease.Dispose(); $lease=$null
                    $lease=Enter-GuardentraSupervisorLease (Get-GuardentraGitCommonDir)
                    $state=Read-GuardentraSupervisorState $task $statePath
                    continue
                }
                $state.phase='owner_gate'; $state.owner_gate='provider remediation or explicit fallback policy'
                Save-GuardentraSupervisorState $state $statePath
                return $state
            }
            Assert-GuardentraProposal $outcome.proposal $task
            Assert-GuardentraAgentContractLive $contract $IssueNumber
            $state.phase='applying'; Save-GuardentraSupervisorState $state $statePath
            Set-GuardentraProposalFiles $outcome.proposal $task
            $state.snapshot=Get-GuardentraSupervisorSnapshot $task
            if (-not $state.snapshot.paths.Count) {
                $state.verification='MISSING'; $state.phase='owner_gate'; $state.owner_gate='no implementation changes produced'
                Save-GuardentraSupervisorState $state $statePath; return $state
            }
            $state.verification='IMPLEMENTED_LOCAL'; $state.phase='testing'; Save-GuardentraSupervisorState $state $statePath
            $testResult=Invoke-GuardentraRequiredTestsSafe $contract
            $diffCheck=Invoke-GuardentraGit -GitArgs @('diff','--check')
            Assert-GuardentraSnapshotEqual $state.snapshot (Get-GuardentraSupervisorSnapshot $task)
            $state.tests=@($testResult.Results) + @("git diff --check exit=$($diffCheck.ExitCode)")
            $state.attempts[-1].tests=@($state.tests)
            $state.attempts[-1].snapshot=$state.snapshot
            $failed=(-not $testResult.Passed -or $diffCheck.ExitCode -ne 0)
            $state.blocker=if ($failed) { 'deterministic tests failed; correct the supplied candidate' } else { '' }
            if (-not $failed -and $state.reviewer) {
                if ($state.reviewer -ceq $state.provider) { throw 'REFUSED: independent reviewer must differ from writer' }
                $state.phase='reviewing'; Save-GuardentraSupervisorState $state $statePath
                $review=Invoke-GuardentraProposalAdapter -Task $task -Tool $state.reviewer -Context (Get-GuardentraProviderContext $task $state.snapshot $state.tests) -Review -Heartbeat $heartbeat -Started $started
                Assert-GuardentraSnapshotEqual $state.snapshot (Get-GuardentraSupervisorSnapshot $task)
                $state.worker_pid=0; $state.worker_started=''
                if ($review.state -ne 'available') {
                    $state.phase='owner_gate'; $state.owner_gate='optional reviewer unavailable'; $state.blocker=$review.state
                    Save-GuardentraSupervisorState $state $statePath; return $state
                }
                Assert-GuardentraProposal $review.proposal $task -Review
                $state.attempts[-1].findings=@($review.proposal.findings)
                $findings=@($review.proposal.findings | Where-Object { $_.severity -in @('BLOCKER','HIGH') })
                $failed=$findings.Count -gt 0
                if ($failed) { $state.blocker=$findings | ConvertTo-Json -Depth 5 -Compress }
            }
            if ($failed) {
                $state.phase='correction'
                # Count durably before making the failed candidate resumable.
                # A crash before this write leaves testing/reviewing fail-closed.
                Register-GuardentraAttempt $contract $false $IssueNumber | Out-Null
                Save-GuardentraSupervisorState $state $statePath
                continue # Same provider for code/test/review corrections.
            }
            $state.phase='owner_gate'; $state.owner_gate='commit'; $state.verification='TESTED_LOCAL'
            Save-GuardentraSupervisorState $state $statePath
            return $state
        }
        throw 'REFUSED: bounded supervisor pass exhausted'
    } catch {
        if ($state) {
            $state.phase='blocked'; $state.blocker='supervisor refused; reconcile authority, worker, candidate, or correction budget'
            Save-GuardentraSupervisorState $state $statePath
        }
        throw
    } finally { if ($lease) { $lease.ReleaseMutex(); $lease.Dispose() } }
}

function Invoke-GuardentraNightRun {
    param([ValidateRange(1,1000)][int]$Passes=1, [ValidateRange(0,60)][int]$IntervalSeconds=0, [string]$Action='implement')
    if ($Action -cne 'implement') { throw 'REFUSED: night-run permits only local implementation and verification' }
    $reports=@(); $originalRoot=$script:GuardentraRoot; $originalStateRoot=$script:GuardentraStateRoot
    try {
      for ($pass=0; $pass -lt $Passes; $pass++) {
        $inventory=Invoke-GuardentraGit -GitArgs @('-c','core.quotepath=false','worktree','list','--porcelain')
        if ($inventory.ExitCode -ne 0) { throw 'REFUSED: registered worktree inventory unavailable' }
        $roots=@($inventory.Output -split '\r?\n' | Where-Object { $_.StartsWith('worktree ') } | ForEach-Object { $_.Substring(9) })
        foreach ($root in $roots) {
          # Discover only Git-registered pre-provisioned worktrees, never model-supplied paths.
          $script:GuardentraRoot=$root
          $script:GuardentraStateRoot=Join-Path $root 'scripts/guardentra/state/issues'
          foreach ($directory in @(Get-ChildItem -LiteralPath $script:GuardentraStateRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name)) {
              if ($directory.Name -notmatch '^[1-9][0-9]*$') { continue }
              try {
                  $result=Invoke-GuardentraSupervisorTask ([int]$directory.Name)
                  $reports += @{ issue=[int]$directory.Name; phase=$result.phase; gate=$result.owner_gate }
              } catch { $reports += @{ issue=[int]$directory.Name; phase='blocked'; gate='owner reconciliation'; reason='task refused; no unsafe action taken' } }
          }
        }
        $script:GuardentraRoot=$originalRoot; $script:GuardentraStateRoot=$originalStateRoot
        if ($pass+1 -lt $Passes -and $IntervalSeconds) { Start-Sleep -Seconds $IntervalSeconds }
      }
    } finally { $script:GuardentraRoot=$originalRoot; $script:GuardentraStateRoot=$originalStateRoot }
    return $reports
}

function Get-GuardentraSupervisorReport {
    param([ValidateSet('morning','midday','night')][string]$Period='morning')
    $tasks=@()
    foreach ($directory in @(Get-ChildItem -LiteralPath $script:GuardentraStateRoot -Directory -ErrorAction SilentlyContinue)) {
        $path=Join-Path $directory.FullName 'supervisor.json'
        if (-not (Test-Path -LiteralPath $path)) { continue }
        try {
            $state=Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
            $tasks += @{ issue=$state.issue; phase=$state.phase; writer=$state.provider; reviewer=$state.reviewer;
                branch=$state.snapshot.branch; head=$state.snapshot.head; tests=@($state.tests); verification=$state.verification;
                blockers=$state.blocker; owner_gate=$state.owner_gate; fallback=@($state.handoffs); provider_attempts=@($state.attempts);
                evidence='CACHED_UNVERIFIED'; ci='NOT RUN'; deployment='NOT DEPLOYED' }
        } catch { $tasks += @{ issue=$directory.Name; phase='blocked'; evidence='INVALID_CACHE' } }
    }
    return @{ schema='guardentra.report.v1'; period=$Period; utc=[datetime]::UtcNow.ToString('o'); tasks=$tasks; next_runnable_p0='requires live dispatch/dependency validation'; quota='unknown' }
}
