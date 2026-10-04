# #69 deterministic readiness tests. Uses Assert-True/Assert-Throws from Run-Tests.ps1.
. (Join-Path $PSScriptRoot '..\ReadinessScorecard.ps1')

Write-Host '=== GuardEntra #69 readiness scorecard tests ==='

function New-ReadinessItem {
    param([string]$Stage,[string]$Sha='',[string]$Environment='',[string[]]$Evidence=@())
    return [pscustomobject]@{stage=$Stage;sha=$Sha;environment=$Environment;evidence=@($Evidence)}
}
function New-ReadinessInput {
    param([string]$EngineeringStage='missing',[string]$ProductionStage='missing')
    $eng=[ordered]@{}
    foreach($k in $script:GuardentraEngineeringWeights.Keys) {
        if ($EngineeringStage -eq 'missing') { $eng[$k]=New-ReadinessItem missing }
        else { $eng[$k]=New-ReadinessItem $EngineeringStage ('a'*40) '' @('repo/ci evidence') }
    }
    $prod=[ordered]@{}
    foreach($k in $script:GuardentraProductionWeights.Keys) {
        if ($ProductionStage -eq 'missing') { $prod[$k]=New-ReadinessItem missing }
        elseif ($ProductionStage -eq 'staging_verified') { $prod[$k]=New-ReadinessItem $ProductionStage ('b'*40) staging @('staging live evidence') }
        elseif ($ProductionStage -eq 'production_verified') { $prod[$k]=New-ReadinessItem $ProductionStage ('c'*40) production @('production live evidence') }
        else { $prod[$k]=New-ReadinessItem $ProductionStage ('b'*40) '' @('repo evidence') }
    }
    return [pscustomobject]@{
        schema='guardentra.readiness_input.v1'
        engineering=$eng
        production=$prod
        p0_blockers=3
        remaining_effort='4-7 developer-days'
        current_release_state='MERGED'
        previous_engineering_score=$null
        previous_production_score=$null
    }
}

$zero=Get-GuardentraReadinessScorecard (New-ReadinessInput)
Assert-True ($zero.engineering_delivery.score -eq 0) '#69 zero engineering evidence scores 0/100'
Assert-True ($zero.production_go_live.score -eq 0) '#69 zero production evidence scores 0/100'

$full=Get-GuardentraReadinessScorecard (New-ReadinessInput -EngineeringStage merged -ProductionStage production_verified)
Assert-True ($full.engineering_delivery.score -eq 100) '#69 merged engineering evidence scores 100/100'
Assert-True ($full.production_go_live.score -eq 100) '#69 production-live evidence scores 100/100'

$staging=Get-GuardentraReadinessScorecard (New-ReadinessInput -EngineeringStage pr_verified -ProductionStage staging_verified)
Assert-True ($staging.engineering_delivery.score -eq 75) '#69 engineering PR stage scores weighted 75/100'
Assert-True ($staging.production_go_live.score -eq 75) '#69 staging-live production stage scores weighted 75/100'

$bad=New-ReadinessInput -EngineeringStage merged
$bad.engineering.security.evidence=@()
Assert-Throws { Get-GuardentraReadinessScorecard $bad | Out-Null } '#69 non-missing score refuses absent evidence'

$badProd=New-ReadinessInput -ProductionStage production_verified
$badProd.production.malware_scanning.environment='staging'
Assert-Throws { Get-GuardentraReadinessScorecard $badProd | Out-Null } '#69 production-live score refuses staging environment'

$roadmap=New-ReadinessInput
$roadmap.engineering.security=New-ReadinessItem 'done' ('a'*40) '' @('roadmap says done')
Assert-Throws { Get-GuardentraReadinessScorecard $roadmap | Out-Null } '#69 roadmap done is not a recognized evidence stage'

$delta=New-ReadinessInput -EngineeringStage pr_verified -ProductionStage local_only
$delta.previous_engineering_score=50
$delta.previous_production_score=20
$d=Get-GuardentraReadinessScorecard $delta
Assert-True ($d.engineering_delta -eq 25) '#69 engineering delta computed from explicit prior score'
Assert-True ($d.production_delta -eq 5) '#69 production delta computed from explicit prior score'
