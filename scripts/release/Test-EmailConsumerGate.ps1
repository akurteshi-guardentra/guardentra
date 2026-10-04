[CmdletBinding()]
param(
    [string]$ProjectId = '',
    [ValidateSet('','managed_extension','self_managed','disabled')][string]$TargetConsumer = '',
    [string]$SourceSha = '',
    [string]$WorkerEvidencePath = '',
    [string]$FirebaseJsonPath = '',
    [string]$EvidenceOut = '',
    [ValidateRange(1,1440)][int]$MaxEvidenceAgeMinutes = 30
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Get-GEProperty {
    param($Object,[string]$Name,$Default=$null)
    if ($null -eq $Object) { return $Default }
    $p=$Object.PSObject.Properties[$Name]
    if ($null -eq $p -or $null -eq $p.Value) { return $Default }
    return $p.Value
}

function Get-GENested {
    param($Object,[string[]]$Path)
    $current=$Object
    foreach($segment in $Path) {
        $current=Get-GEProperty $current $segment $null
        if ($null -eq $current) { return $null }
    }
    return $current
}

function Get-GEExtensionInstances {
    param([Parameter(Mandatory=$true)]$FirebaseJson)
    $result=Get-GEProperty $FirebaseJson 'result' $null
    if ($null -eq $result) { throw 'REFUSED: firebase ext:list JSON missing result' }

    $instances=Get-GEProperty $result 'instances' $null
    if ($null -ne $instances) { return @($instances) }

    if ($result -is [System.Array]) { return @($result) }
    if ($result -is [System.Collections.IEnumerable] -and -not ($result -is [string]) -and $null -eq $result.PSObject.Properties['instances']) {
        return @($result)
    }

    return @()
}

function Test-GESendEmailInstance {
    param($Instance)
    $candidates=@(
        (Get-GEProperty $Instance 'instanceId' ''),
        (Get-GEProperty $Instance 'name' ''),
        (Get-GEProperty $Instance 'extensionRef' ''),
        (Get-GEProperty $Instance 'ref' ''),
        (Get-GENested $Instance @('config','source','spec','name')),
        (Get-GENested $Instance @('config','source','spec','displayName'))
    )
    foreach($value in $candidates) {
        if ([string]$value -match '(?i)(^|[/_-])firestore-send-email($|[/_-])|trigger email') { return $true }
    }
    return $false
}

function Get-GEManagedConsumerObservation {
    param([Parameter(Mandatory=$true)]$FirebaseJson)

    $matches=@(Get-GEExtensionInstances $FirebaseJson | Where-Object { Test-GESendEmailInstance $_ })
    if ($matches.Count -eq 0) {
        return [pscustomobject]@{ state='disabled'; instances=0; detail='no firestore-send-email extension instance listed' }
    }
    if ($matches.Count -ne 1) {
        return [pscustomobject]@{ state='unknown'; instances=$matches.Count; detail='multiple send-email extension instances listed' }
    }

    $instance=$matches[0]
    $state=[string](Get-GEProperty $instance 'state' '')
    if ([string]::IsNullOrWhiteSpace($state)) {
        $state=[string](Get-GENested $instance @('config','source','state'))
    }
    if ($state -eq 'ACTIVE') {
        return [pscustomobject]@{ state='active'; instances=1; detail='one ACTIVE firestore-send-email extension instance listed' }
    }

    # Installed-but-non-ACTIVE is deliberately unknown, not disabled. An errored or
    # transitional extension may still own deployed resources; absence is the only
    # safe disabled proof this gate accepts.
    return [pscustomobject]@{ state='unknown'; instances=1; detail='send-email extension installed but not proven absent/ACTIVE' }
}

function Read-GEWorkerEvidence {
    param([string]$Path,[string]$ExpectedProject,[int]$MaxAgeMinutes)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{ state='unknown'; detail='self-managed worker evidence missing'; observed_utc=''; source_sha='' }
    }

    try {
        $raw=Get-Content -LiteralPath $Path -Raw -Encoding UTF8
        $evidence=$raw | ConvertFrom-Json
    } catch {
        return [pscustomobject]@{ state='unknown'; detail='self-managed worker evidence unreadable'; observed_utc=''; source_sha='' }
    }

    if ([string](Get-GEProperty $evidence 'schema' '') -cne 'guardentra.email_worker_state.v1') {
        return [pscustomobject]@{ state='unknown'; detail='self-managed worker evidence schema invalid'; observed_utc=''; source_sha='' }
    }
    if ([string](Get-GEProperty $evidence 'project_id' '') -cne $ExpectedProject) {
        return [pscustomobject]@{ state='unknown'; detail='self-managed worker evidence project mismatch'; observed_utc=''; source_sha='' }
    }
    if ([string](Get-GEProperty $evidence 'consumer' '') -cne 'self_managed') {
        return [pscustomobject]@{ state='unknown'; detail='self-managed worker evidence consumer invalid'; observed_utc=''; source_sha='' }
    }

    $state=[string](Get-GEProperty $evidence 'state' '')
    if ($state -cnotin @('active','disabled')) {
        return [pscustomobject]@{ state='unknown'; detail='self-managed worker state unknown'; observed_utc=''; source_sha='' }
    }

    $observedText=[string](Get-GEProperty $evidence 'observed_utc' '')
    $observed=[datetime]::MinValue
    if (-not [datetime]::TryParse(
        $observedText,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AssumeUniversal,
        [ref]$observed
    )) {
        return [pscustomobject]@{ state='unknown'; detail='self-managed worker observation timestamp invalid'; observed_utc=''; source_sha='' }
    }

    $age=([datetime]::UtcNow-$observed.ToUniversalTime()).TotalMinutes
    if ($age -lt -1 -or $age -gt $MaxAgeMinutes) {
        return [pscustomobject]@{ state='unknown'; detail='self-managed worker evidence stale'; observed_utc=$observedText; source_sha=[string](Get-GEProperty $evidence 'source_sha' '') }
    }

    return [pscustomobject]@{
        state=$state
        detail='fresh self-managed worker evidence'
        observed_utc=$observed.ToUniversalTime().ToString('o')
        source_sha=[string](Get-GEProperty $evidence 'source_sha' '')
    }
}

