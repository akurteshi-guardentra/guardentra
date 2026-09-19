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
    [string]$Action = ''
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
        default { Show-GuardentraHelp }
    }
    exit 0
}
catch {
    Write-Host "ERROR: $(Protect-GuardentraSecrets -Text $_.Exception.Message)"
    exit 1
}
