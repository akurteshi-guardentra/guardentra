# #69 deterministic release-readiness scorecard.
Set-StrictMode -Version 2.0
$ErrorActionPreference='Stop'

$script:GuardentraEngineeringWeights=[ordered]@{
    security=20
    core_lifecycle=25
    persistence=15
    infra_email_scanner_audit=15
    release_verification=10
    pilot_ux=5
    orchestration=10
}
$script:GuardentraProductionWeights=[ordered]@{
    tenant_auth=15
    core_lifecycle=15
    persistence=10
    malware_scanning=10
    notifications=10
    audit_recovery=10
    runtime_verification=10
    findings_remediation=10
    trust_legal=10
}
$script:GuardentraEngineeringMultipliers=[ordered]@{
    missing=0.0
    in_progress=0.25
    local_checkpoint=0.50
    pr_verified=0.75
    merged=1.0
}
$script:GuardentraProductionMultipliers=[ordered]@{
    missing=0.0
    local_only=0.25
    pr_verified=0.50
    staging_verified=0.75
    production_verified=1.0
}

function Get-GuardentraReadinessProperty {
    param([AllowNull()]$Object,[string]$Name,$Default=$null)
    if ($null -eq $Object) { return $Default }
    $p=$Object.PSObject.Properties[$Name]
    if ($p) { return $p.Value }
    return $Default
}

function Assert-GuardentraReadinessEvidenceItem {
    param($Item,[string]$StageType,[string]$Key)
    if ($null -eq $Item) { throw "REFUSED: readiness item '$Key' missing" }
    $map=ConvertTo-GuardentraDataMap $Item
    Assert-GuardentraExactKeys $map @('stage','sha','environment','evidence')

    $stage=[string]$map.stage
    $sha=[string]$map.sha
    $environment=[string]$map.environment
    if ($map.evidence -isnot [array]) { throw "REFUSED: readiness item '$Key' evidence must be an array" }
    foreach($e in @($map.evidence)) {
        if ($e -isnot [string] -or [string]::IsNullOrWhiteSpace($e) -or $e.Length -gt 2048) {
            throw "REFUSED: readiness item '$Key' has invalid evidence reference"
        }
        if ((Protect-GuardentraSecrets $e) -cne $e) { throw "REFUSED: readiness evidence contains secret-like content" }
    }

    if ($StageType -eq 'engineering') {
        if (-not $script:GuardentraEngineeringMultipliers.Contains($stage)) { throw "REFUSED: invalid engineering readiness stage '$stage'" }
        if ($environment) { throw "REFUSED: engineering readiness cannot imply runtime environment" }
    } else {
        if (-not $script:GuardentraProductionMultipliers.Contains($stage)) { throw "REFUSED: invalid production readiness stage '$stage'" }
        if ($stage -eq 'staging_verified' -and $environment -cne 'staging') { throw "REFUSED: staging readiness requires environment=staging" }
        if ($stage -eq 'production_verified' -and $environment -cne 'production') { throw "REFUSED: production readiness requires environment=production" }
        if ($stage -in @('missing','local_only','pr_verified') -and $environment) { throw "REFUSED: non-live production stage cannot claim runtime environment" }
    }

    if ($stage -ne 'missing') {
        if (-not (Test-GuardentraSha40 $sha)) { throw "REFUSED: readiness item '$Key' requires exact SHA" }
        if (@($map.evidence).Count -eq 0) { throw "REFUSED: readiness item '$Key' requires evidence" }
    } elseif ($sha -or $environment) {
        throw "REFUSED: missing readiness stage cannot claim SHA/environment proof"
    }
    return $map
}