function Test-GEEmailConsumerState {
    param(
        [Parameter(Mandatory=$true)][ValidateSet('active','disabled','unknown')][string]$ManagedState,
        [Parameter(Mandatory=$true)][ValidateSet('active','disabled','unknown')][string]$WorkerState,
        [Parameter(Mandatory=$true)][ValidateSet('managed_extension','self_managed','disabled')][string]$Target
    )

    if ($ManagedState -eq 'active' -and $WorkerState -eq 'active') {
        return [pscustomobject]@{ pass=$false; reason='dual-consumer state detected' }
    }
    if ($ManagedState -eq 'unknown' -or $WorkerState -eq 'unknown') {
        return [pscustomobject]@{ pass=$false; reason='consumer state is ambiguous or unproven' }
    }

    if ($Target -eq 'managed_extension') {
        $ok=($ManagedState -eq 'active' -and $WorkerState -eq 'disabled')
        return [pscustomobject]@{ pass=$ok; reason=if($ok){'exactly one managed consumer active'}else{'target managed_extension does not match observed state'} }
    }
    if ($Target -eq 'self_managed') {
        $ok=($ManagedState -eq 'disabled' -and $WorkerState -eq 'active')
        return [pscustomobject]@{ pass=$ok; reason=if($ok){'exactly one self-managed consumer active'}else{'target self_managed does not match observed state'} }
    }

    $ok=($ManagedState -eq 'disabled' -and $WorkerState -eq 'disabled')
    return [pscustomobject]@{ pass=$ok; reason=if($ok){'email consumption intentionally disabled'}else{'target disabled does not match observed state'} }
}

