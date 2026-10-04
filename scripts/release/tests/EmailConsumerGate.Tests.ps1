Set-StrictMode -Version 2.0
$ErrorActionPreference='Stop'

$gate=Join-Path (Split-Path -Parent $PSScriptRoot) 'Test-EmailConsumerGate.ps1'
. $gate

$pass=0
$fail=0
function Assert-GE([bool]$Condition,[string]$Name) {
    if($Condition){$script:pass++;Write-Host "PASS $Name"}else{$script:fail++;Write-Host "FAIL $Name" -ForegroundColor Red}
}

$oldActive=[pscustomobject]@{
    status='success'
    result=[pscustomobject]@{
        instances=@(
            [pscustomobject]@{
                name='projects/p/instances/firestore-send-email'
                state='ACTIVE'
                config=[pscustomobject]@{ source=[pscustomobject]@{ spec=[pscustomobject]@{ name='firestore-send-email'; displayName='Trigger Email' } } }
            }
        )
    }
}
$newActive=[pscustomobject]@{
    status='success'
    result=@(
        [pscustomobject]@{
            instanceId='firestore-send-email'
            state='ACTIVE'
            extensionRef='firebase/firestore-send-email'
        }
    )
}
$none=[pscustomobject]@{ status='success'; result=@() }
$errored=[pscustomobject]@{
    status='success'
    result=@([pscustomobject]@{ instanceId='firestore-send-email'; state='ERRORED'; extensionRef='firebase/firestore-send-email' })
}

$directApi=[pscustomobject]@{
    instances=@(
        [pscustomobject]@{
            name='projects/guardentra-staging/instances/firestore-send-email'
            state='ACTIVE'
            config=[pscustomobject]@{
                source=[pscustomobject]@{
                    spec=[pscustomobject]@{
                        name='firestore-send-email'
                        displayName='Trigger Email'
                    }
                }
            }
        }
    )
}

$m=Get-GEManagedConsumerObservation $directApi
Assert-GE ($m.state -eq 'active' -and $m.instances -eq 1) 'parses direct Extensions API instances response'
$m=Get-GEManagedConsumerObservation $oldActive
Assert-GE ($m.state -eq 'active' -and $m.instances -eq 1) 'parses legacy result.instances ACTIVE extension'
$m=Get-GEManagedConsumerObservation $newActive
Assert-GE ($m.state -eq 'active' -and $m.instances -eq 1) 'parses current result array ACTIVE extension'
$m=Get-GEManagedConsumerObservation $none
Assert-GE ($m.state -eq 'disabled') 'absence is managed-disabled proof'
$m=Get-GEManagedConsumerObservation $errored
Assert-GE ($m.state -eq 'unknown') 'installed ERRORED extension is not treated as disabled'

$d=Test-GEEmailConsumerState -ManagedState active -WorkerState disabled -Target managed_extension
Assert-GE ($d.pass) 'managed target passes only with worker disabled'
$d=Test-GEEmailConsumerState -ManagedState disabled -WorkerState active -Target self_managed
Assert-GE ($d.pass) 'self-managed target passes only with extension absent'
$d=Test-GEEmailConsumerState -ManagedState disabled -WorkerState disabled -Target disabled
Assert-GE ($d.pass) 'disabled target passes with zero consumers'
$d=Test-GEEmailConsumerState -ManagedState active -WorkerState active -Target self_managed
Assert-GE (-not $d.pass -and $d.reason -match 'dual-consumer') 'dual active consumers refuse'
$d=Test-GEEmailConsumerState -ManagedState unknown -WorkerState disabled -Target managed_extension
Assert-GE (-not $d.pass) 'unknown managed state refuses'
$d=Test-GEEmailConsumerState -ManagedState disabled -WorkerState unknown -Target self_managed
Assert-GE (-not $d.pass) 'missing worker proof refuses'

$root=Join-Path ([IO.Path]::GetTempPath()) ('guardentra-email-gate-' + [guid]::NewGuid().ToString('n'))
try {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    $fresh=Join-Path $root 'worker.json'
    @{
        schema='guardentra.email_worker_state.v1'
        project_id='guardentra-staging'
        consumer='self_managed'
        state='disabled'
        observed_utc=[datetime]::UtcNow.ToString('o')
        source_sha=('a'*40)
    } | ConvertTo-Json | Set-Content -LiteralPath $fresh -Encoding UTF8
    $w=Read-GEWorkerEvidence -Path $fresh -ExpectedProject 'guardentra-staging' -MaxAgeMinutes 30
    Assert-GE ($w.state -eq 'disabled') 'fresh exact-project worker evidence accepted'

    $stale=Join-Path $root 'stale.json'
    @{
        schema='guardentra.email_worker_state.v1'
        project_id='guardentra-staging'
        consumer='self_managed'
        state='active'
        observed_utc=[datetime]::UtcNow.AddHours(-2).ToString('o')
        source_sha=('b'*40)
    } | ConvertTo-Json | Set-Content -LiteralPath $stale -Encoding UTF8
    $w=Read-GEWorkerEvidence -Path $stale -ExpectedProject 'guardentra-staging' -MaxAgeMinutes 30
    Assert-GE ($w.state -eq 'unknown') 'stale worker evidence refuses'

    $wrong=Read-GEWorkerEvidence -Path $fresh -ExpectedProject 'guardentra-prod' -MaxAgeMinutes 30
    Assert-GE ($wrong.state -eq 'unknown') 'wrong-project worker evidence refuses'
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Email consumer gate tests: $pass PASS / $fail FAIL"
if($fail -gt 0){exit 1}
