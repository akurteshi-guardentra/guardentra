# Offline transport-boundary regression tests. These are NOT live provider proof.
Write-Host '=== GuardEntra #90 provider contract tests ==='
$savedProcess=(Get-Item Function:Invoke-GuardentraProviderProcess).ScriptBlock
$savedBinding=(Get-Item Function:Get-GuardentraProviderBinding).ScriptBlock
$savedTestPath=Get-Item Function:Test-Path -ErrorAction SilentlyContinue
$savedEnv=@{}
foreach ($name in @('GEMINI_API_KEY','XAI_API_KEY','GUARDENTRA_GEMINI_MODEL','GUARDENTRA_XAI_MODEL')) {
    $savedEnv[$name]=[Environment]::GetEnvironmentVariable($name)
}
try {
    $script:probeMode='ok'; $script:probeCalls=@()
    function Get-GuardentraProviderBinding {
        param($Tool)
        $native='C:\fixture\' + $Tool + '.exe'
        if ($Tool -in @('grok','xai')) { $native='C:\fixture\grok.exe' }
        return [pscustomobject]@{ executable=$native; native=$native; prefix=@(); found=($script:probeMode -ne 'absent') }
    }
    function Invoke-GuardentraProviderProcess {
        param($Executable,$Arguments,$InputText,$Directory,$TimeoutSeconds,$Heartbeat,$Started,$EnvironmentOverrides)
        $script:probeCalls += ,@($Arguments)
        $run=[pscustomobject]@{ExitCode=0;Output='';Error='';TimedOut=$false}
        if ($script:probeMode -eq 'timeout' -or
            ($script:probeMode -eq 'timeout-auth' -and $Arguments -contains 'login') -or
            ($script:probeMode -eq 'timeout-version' -and $Arguments -contains '--version') -or
            ($script:probeMode -eq 'timeout-inventory' -and $Arguments -contains 'mcp')) { $run.ExitCode=-1; $run.TimedOut=$true; return $run }
        if ($Executable -eq 'C:\fixture\cursor.exe') {
            if ($Arguments -contains 'status') { $run.Output='{"isAuthenticated":false}'; return $run }
            $run.Output="Grok Build TUI"; return $run
        }
        if ($Executable -eq 'C:\fixture\grok.exe') {
            if ($Arguments -contains '--help') { $run.Output='Grok Build TUI --single --tools --disallowed-tools --deny --no-subagents --disable-web-search --max-turns --output-format'; return $run }
            if ($Arguments -contains '--version') { $run.Output='grok 1.0.34 (3736acbc8658)'; return $run }
            if ($Arguments -contains 'inspect') {
                $run.Output='{"hooks":[],"plugins":[],"mcpServers":[],"lspServers":[],"projectInstructions":[]}'
                if ($script:probeMode -eq 'grok-hook') { $run.Output='{"hooks":[{}],"plugins":[],"mcpServers":[],"lspServers":[],"projectInstructions":[]}' }
                if ($script:probeMode -eq 'grok-malformed') { $run.Output='{}' }
                return $run
            }
            if ($Arguments -contains '--single') { $run.Output='{"stopReason":"end_turn","text":"{\"files\":[],\"findings\":[]}"}'; return $run }
        }
        if ($Executable -eq 'C:\fixture\gcloud.exe') {
            if ($Arguments -contains '--version') { $run.Output='Google Cloud SDK 579.0.0'; return $run }
            $run.Output=switch ($script:probeMode) {
                'doctor-empty' { '[]' }
                'doctor-malformed' { 'private-doctor-sentinel' }
                default { '[{"status":"ACTIVE","account":"private-doctor-sentinel"}]' }
            }
            return $run
        }
        if ($Arguments -contains '--help') { $run.Output='--ignore-user-config --ignore-rules --ephemeral --sandbox'; return $run }
        if ($Arguments -contains 'login') {
            if ($script:probeMode -eq 'home') { $run.ExitCode=1; $run.Error='Could not find home directory' }
            if ($script:probeMode -eq 'auth') { $run.ExitCode=1; $run.Error='Not logged in' }
            return $run
        }
        if ($Arguments -contains '--version') {
            $run.Output=if ($script:probeMode -eq 'version') { 'codex-cli future' } else { 'codex-cli 0.154.0-alpha.6.2' }; return $run
        }
        if ($Arguments -contains 'mcp') {
            if ($script:probeMode -eq 'empty') { $run.Output='[]'; return $run }
            if ($script:probeMode -eq 'malformed') { $run.Output='{}'; return $run }
            if ($script:probeMode -eq 'inventory') { $run.ExitCode=1; return $run }
            $disabled=($Arguments -contains 'mcp_servers.fixture.enabled=false') -and $script:probeMode -ne 'enabled'
            $run.Output='[' + ([pscustomobject]@{ name='fixture'; enabled=(-not $disabled) } | ConvertTo-Json -Compress) + ']'
            return $run
        }
        if ($Arguments -contains 'exec') { $run.Output='{"files":[],"findings":[]}'; return $run }
        throw 'REFUSED: unexpected fixture invocation'
    }
    foreach ($case in @(
        @('absent','manual_handoff_required'), @('home','owner_action_required'),
        @('auth','auth_required'), @('version','owner_action_required'),
        @('inventory','failed'), @('enabled','failed'), @('malformed','failed'), @('empty','available'), @('ok','available')
    )) {
        $script:probeMode=$case[0]
        Assert-True ((Get-GuardentraProviderCapability codex).state -eq $case[1]) ('Codex capability ' + $case[0] + ' fails closed or verifies readiness')
    }
    $script:probeMode='ok'
    # Use the existing fixture task, independent of local ignored issue state in CI.
    $probeTask=$supervisorTask
    $result=Invoke-GuardentraProposalAdapter -Task $probeTask -Tool codex -Context 'offline fixture'
    Assert-True ($result.state -eq 'available' -and $result.proposal.files.Count -eq 0) 'common Codex adapter parses untrusted proposal'
    $execArgs=@($script:probeCalls | Where-Object { $_ -contains 'exec' })[-1]
    foreach ($required in @('--ignore-user-config','--ignore-rules','--ephemeral','read-only','never','shell_tool','apps','plugins','hooks','multi_agent','mcp_servers.fixture.enabled=false','mcp_servers.fixture.command="guardentra-disabled-mcp"')) {
        Assert-True ($execArgs -contains $required) ('Codex invocation retains confinement: ' + $required)
    }
    Assert-True (-not ($execArgs -contains '--dangerously-bypass-approvals-and-sandbox')) 'Codex never bypasses sandbox for unattended execution'
    $badTask=ConvertTo-GuardentraDataMap $probeTask; $badTask.access_tier='T4'
    $count=$script:probeCalls.Count
    Assert-Throws { Invoke-GuardentraProposalAdapter -Task $badTask -Tool codex -Context '' } 'adapter refuses invalid task before probing provider'
    Assert-True ($count -eq $script:probeCalls.Count) 'invalid task launches no subprocess'
    foreach ($provider in @('gemini','cloud')) {
        $cap=Get-GuardentraProviderCapability $provider
        Assert-True ($cap.state -eq 'owner_action_required' -and $cap.auth -eq 'unproven') "$provider installation is not auth/runtime proof"
        $outcome=Invoke-GuardentraProposalAdapter -Task $probeTask -Tool $provider -Context ''
        Assert-True ($outcome.state -eq 'owner_action_required' -and $null -eq $outcome.proposal) "$provider common adapter does not fabricate success"
    }
    foreach ($provider in @('grok','xai')) {
        $outcome=Invoke-GuardentraProposalAdapter -Task $probeTask -Tool $provider -Context 'fixture'
        Assert-True ($outcome.state -eq 'available' -and $outcome.proposal.files.Count -eq 0) "$provider native common adapter normalizes JSON envelope"
    }
    $grokArgs=@($script:probeCalls | Where-Object { $_ -contains '--single' })[-1]
    foreach ($required in @('--tools','read_file','--disallowed-tools','read_file,search_tool,use_tool,Agent','MCPTool','--no-subagents','--disable-web-search','dontAsk','--max-turns','--no-auto-update')) {
        Assert-True ($grokArgs -contains $required) ('Grok confinement: ' + $required)
    }
    Assert-True ((Get-GuardentraProviderCapability cursor).state -eq 'auth_required') 'Cursor status JSON false remains auth_required even on exit zero'
    foreach ($mode in @('grok-hook','grok-malformed')) {
        $script:probeMode=$mode; $script:probeCalls=@()
        $outcome=Invoke-GuardentraProposalAdapter -Task $probeTask -Tool grok -Context 'fixture'
        Assert-True ($outcome.state -eq 'owner_action_required') "Grok refuses unsafe inventory: $mode"
        Assert-True (@($script:probeCalls | Where-Object { $_ -contains '--single' }).Count -eq 0) 'unsafe Grok inventory launches no inference'
    }
    $script:probeMode='timeout'
    foreach ($provider in @('codex','grok','cursor')) {
        $outcome=Invoke-GuardentraProposalAdapter -Task $probeTask -Tool $provider -Context 'fixture'
        Assert-True ($outcome.state -ceq 'owner_action_required' -and $null -eq $outcome.proposal) "$provider metadata timeout cannot select a fallback"
    }
    foreach ($mode in @('timeout-auth','timeout-version','timeout-inventory')) {
        $script:probeMode=$mode
        Assert-True ((Get-GuardentraProviderCapability codex).state -ceq 'owner_action_required') "Codex $mode cannot select a fallback"
    }
    # Doctor must stay useful with unavailable CLIs and never serialize raw auth data.
    function Test-Path { param($LiteralPath,$PathType); return $false }
    $script:probeMode='doctor'
    $cursorObservation=Get-GuardentraCliObservation cursor
    Assert-True ($cursorObservation.observations[0].identity -eq 'Grok Build TUI' -and $cursorObservation.observations[0].verdict -eq 'NOT_AVAILABLE') 'doctor refuses Grok agent.exe as Cursor without headless execution'
    $observation=Get-GuardentraCliObservation gcloud
    Assert-True ($observation.observations[0].auth -eq 'not_probed') 'doctor never enumerates gcloud credentials'
    Assert-True (@($script:probeCalls | Where-Object { $_ -contains 'list' -and $_ -contains 'auth' }).Count -eq 0) 'no gcloud auth list invocation'
    $script:probeMode='doctor'
    $doctor=Get-GuardentraProviderDoctor
    Assert-True ($doctor.schema -eq 'guardentra.provider-doctor.v1' -and $doctor.providers.Count -eq 6) 'doctor exposes all first-class workers in machine-readable schema'
    Assert-True (@($doctor.providers | Where-Object { $_.state -cnotin $script:GuardentraProviderStates }).Count -eq 0) 'doctor verdict never becomes a provider state'
    Assert-True (@($doctor.providers | Where-Object { $_.real_run -ne 'NOT_RUN' }).Count -eq 0) 'doctor metadata never fabricates live inference'
    Assert-True (($doctor | ConvertTo-Json -Depth 12) -notmatch 'synthetic-test-value|private-doctor-sentinel') 'doctor emits credential presence without values or account details'
} finally {
    Set-Item Function:Invoke-GuardentraProviderProcess $savedProcess
    Set-Item Function:Get-GuardentraProviderBinding $savedBinding
    if ($savedTestPath) { Set-Item Function:Test-Path $savedTestPath.ScriptBlock }
    else { Remove-Item Function:Test-Path -ErrorAction SilentlyContinue }
    foreach ($name in $savedEnv.Keys) { [Environment]::SetEnvironmentVariable($name,$savedEnv[$name]) }
}