function Get-GuardentraReadinessDimension {
    param($Items,[string]$StageType,$Weights,$Multipliers)
    $map=ConvertTo-GuardentraDataMap $Items
    Assert-GuardentraExactKeys $map @($Weights.Keys)
    $score=0.0
    $detail=[ordered]@{}
    foreach($key in $Weights.Keys) {
        $item=Assert-GuardentraReadinessEvidenceItem -Item $map[$key] -StageType $StageType -Key $key
        $stage=[string]$item.stage
        $multiplier=[double]$Multipliers[$stage]
        $points=[math]::Round(([double]$Weights[$key] * $multiplier),2)
        $score += $points
        $detail[$key]=[ordered]@{
            weight=[int]$Weights[$key]
            stage=$stage
            multiplier=$multiplier
            points=$points
            sha=[string]$item.sha
            environment=[string]$item.environment
            evidence=@($item.evidence)
        }
    }
    return [ordered]@{ score=[math]::Round($score,2); denominator=100; gates=$detail }
}

function Get-GuardentraOptionalPriorScore {
    param($Value,[string]$Name)
    if ($null -eq $Value -or [string]$Value -eq '') { return $null }
    try { $n=[double]$Value } catch { throw "REFUSED: $Name must be numeric or null" }
    if ($n -lt 0 -or $n -gt 100) { throw "REFUSED: $Name outside 0..100" }
    return $n
}

function Get-GuardentraReadinessScorecard {
    param($InputObject)
    $input=ConvertTo-GuardentraDataMap $InputObject
    Assert-GuardentraExactKeys $input @(
        'schema','engineering','production','p0_blockers','remaining_effort','current_release_state',
        'previous_engineering_score','previous_production_score'
    )
    if ([string]$input.schema -cne 'guardentra.readiness_input.v1') { throw 'REFUSED: readiness input schema mismatch' }
    if ($input.p0_blockers -isnot [int] -or [int]$input.p0_blockers -lt 0) { throw 'REFUSED: p0_blockers must be a non-negative integer' }
    if ($input.remaining_effort -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$input.remaining_effort)) { throw 'REFUSED: remaining_effort required' }
    if ([string]$input.current_release_state -cnotin @('LOCAL','PR','MERGED','STAGING','PRODUCTION')) { throw 'REFUSED: invalid current_release_state' }

    $engineering=Get-GuardentraReadinessDimension -Items $input.engineering -StageType engineering -Weights $script:GuardentraEngineeringWeights -Multipliers $script:GuardentraEngineeringMultipliers
    $production=Get-GuardentraReadinessDimension -Items $input.production -StageType production -Weights $script:GuardentraProductionWeights -Multipliers $script:GuardentraProductionMultipliers

    $priorEng=Get-GuardentraOptionalPriorScore $input.previous_engineering_score 'previous_engineering_score'
    $priorProd=Get-GuardentraOptionalPriorScore $input.previous_production_score 'previous_production_score'
    $engDelta=if ($null -eq $priorEng) { $null } else { [math]::Round(([double]$engineering.score-$priorEng),2) }
    $prodDelta=if ($null -eq $priorProd) { $null } else { [math]::Round(([double]$production.score-$priorProd),2) }

    return [ordered]@{
        schema='guardentra.readiness.v1'
        generated_utc=[datetime]::UtcNow.ToString('o')
        engineering_delivery=$engineering
        production_go_live=$production
        engineering_delta=$engDelta
        production_delta=$prodDelta
        current_release_state=[string]$input.current_release_state
        p0_blockers=[int]$input.p0_blockers
        remaining_effort=[string]$input.remaining_effort
        rules=@(
            'engineering score never substitutes for production score',
            'local commit is not live proof',
            'PR CI is not staging verification',
            'staging is not production',
            'runtime points require exact SHA/environment evidence'
        )
    }
}

function Invoke-GuardentraReadinessScorecardFile {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'REFUSED: readiness input file missing' }
    $raw=Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ($raw.Length -gt 262144) { throw 'REFUSED: readiness input too large' }
    try { $input=$raw | ConvertFrom-Json } catch { throw 'REFUSED: invalid readiness JSON' }
    return Get-GuardentraReadinessScorecard $input
}
