<#
.SYNOPSIS
  GuardEntra controlled local dispatcher / evidence CLI (#9C R4).

.DESCRIPTION
  Prepares feature branches and task packets, enforces fail-closed Owner
  authorization from GitHub GUARDENTRA_OWNER_GRANT records (local cache only;
  live revalidation on mutating gates). Local authorize cannot mint Owner
  authority. Author validation is identity allowlist only, not cryptography.

.EXAMPLE
  .\scripts\guardentra.ps1 start 59 cursor -Branch tooling/controlled-orchestration-pilot
  .\scripts\guardentra.ps1 sync-grants 59
  .\scripts\guardentra.ps1 evidence 59
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet(
        'start',
        'sync-grants',
        'authorize',
        'commit',
        'push-and-pr',
        'merge',
        'deploy-staging',
        'deploy-production',
        'evidence',
        'status',
        'task',
        'agent',
        'supervisor',
        'night-run',
        'observe',
        'runner',
        'runner-task',
        'providers',
        'provider-doctor',
        'report',
        'help'
    )]
    [string]$Command = 'help',

    [Parameter(Position = 1)]
    [string]$Arg1 = '',

    [Parameter(Position = 2)]
    [string]$Arg2 = '',

    [string]$Branch = '',
    [ValidateSet('T0', 'T1', 'T2')]
    [string]$AccessTier = 'T2',
    [string]$Message = '',
    [string]$Title = '',
    [string]$BodyFile = '',
    [int]$Pr = 0,
    [string]$Action = '',
    [ValidateRange(1,1000)][int]$Passes = 1,
    [ValidateRange(0,60)][int]$IntervalSeconds = 0,
    [switch]$Once,
    [switch]$NoPublish
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'guardentra\Commands.ps1')