function Get-GEFirebaseObservationJson {
    param([string]$Project,[string]$JsonPath)

    if (-not [string]::IsNullOrWhiteSpace($JsonPath)) {
        if (-not (Test-Path -LiteralPath $JsonPath)) { throw 'REFUSED: Firebase JSON evidence file missing' }
        return (Get-Content -LiteralPath $JsonPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    }

    $firebase=Get-Command firebase -ErrorAction SilentlyContinue
    if ($null -eq $firebase) { throw 'REFUSED: Firebase CLI unavailable; live managed-consumer state cannot be proven' }

    $temp=Join-Path ([IO.Path]::GetTempPath()) ('guardentra-ext-list-' + [guid]::NewGuid().ToString('n') + '.json')
    try {
        & $firebase.Source ext:list --json --project $Project 1> $temp 2> $null
        if ($LASTEXITCODE -ne 0) { throw 'REFUSED: firebase ext:list failed; managed-consumer state unproven' }
        $raw=Get-Content -LiteralPath $temp -Raw -Encoding UTF8
        return ($raw | ConvertFrom-Json)
    } finally {
        Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    if ([string]::IsNullOrWhiteSpace($ProjectId)) { throw 'REFUSED: ProjectId is required' }
    if ($TargetConsumer -notin @('managed_extension','self_managed','disabled')) { throw 'REFUSED: TargetConsumer is required' }
    if ($SourceSha -notmatch '^[0-9a-f]{40}

    $firebaseJson=Get-GEFirebaseObservationJson -Project $ProjectId -JsonPath $FirebaseJsonPath
    $managed=Get-GEManagedConsumerObservation $firebaseJson
    $worker=Read-GEWorkerEvidence -Path $WorkerEvidencePath -ExpectedProject $ProjectId -MaxAgeMinutes $MaxEvidenceAgeMinutes
    $decision=Test-GEEmailConsumerState -ManagedState $managed.state -WorkerState $worker.state -Target $TargetConsumer

    $evidence=[ordered]@{
        schema='guardentra.email_consumer_gate.v1'
        observed_utc=[datetime]::UtcNow.ToString('o')
        project_id=$ProjectId
        source_sha=$SourceSha
        target_consumer=$TargetConsumer
        managed_extension=[ordered]@{
            state=$managed.state
            instances=$managed.instances
            detail=$managed.detail
        }
        self_managed=[ordered]@{
            state=$worker.state
            detail=$worker.detail
            observed_utc=$worker.observed_utc
            source_sha=$worker.source_sha
        }
        pass=[bool]$decision.pass
        reason=$decision.reason
        rollback_required='restore exactly one previously proven consumer; rerun this gate before traffic'
    }

    $json=$evidence | ConvertTo-Json -Depth 8
    if (-not [string]::IsNullOrWhiteSpace($EvidenceOut)) {
        $parent=Split-Path -Parent $EvidenceOut
        if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Set-Content -LiteralPath $EvidenceOut -Value $json -Encoding UTF8
    }

    # Safe summary only. Never print raw firebase extension configuration/params.
    Write-Host ("EMAIL_CONSUMER_GATE project={0} target={1} managed={2} worker={3} pass={4}" -f $ProjectId,$TargetConsumer,$managed.state,$worker.state,$decision.pass)
    Write-Host ("REASON: " + $decision.reason)

    if (-not $decision.pass) { exit 2 }
}
) { throw 'REFUSED: exact 40-character source SHA required' }

    $firebaseJson=Get-GEFirebaseObservationJson -Project $ProjectId -JsonPath $FirebaseJsonPath
    $managed=Get-GEManagedConsumerObservation $firebaseJson
    $worker=Read-GEWorkerEvidence -Path $WorkerEvidencePath -ExpectedProject $ProjectId -MaxAgeMinutes $MaxEvidenceAgeMinutes
    $decision=Test-GEEmailConsumerState -ManagedState $managed.state -WorkerState $worker.state -Target $TargetConsumer

    $evidence=[ordered]@{
        schema='guardentra.email_consumer_gate.v1'
        observed_utc=[datetime]::UtcNow.ToString('o')
        project_id=$ProjectId
        source_sha=$SourceSha
        target_consumer=$TargetConsumer
        managed_extension=[ordered]@{
            state=$managed.state
            instances=$managed.instances
            detail=$managed.detail
        }
        self_managed=[ordered]@{
            state=$worker.state
            detail=$worker.detail
            observed_utc=$worker.observed_utc
            source_sha=$worker.source_sha
        }
        pass=[bool]$decision.pass
        reason=$decision.reason
        rollback_required='restore exactly one previously proven consumer; rerun this gate before traffic'
    }

    $json=$evidence | ConvertTo-Json -Depth 8
    if (-not [string]::IsNullOrWhiteSpace($EvidenceOut)) {
        $parent=Split-Path -Parent $EvidenceOut
        if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Set-Content -LiteralPath $EvidenceOut -Value $json -Encoding UTF8
    }

    # Safe summary only. Never print raw firebase extension configuration/params.
    Write-Host ("EMAIL_CONSUMER_GATE project={0} target={1} managed={2} worker={3} pass={4}" -f $ProjectId,$TargetConsumer,$managed.state,$worker.state,$decision.pass)
    Write-Host ("REASON: " + $decision.reason)

    if (-not $decision.pass) { exit 2 }
}
