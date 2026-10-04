[CmdletBinding()]
param(
    [ValidateSet('Status','Install','Remove')][string]$Action = 'Status',
    [ValidateRange(5,3600)][int]$IntervalSeconds = 30
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:GuardentraRunnerTaskName = 'GuardEntra Local Supervisor'

function Get-GuardentraRunnerTaskSpec {
    param([ValidateRange(5,3600)][int]$IntervalSeconds = 30)

    $runner = Join-Path $PSScriptRoot 'Run-LocalSupervisor.ps1'
    $powershell = Join-Path $PSHOME 'powershell.exe'
    if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) {
        throw 'REFUSED: local runner script is missing'
    }
    if (-not (Test-Path -LiteralPath $powershell -PathType Leaf)) {
        throw 'REFUSED: Windows PowerShell executable is missing'
    }

    $quotedRunner = '"' + $runner.Replace('"','""') + '"'
    return [pscustomobject][ordered]@{
        task_name = $script:GuardentraRunnerTaskName
        executable = $powershell
        arguments = "-NoProfile -ExecutionPolicy Bypass -File $quotedRunner -IntervalSeconds $IntervalSeconds"
        working_directory = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
        interval_seconds = $IntervalSeconds
        run_level = 'Limited'
        logon_type = 'Interactive'
        stores_password = $false
    }
}

function Get-GuardentraRunnerTaskStatus {
    $cmd = Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue
    if (-not $cmd) {
        return [pscustomobject]@{
            task_name=$script:GuardentraRunnerTaskName
            installed=$false
            state='TASK_SCHEDULER_CMDLETS_UNAVAILABLE'
        }
    }

    $task = Get-ScheduledTask -TaskName $script:GuardentraRunnerTaskName -ErrorAction SilentlyContinue
    if (-not $task) {
        return [pscustomobject]@{
            task_name=$script:GuardentraRunnerTaskName
            installed=$false
            state='NOT_INSTALLED'
        }
    }

    return [pscustomobject]@{
        task_name=$script:GuardentraRunnerTaskName
        installed=$true
        state=[string]$task.State
        task_path=[string]$task.TaskPath
    }
}

function Install-GuardentraRunnerScheduledTask {
    param([ValidateRange(5,3600)][int]$IntervalSeconds = 30)

    foreach ($name in @('New-ScheduledTaskAction','New-ScheduledTaskTrigger','New-ScheduledTaskPrincipal','New-ScheduledTaskSettingsSet','Register-ScheduledTask')) {
        if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
            throw "REFUSED: Windows Task Scheduler cmdlet unavailable: $name"
        }
    }

    $spec = Get-GuardentraRunnerTaskSpec -IntervalSeconds $IntervalSeconds
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    if ([string]::IsNullOrWhiteSpace($identity)) {
        throw 'REFUSED: current Windows identity unavailable'
    }

    $taskAction = New-ScheduledTaskAction -Execute $spec.executable -Argument $spec.arguments -WorkingDirectory $spec.working_directory
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
    $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

    Register-ScheduledTask -TaskName $spec.task_name -Action $taskAction -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

    return [pscustomobject]@{
        task_name=$spec.task_name
        installed=$true
        identity=$identity
        run_level=$spec.run_level
        stores_password=$false
        interval_seconds=$spec.interval_seconds
    }
}

function Remove-GuardentraRunnerScheduledTask {
    if (-not (Get-Command Unregister-ScheduledTask -ErrorAction SilentlyContinue)) {
        throw 'REFUSED: Windows Task Scheduler cmdlet unavailable'
    }

    $existing = Get-ScheduledTask -TaskName $script:GuardentraRunnerTaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $script:GuardentraRunnerTaskName -Confirm:$false
    }
    return [pscustomobject]@{
        task_name=$script:GuardentraRunnerTaskName
        installed=$false
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    switch ($Action) {
        'Status' { Get-GuardentraRunnerTaskStatus | ConvertTo-Json -Depth 5 }
        'Install' { Install-GuardentraRunnerScheduledTask -IntervalSeconds $IntervalSeconds | ConvertTo-Json -Depth 5 }
        'Remove' { Remove-GuardentraRunnerScheduledTask | ConvertTo-Json -Depth 5 }
    }
}