function Show-GuardentraHelp {
    @"
GuardEntra dispatcher (#9C R4)

Usage:
  .\scripts\guardentra.ps1 start <issue> <writer> [-Branch name] [-AccessTier T0|T1|T2]
  .\scripts\guardentra.ps1 sync-grants <issue> [-Action commit|push-and-pr|merge|...]
  .\scripts\guardentra.ps1 commit <issue> [-Message msg]
  .\scripts\guardentra.ps1 push-and-pr <issue>
  .\scripts\guardentra.ps1 merge <issue> -Pr <n>
  .\scripts\guardentra.ps1 deploy-staging <issue>
  .\scripts\guardentra.ps1 deploy-production <issue>
  .\scripts\guardentra.ps1 evidence <issue>
  .\scripts\guardentra.ps1 status <issue>
  .\scripts\guardentra.ps1 task <issue>
  .\scripts\guardentra.ps1 agent run <issue>
  .\scripts\guardentra.ps1 agent status <issue>
  .\scripts\guardentra.ps1 agent watch
  .\scripts\guardentra.ps1 supervisor <issue>
  .\scripts\guardentra.ps1 night-run [-Passes 1] [-IntervalSeconds 0]
  .\scripts\guardentra.ps1 observe [provider[,provider]] [-IntervalSeconds 2] [-Once]
  .\scripts\guardentra.ps1 runner [-IntervalSeconds 30] [-Once] [-NoPublish]
  .\scripts\guardentra.ps1 runner-task [status|install|remove] [-IntervalSeconds 30]
  .\scripts\guardentra.ps1 providers
  .\scripts\guardentra.ps1 provider-doctor
  .\scripts\guardentra.ps1 report [morning|midday|night]

Owner grants: post ## GUARDENTRA_OWNER_GRANT JSON on the GitHub issue (allowlisted author), then sync-grants.
Local authorize cannot mint Owner authority. Local source=github-owner-grant alone is not authority.
Mutating gates revalidate live GitHub dispatch + exact grant nonce. Consumed/revoked nonces cannot replay.
commit-and-pr removed for this pilot (use commit, then push-and-pr with a fresh grant).
Fail closed. Autonomous push/merge/deploy: NO.
"@ | Write-Host
}

try {
    switch ($Command) {
        'help' { Show-GuardentraHelp }
        'start' {
            if (-not $Arg1 -or -not $Arg2) { throw 'Usage: start <issue> <writer>' }
            Invoke-GuardentraStart -IssueNumber ([int]$Arg1) -Writer $Arg2 -Branch $Branch -AccessTier $AccessTier | Out-Null
        }
        'sync-grants' {
            if (-not $Arg1) { throw 'Usage: sync-grants <issue> [-Action <gate>]' }
            Invoke-GuardentraSyncGrants -IssueNumber ([int]$Arg1) -Action $Action
        }
        'authorize' {
            if (-not $Arg1) { throw 'Usage: authorize is refused; use sync-grants' }
            Invoke-GuardentraAuthorize -IssueNumber ([int]$Arg1) -Gate $Arg2 -Pr $Pr
        }
        'commit' {
            if (-not $Arg1) { throw 'Usage: commit <issue>' }
            Invoke-GuardentraCommit -IssueNumber ([int]$Arg1) -Message $Message
        }
        'push-and-pr' {
            if (-not $Arg1) { throw 'Usage: push-and-pr <issue>' }
            Invoke-GuardentraPushAndPr -IssueNumber ([int]$Arg1) -Title $Title -BodyFile $BodyFile
        }
        'merge' {
            if (-not $Arg1) { throw 'Usage: merge <issue> -Pr <n>' }
            if ($Pr -le 0) { throw 'Usage: merge <issue> -Pr <n>' }
            Invoke-GuardentraMerge -IssueNumber ([int]$Arg1) -Pr $Pr
        }
        'deploy-staging' {
            if (-not $Arg1) { throw 'Usage: deploy-staging <issue>' }
            Invoke-GuardentraDeploy -IssueNumber ([int]$Arg1) -Environment staging
        }
        'deploy-production' {
            if (-not $Arg1) { throw 'Usage: deploy-production <issue>' }
            Invoke-GuardentraDeploy -IssueNumber ([int]$Arg1) -Environment production
        }
        'evidence' {
            if (-not $Arg1) { throw 'Usage: evidence <issue>' }
            Invoke-GuardentraEvidence -IssueNumber ([int]$Arg1) | Out-Null
        }
        'status' {
            if (-not $Arg1) { throw 'Usage: status <issue>' }
            Invoke-GuardentraStatus -IssueNumber ([int]$Arg1)
        }
        'task' {
            if (-not $Arg1) { throw 'Usage: task <issue>' }
            Invoke-GuardentraTask -IssueNumber ([int]$Arg1) | Out-Null
        }
        'agent' {
            switch ($Arg1) {
                'run' {
                    if (-not $Arg2) { throw 'Usage: agent run <issue>' }
                    Invoke-GuardentraAgentRun -IssueNumber ([int]$Arg2) | Out-Null
                }
                'status' {
                    if (-not $Arg2) { throw 'Usage: agent status <issue>' }
                    Invoke-GuardentraAgentStatus -IssueNumber ([int]$Arg2) | Out-Null
                }
                'watch' {
                    Invoke-GuardentraAgentWatch | Out-Null
                }
                default { throw 'Usage: agent <run|status|watch> [issue]' }
            }
        }
        'supervisor' {
            if (-not $Arg1) { throw 'Usage: supervisor <issue>' }
            Invoke-GuardentraSupervisorTask ([int]$Arg1) | ConvertTo-Json -Depth 20
        }
        'night-run' {
            $nightAction = if ($Action) { $Action } else { 'implement' }
            Invoke-GuardentraNightRun -Passes $Passes -IntervalSeconds $IntervalSeconds -Action $nightAction | ConvertTo-Json -Depth 20
        }
        'observe' {
            . (Join-Path $PSScriptRoot 'guardentra\Observe-LocalAgents.ps1')
            $refresh = if ($IntervalSeconds -gt 0) { $IntervalSeconds } else { 2 }
            Show-GuardentraObserver -RefreshSeconds $refresh -Provider $Arg1 -Once:$Once
        }
        'runner' {
            . (Join-Path $PSScriptRoot 'guardentra\Run-LocalSupervisor.ps1')
            $runnerInterval = if ($IntervalSeconds -gt 0) { $IntervalSeconds } else { 30 }
            Invoke-GuardentraPersistentRunner -IntervalSeconds $runnerInterval -Once:$Once -PublishCheckpoints:(-not $NoPublish)
        }
        'runner-task' {
            . (Join-Path $PSScriptRoot 'guardentra\Register-LocalRunnerTask.ps1')
            $runnerInterval = if ($IntervalSeconds -gt 0) { $IntervalSeconds } else { 30 }
            $taskAction = if ($Arg1) { $Arg1 } else { 'Status' }
            switch ($taskAction.ToLowerInvariant()) {
                'status' { Get-GuardentraRunnerTaskStatus | ConvertTo-Json -Depth 5 }
                'install' { Install-GuardentraRunnerScheduledTask -IntervalSeconds $runnerInterval | ConvertTo-Json -Depth 5 }
                'remove' { Remove-GuardentraRunnerScheduledTask | ConvertTo-Json -Depth 5 }
                default { throw 'Usage: runner-task [status|install|remove] [-IntervalSeconds 30]' }
            }
        }
        'providers' {
            @('codex','cursor','gemini','cloud','grok','xai') | ForEach-Object { Get-GuardentraProviderCapability $_ } | ConvertTo-Json -Depth 5
        }
        'provider-doctor' {
            Get-GuardentraProviderDoctor | ConvertTo-Json -Depth 12
        }
        'report' {
            $period = if ($Arg1) { $Arg1 } else { 'morning' }
            Get-GuardentraSupervisorReport -Period $period | ConvertTo-Json -Depth 20
        }
        default { Show-GuardentraHelp }
    }
    exit 0
}
catch {
    Write-Host "ERROR: $(Protect-GuardentraSecrets -Text $_.Exception.Message)"
    exit 1
}
