# #116 cloud inventory tests. Requires Assert-True/Assert-Throws from Run-Tests.ps1.
. (Join-Path $PSScriptRoot '..\CloudAuthorityInventory.ps1')

Write-Host '=== GuardEntra #116 cloud authority inventory tests ==='

$priorProvider=$script:GuardentraCloudCommandProvider
try {
    $script:GuardentraCloudCommandProvider = {
        param($Tool,$Arguments)
        $joined=$Arguments -join ' '
        if ($Tool -eq 'gcloud' -and $joined -like 'auth list*') {
            return [pscustomobject]@{ExitCode=0;Output='owner@example.invalid';Error=''}
        }
        if ($Tool -eq 'gcloud' -and $joined -like 'projects describe guardentra-staging*') {
            return [pscustomobject]@{ExitCode=0;Output='guardentra-staging';Error=''}
        }
        if ($Tool -eq 'gcloud' -and $joined -like 'projects describe guardentra-prod*') {
            return [pscustomobject]@{ExitCode=1;Output='';Error='The caller does not have permission'}
        }
        if ($Tool -eq 'gcloud' -and $joined -like 'tasks queues list*') {
            return [pscustomobject]@{ExitCode=0;Output='[{"name":"projects/x/locations/us-central1/queues/evidence-malware-scan","state":"RUNNING"}]';Error=''}
        }
        if ($Tool -eq 'gcloud' -and $joined -like 'compute instances list*') {
            return [pscustomobject]@{ExitCode=0;Output='[{"name":"guardentra-staging-clamav-01","zone":"projects/x/zones/us-central1-a","status":"RUNNING"},{"name":"other-vm","zone":"projects/x/zones/us-central1-a","status":"RUNNING"}]';Error=''}
        }
        if ($Tool -eq 'gcloud' -and $joined -like 'sql instances list*') {
            return [pscustomobject]@{ExitCode=0;Output='[{"name":"audit-staging","region":"us-central1","state":"RUNNABLE","databaseVersion":"POSTGRES_15"}]';Error=''}
        }
        if ($Tool -eq 'gcloud' -and $joined -like 'compute networks list*') {
            return [pscustomobject]@{ExitCode=0;Output='[{"name":"guardentra-vpc","autoCreateSubnetworks":false}]';Error=''}
        }
        if ($Tool -eq 'gcloud' -and $joined -like 'compute networks subnets list*') {
            return [pscustomobject]@{ExitCode=0;Output='[{"name":"guardentra-private","region":"projects/x/regions/us-central1","network":"projects/x/global/networks/guardentra-vpc"}]';Error=''}
        }
        if ($Tool -eq 'gcloud' -and $joined -like 'projects get-iam-policy*') {
            return [pscustomobject]@{ExitCode=0;Output='{"bindings":[{"role":"roles/cloudsql.client"},{"role":"roles/secretmanager.secretAccessor"}]}';Error=''}
        }
        if ($Tool -eq 'gcloud' -and $joined -like 'secrets list*') {
            return [pscustomobject]@{ExitCode=0;Output='[{"name":"projects/x/secrets/AUDIT_DATABASE_URL"},{"name":"projects/x/secrets/unrelated"}]';Error=''}
        }
        if ($Tool -eq 'firebase' -and $joined -like 'apphosting:backends:list*guardentra-staging*') {
            return [pscustomobject]@{ExitCode=0;Output='{"result":[{"id":"guardentra-staging","location":"us-central1","state":"ACTIVE"}]}';Error=''}
        }
        if ($Tool -eq 'firebase' -and $joined -like 'ext:list*guardentra-staging*') {
            return [pscustomobject]@{ExitCode=0;Output='{"result":[{"instanceId":"mail-prod","state":"ACTIVE","extensionRef":"firebase/firestore-send-email","version":"0.2.4"}]}';Error=''}
        }
        if ($Tool -eq 'firebase') {
            return [pscustomobject]@{ExitCode=1;Output='';Error='permission denied'}
        }
        return [pscustomobject]@{ExitCode=1;Output='';Error='unexpected fixture command'}
    }

    $staging=Get-GuardentraCloudEnvironmentInventory -Environment staging -RepositorySha ('a'*40)
    Assert-True ($staging.project_read -eq 'available') '#116 staging project read available'
    Assert-True ($staging.principal_kind -eq 'user') '#116 principal is classified without raw account persistence'
    Assert-True ($staging.cloud_tasks.count -eq 1) '#116 staging queue inventory count'
    Assert-True ($staging.compute.count -eq 1) '#116 scanner compute filter excludes unrelated VM'
    Assert-True ($staging.cloud_sql.count -eq 1) '#116 Cloud SQL inventory count'
    Assert-True ($staging.app_hosting.count -eq 1) '#116 App Hosting inventory count'
    Assert-True ($staging.network.network_count -eq 1 -and $staging.network.subnet_count -eq 1) '#116 VPC/subnet inventory count'
    Assert-True ($staging.iam.role_count -eq 2) '#116 IAM inventory stores role names only'
    Assert-True ($staging.secret_references.count -eq 1) '#116 secret inventory stores matching names only'
    Assert-True ($staging.send_email_extension.state -eq 'active') '#116 send-email extension sanitized state'
    Assert-True (-not $staging.secret_payloads_read -and -not $staging.mutations_performed) '#116 evidence declares no secret payload reads or mutations'

    $prod=Get-GuardentraCloudEnvironmentInventory -Environment production -RepositorySha ('b'*40)
    Assert-True ($prod.project_read -eq 'read_refused') '#116 production permission denial is BLOCKED/read_refused, not absence'
    Assert-True ($prod.cloud_tasks.result -eq 'not_run') '#116 no downstream resource inference after project read refusal'

    $comment=New-GuardentraCloudInventoryComment -Inventory @($staging,$prod)
    Assert-True ($comment -notmatch 'owner@example') '#116 published comment never includes raw principal identifier'
    Assert-True ($comment -notmatch 'AUDIT_DATABASE_URL') '#116 published comment exposes secret-reference count, not names'
    Assert-True ($comment -notmatch 'owner@example') '#116 published comment never exposes principal identifier'
    Assert-True ($comment -match 'guardentra-vpc') '#116 safe network identifier is published'
    Assert-True ($comment -match 'guardentra-staging') '#116 safe App Hosting backend identifier is published'
    Assert-True ($comment -match 'roles/cloudsql.client') '#116 IAM role names are published without members'
    Assert-True ($comment -match 'guardentra-staging' -and $comment -match 'guardentra-prod') '#116 comment binds both exact target projects'

    Assert-Throws { Assert-GuardentraCloudReadOnlyCommand -Tool gcloud -Arguments @('projects','delete','guardentra-prod') } '#116 mutating gcloud command refused'
    Assert-True (Assert-GuardentraCloudReadOnlyCommand -Tool firebase -Arguments @('apphosting:backends:list','--project','guardentra-staging','--json')) '#116 App Hosting list is permitted'
    Assert-True (Assert-GuardentraCloudReadOnlyCommand -Tool gcloud -Arguments @('projects','get-iam-policy','guardentra-staging','--format=json(bindings.role)')) '#116 IAM get policy is permitted'
    Assert-Throws { Assert-GuardentraCloudReadOnlyCommand -Tool firebase -Arguments @('deploy','--project','guardentra-prod') } '#116 mutating firebase command refused'
}
finally {
    $script:GuardentraCloudCommandProvider=$priorProvider
}
