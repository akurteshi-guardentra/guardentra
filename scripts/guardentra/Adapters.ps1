# GuardEntra tool adapter interface (#88 Phase C)
#
# Common contract every writer tool (Claude Code, Codex, Cursor, Grok,
# Google/Cloud, ...) would implement to be driven by the #88 runner:
#   CanRun()          -- capability detection only
#   StartTask(task)
#   ResumeTask(task, correction)
#   CollectResult()
#   Cancel()
#
# This slice never fakes support for a tool that lacks a reliable local
# non-interactive CLI/API, and -- more importantly -- never autonomously
# drives another AI tool's session at all: doing so would be an
# unsupervised, unbounded action outside every access-tier and Owner-gate
# control this dispatcher otherwise enforces. StartTask/ResumeTask/Cancel
# therefore always report `manual_handoff_required` in this slice.
# CanRun() stays false until an execution adapter is implemented and proven. Evidence
# collection (CollectResult, in spirit) is tool-agnostic -- it reads git
# and test state directly -- and lives in Commands.ps1's
# New-GuardentraAgentResultV1, not in a per-adapter stub.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-GuardentraAdapterCanRun {
    <#
      No autonomous execution adapter has been proven in this slice.
      Installed binaries, aliases, functions, and provider hints do not
      establish supported execution or authority.
    #>
    param([Parameter(Mandatory)][string]$Tool)
    return $false
}

function Invoke-GuardentraAdapterStartTask {
    <#
      StartTask(task): honestly reports why this slice never autonomously
      drives the tool, whether or not a local CLI was detected.
    #>
    param(
        [Parameter(Mandatory)][string]$Tool,
        $Task
    )
    return [pscustomobject]@{
        Status = 'manual_handoff_required'
        Detail = "no verified reliable non-interactive CLI/API for tool '$Tool' in this slice; hand off manually"
    }
}

function Invoke-GuardentraAdapterResumeTask {
    param([Parameter(Mandatory)][string]$Tool, $Task, $Correction)
    return [pscustomobject]@{
        Status = 'manual_handoff_required'
        Detail = "ResumeTask is not implemented for '$Tool' in this slice; hand off the correction packet manually"
    }
}

function Invoke-GuardentraAdapterCollectResult {
    <#
      Interface completeness only. Real evidence collection is tool-agnostic
      (git/tests, not adapter-specific) and lives in
      New-GuardentraAgentResultV1.
    #>
    param([Parameter(Mandatory)][string]$Tool)
    return [pscustomobject]@{
        Status = 'manual_handoff_required'
        Detail = "CollectResult is not adapter-specific in this slice; see New-GuardentraAgentResultV1"
    }
}

function Invoke-GuardentraAdapterCancel {
    param([Parameter(Mandatory)][string]$Tool)
    return [pscustomobject]@{
        Status = 'manual_handoff_required'
        Detail = "Cancel is not implemented for '$Tool' in this slice"
    }
}
