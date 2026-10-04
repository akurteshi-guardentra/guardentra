# #116: read-only staging/production authority inventory for the Owner-local runner.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:GuardentraCloudCommandProvider = $null
$script:GuardentraCloudEvidenceIssue = 116
$script:GuardentraCloudEvidenceRepo = 'akurteshi-guardentra/guardentra'

function Get-GuardentraCloudProjectId {
    param([ValidateSet('staging','production')][string]$Environment)
    if ($Environment -eq 'staging') { return 'guardentra-staging' }
    return 'guardentra-prod'
}

function Get-GuardentraCloudExecutable {
    param([ValidateSet('gcloud','firebase')][string]$Tool)
    foreach ($name in @("$Tool.cmd",$Tool)) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and -not [string]::IsNullOrWhiteSpace([string]$cmd.Path)) { return [string]$cmd.Path }
    }
    return ''
}

function Assert-GuardentraCloudReadOnlyCommand {
    param([string]$Tool,[string[]]$Arguments)
    if ($Tool -eq 'gcloud') {
        $key = (($Arguments | Select-Object -First 3) -join ' ')
        $allowed = @(
            'auth list --filter=status:ACTIVE',
            'projects describe',
            'tasks queues list',
            'compute instances list',
            'compute networks list',
            'compute networks subnets',
            'projects get-iam-policy',
            'sql instances list',
            'secrets list'
        )
        foreach ($prefix in $allowed) {
            if ($key.StartsWith($prefix,[StringComparison]::Ordinal)) { return $true }
        }
        throw 'REFUSED: unsupported gcloud command in read-only inventory'
    }
    if ($Tool -eq 'firebase') {
        if (
            $Arguments.Count -ge 1 -and
            ($Arguments[0] -ceq 'ext:list' -or $Arguments[0] -ceq 'apphosting:backends:list')
        ) { return $true }
        throw 'REFUSED: unsupported firebase command in read-only inventory'
    }
    throw 'REFUSED: unsupported cloud tool'
}

function Invoke-GuardentraCloudReadCommand {
    param([ValidateSet('gcloud','firebase')][string]$Tool,[string[]]$Arguments)
    Assert-GuardentraCloudReadOnlyCommand -Tool $Tool -Arguments $Arguments | Out-Null

    if ($script:GuardentraCloudCommandProvider) {
        return & $script:GuardentraCloudCommandProvider $Tool $Arguments
    }

    $exe = Get-GuardentraCloudExecutable -Tool $Tool
    if ([string]::IsNullOrWhiteSpace($exe)) {
        return [pscustomobject]@{ ExitCode=127; Output=''; Error="$Tool unavailable" }
    }

    try {
        $raw = & $exe @Arguments 2>&1
        $exit = $LASTEXITCODE
        return [pscustomobject]@{
            ExitCode = $exit
            Output = (($raw | ForEach-Object { [string]$_ }) -join [Environment]::NewLine)
            Error = ''
        }
    } catch {
        return [pscustomobject]@{ ExitCode=1; Output=''; Error=$_.Exception.Message }
    }
}

function Get-GuardentraCloudFailureState {
    param([int]$ExitCode,[string]$Text)
    if ($ExitCode -eq 0) { return 'available' }
    $safe = [string]$Text
    if ($safe -match 'invalid_rapt|reauth|login required|not logged in|credentials.*expired|auth.*required') { return 'auth_required' }
    if ($safe -match 'does not have permission|permission denied|PERMISSION_DENIED|forbidden|not authorized') { return 'read_refused' }
    if ($ExitCode -eq 127 -or $safe -match 'unavailable|not recognized|not found') { return 'tool_unavailable' }
    return 'failed'
}

function ConvertFrom-GuardentraCloudJson {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
    try {
        $obj = $Text | ConvertFrom-Json
        return @($obj)
    } catch {
        return @()
    }
}

function Get-GuardentraCloudPrincipalKind {
    $r = Invoke-GuardentraCloudReadCommand -Tool gcloud -Arguments @('auth','list','--filter=status:ACTIVE','--format=value(account)')
    if ($r.ExitCode -ne 0) { return 'unknown' }
    $account = ([string]$r.Output).Trim()
    if ([string]::IsNullOrWhiteSpace($account)) { return 'none' }
    if ($account -match '\.iam\.gserviceaccount\.com$') { return 'service_account' }
    if ($account -match '@') { return 'user' }
    return 'unknown'
}

function Get-GuardentraCloudProperty {
    param([AllowNull()]$Object,[string]$Name,$Default=$null)
    if ($null -eq $Object) { return $Default }
    $property=$Object.PSObject.Properties[$Name]
    if ($property) { return $property.Value }
    return $Default
}

function Get-GuardentraAppHostingSummary {
    param([string]$ProjectId)
    $r = Invoke-GuardentraCloudReadCommand -Tool firebase -Arguments @('apphosting:backends:list','--project',$ProjectId,'--json')
    $state = Get-GuardentraCloudFailureState -ExitCode $r.ExitCode -Text ([string]$r.Output + ' ' + [string]$r.Error)
    if ($state -ne 'available') {
        return [ordered]@{ result=$state; count=0; backends=@() }
    }
    try {
        $payload=([string]$r.Output) | ConvertFrom-Json
        $rows=Get-GuardentraCloudProperty $payload 'backends'
        if ($null -eq $rows) { $rows=Get-GuardentraCloudProperty $payload 'result' }
        if ($null -eq $rows) { $rows=$payload }
        $safe=@()
        foreach($row in @($rows)) {
            if ($null -eq $row) { continue }
            $id=Get-GuardentraCloudProperty $row 'id'
            if (-not $id) { $id=Get-GuardentraCloudProperty $row 'backendId' }
            $name=Get-GuardentraCloudProperty $row 'name'
            if (-not $id -and $name) { $id=([string]$name).Split('/')[-1] }
            $location=Get-GuardentraCloudProperty $row 'location'
            if (-not $location) { $location=Get-GuardentraCloudProperty $row 'region' }
            $stateValue=Get-GuardentraCloudProperty $row 'state'
            $safe += [ordered]@{
                id=if($id){[string]$id}else{'unknown'}
                location=if($location){([string]$location).Split('/')[-1]}else{'unknown'}
                state=if($stateValue){[string]$stateValue}else{'unknown'}
            }
        }
        return [ordered]@{ result='available'; count=$safe.Count; backends=$safe }
    } catch {
        return [ordered]@{ result='failed'; count=0; backends=@() }
    }
}

function Get-GuardentraSendEmailExtensionSummary {
    param([string]$ProjectId)
    $r = Invoke-GuardentraCloudReadCommand -Tool firebase -Arguments @('ext:list','--json','--project',$ProjectId)
    $state = Get-GuardentraCloudFailureState -ExitCode $r.ExitCode -Text ([string]$r.Output + ' ' + [string]$r.Error)
    if ($state -ne 'available') {
        return [ordered]@{ result=$state; state='unverified'; instance_count=0; instances=@() }
    }

    $rows=@()
    try {
        $payload = ([string]$r.Output) | ConvertFrom-Json
        $instances = Get-GuardentraCloudProperty $payload 'instances'
        $result = Get-GuardentraCloudProperty $payload 'result'
        if ($instances -is [array]) { $rows=@($instances) }
        elseif ($result -is [array]) { $rows=@($result) }
        elseif ($result) {
            $nestedInstances = Get-GuardentraCloudProperty $result 'instances'
            if ($nestedInstances -is [array]) { $rows=@($nestedInstances) }
            else { $rows=@($result) }
        }
    } catch {
        return [ordered]@{ result='failed'; state='unverified'; instance_count=0; instances=@() }
    }

    $safe=@()
    foreach($row in $rows) {
        $blob = ($row | ConvertTo-Json -Depth 8 -Compress)
        if ($blob -notmatch 'firestore-send-email|trigger email') { continue }
        $instanceRaw = Get-GuardentraCloudProperty $row 'instanceId'
        $nameRaw = Get-GuardentraCloudProperty $row 'name'
        $stateRaw = Get-GuardentraCloudProperty $row 'state'
        $extensionRaw = Get-GuardentraCloudProperty $row 'extensionRef'
        $refRaw = Get-GuardentraCloudProperty $row 'ref'
        $versionRaw = Get-GuardentraCloudProperty $row 'version'
        $instanceId = if ($instanceRaw) { [string]$instanceRaw } elseif ($nameRaw) { ([string]$nameRaw).Split('/')[-1] } else { 'unknown' }
        $rowState = if ($stateRaw) { [string]$stateRaw } else { 'UNKNOWN' }
        $extensionRef = if ($extensionRaw) { [string]$extensionRaw } elseif ($refRaw) { [string]$refRaw } else { 'unknown' }
        $version = if ($versionRaw) { [string]$versionRaw } else { 'unknown' }
        $safe += [ordered]@{ instance_id=$instanceId; state=$rowState; extension_ref=$extensionRef; version=$version }
    }
    $summaryState='absent'
    if ($safe.Count -gt 1) { $summaryState='ambiguous' }
    elseif ($safe.Count -eq 1) { $summaryState = if ([string]$safe[0].state -ceq 'ACTIVE') { 'active' } else { 'installed_not_active' } }
    return [ordered]@{ result='available'; state=$summaryState; instance_count=$safe.Count; instances=$safe }
}

function Get-GuardentraCloudEnvironmentInventory {
    param([ValidateSet('staging','production')][string]$Environment,[string]$RepositorySha='')

    $project = Get-GuardentraCloudProjectId -Environment $Environment
    if ([string]::IsNullOrWhiteSpace($RepositorySha)) {
        try { $RepositorySha = ([string](& git rev-parse HEAD 2>$null | Select-Object -First 1)).Trim() } catch { $RepositorySha='' }
    }

    $principalKind = Get-GuardentraCloudPrincipalKind
    $projectRead = Invoke-GuardentraCloudReadCommand -Tool gcloud -Arguments @('projects','describe',$project,'--format=value(projectId)')
    $projectState = Get-GuardentraCloudFailureState -ExitCode $projectRead.ExitCode -Text ([string]$projectRead.Output + ' ' + [string]$projectRead.Error)
    $readPass = $false
    if ($projectState -eq 'available') {
        $readPass = (([string]$projectRead.Output).Trim() -ceq $project)
        if (-not $readPass) { $projectState='failed' }
    }

    $result = [ordered]@{
        schema='guardentra.cloud_inventory.v1'
        observed_utc=[datetime]::UtcNow.ToString('o')
        environment=$Environment
        project_id=$project
        repository_sha=$RepositorySha
        principal_kind=$principalKind
        project_read=$projectState
        cloud_tasks=[ordered]@{ result='not_run'; count=0; queues=@() }
        compute=[ordered]@{ result='not_run'; count=0; instances=@() }
        cloud_sql=[ordered]@{ result='not_run'; count=0; instances=@() }
        app_hosting=[ordered]@{ result='not_run'; count=0; backends=@() }
        network=[ordered]@{ result='not_run'; network_count=0; networks=@(); subnet_count=0; subnets=@() }
        iam=[ordered]@{ result='not_run'; role_count=0; roles=@() }
        secret_references=[ordered]@{ result='not_run'; count=0; names=@() }
        send_email_extension=[ordered]@{ result='not_run'; state='unverified'; instance_count=0; instances=@() }
        secret_payloads_read=$false
        mutations_performed=$false
    }

    if (-not $readPass) { return $result }

    $queue = Invoke-GuardentraCloudReadCommand -Tool gcloud -Arguments @('tasks','queues','list','--project',$project,'--location','us-central1','--format=json(name,state)')
    $queueState = Get-GuardentraCloudFailureState -ExitCode $queue.ExitCode -Text ([string]$queue.Output + ' ' + [string]$queue.Error)
    if ($queueState -eq 'available') {
        $items=@(ConvertFrom-GuardentraCloudJson $queue.Output)
        $safe=@()
        foreach($item in $items) {
            if (-not $item) { continue }
            $safe += [ordered]@{ name=([string]$item.name).Split('/')[-1]; state=[string]$item.state }
        }
        $result.cloud_tasks=[ordered]@{ result='available'; count=$safe.Count; queues=$safe }
    } else { $result.cloud_tasks.result=$queueState }

    $compute = Invoke-GuardentraCloudReadCommand -Tool gcloud -Arguments @('compute','instances','list','--project',$project,'--format=json(name,zone,status)')
    $computeState = Get-GuardentraCloudFailureState -ExitCode $compute.ExitCode -Text ([string]$compute.Output + ' ' + [string]$compute.Error)
    if ($computeState -eq 'available') {
        $items=@(ConvertFrom-GuardentraCloudJson $compute.Output)
        $safe=@()
        foreach($item in $items) {
            if (-not $item) { continue }
            if ([string]$item.name -match 'clamav|scanner|malware') {
                $safe += [ordered]@{ name=[string]$item.name; zone=([string]$item.zone).Split('/')[-1]; status=[string]$item.status }
            }
        }
        $result.compute=[ordered]@{ result='available'; count=$safe.Count; instances=$safe }
    } else { $result.compute.result=$computeState }

    $sql = Invoke-GuardentraCloudReadCommand -Tool gcloud -Arguments @('sql','instances','list','--project',$project,'--format=json(name,region,state,databaseVersion)')
    $sqlState = Get-GuardentraCloudFailureState -ExitCode $sql.ExitCode -Text ([string]$sql.Output + ' ' + [string]$sql.Error)
    if ($sqlState -eq 'available') {
        $items=@(ConvertFrom-GuardentraCloudJson $sql.Output)
        $safe=@()
        foreach($item in $items) {
            if (-not $item) { continue }
            $safe += [ordered]@{ name=[string]$item.name; region=[string]$item.region; state=[string]$item.state; database_version=[string]$item.databaseVersion }
        }
        $result.cloud_sql=[ordered]@{ result='available'; count=$safe.Count; instances=$safe }
    } else { $result.cloud_sql.result=$sqlState }

    $result.app_hosting = Get-GuardentraAppHostingSummary -ProjectId $project

    $networks = Invoke-GuardentraCloudReadCommand -Tool gcloud -Arguments @('compute','networks','list','--project',$project,'--format=json(name,autoCreateSubnetworks)')
    $networkState = Get-GuardentraCloudFailureState -ExitCode $networks.ExitCode -Text ([string]$networks.Output + ' ' + [string]$networks.Error)
    $subnets = Invoke-GuardentraCloudReadCommand -Tool gcloud -Arguments @('compute','networks','subnets','list','--project',$project,'--format=json(name,region,network)')
    $subnetState = Get-GuardentraCloudFailureState -ExitCode $subnets.ExitCode -Text ([string]$subnets.Output + ' ' + [string]$subnets.Error)
    if ($networkState -eq 'available' -and $subnetState -eq 'available') {
        $safeNetworks=@()
        foreach($item in @(ConvertFrom-GuardentraCloudJson $networks.Output)) {
            if (-not $item) { continue }
            $safeNetworks += [ordered]@{ name=[string]$item.name; auto_subnets=[bool](Get-GuardentraCloudProperty $item 'autoCreateSubnetworks' $false) }
        }
        $safeSubnets=@()
        foreach($item in @(ConvertFrom-GuardentraCloudJson $subnets.Output)) {
            if (-not $item) { continue }
            $safeSubnets += [ordered]@{
                name=[string]$item.name
                region=([string]$item.region).Split('/')[-1]
                network=([string]$item.network).Split('/')[-1]
            }
        }
        $result.network=[ordered]@{
            result='available'
            network_count=$safeNetworks.Count
            networks=$safeNetworks
            subnet_count=$safeSubnets.Count
            subnets=$safeSubnets
        }
    } else {
        $result.network.result=if($networkState -ne 'available'){$networkState}else{$subnetState}
    }

    $iam = Invoke-GuardentraCloudReadCommand -Tool gcloud -Arguments @('projects','get-iam-policy',$project,'--format=json(bindings.role)')
    $iamState = Get-GuardentraCloudFailureState -ExitCode $iam.ExitCode -Text ([string]$iam.Output + ' ' + [string]$iam.Error)
    if ($iamState -eq 'available') {
        $roles=@()
        try {
            $payload=([string]$iam.Output) | ConvertFrom-Json
            foreach($binding in @(Get-GuardentraCloudProperty $payload 'bindings' @())) {
                $role=Get-GuardentraCloudProperty $binding 'role'
                if ($role) { $roles += [string]$role }
            }
            $roles=@($roles | Select-Object -Unique)
            $result.iam=[ordered]@{ result='available'; role_count=$roles.Count; roles=$roles }
        } catch { $result.iam.result='failed' }
    } else { $result.iam.result=$iamState }

    $secrets = Invoke-GuardentraCloudReadCommand -Tool gcloud -Arguments @('secrets','list','--project',$project,'--format=json(name)')
    $secretState = Get-GuardentraCloudFailureState -ExitCode $secrets.ExitCode -Text ([string]$secrets.Output + ' ' + [string]$secrets.Error)
    if ($secretState -eq 'available') {
        $items=@(ConvertFrom-GuardentraCloudJson $secrets.Output)
        $names=@()
        foreach($item in $items) {
            if (-not $item) { continue }
            $name=([string]$item.name).Split('/')[-1]
            if ($name -match 'AUDIT|SCANNER|CLAM|MALWARE|EMAIL|SMTP|SENDGRID|FIREBASE') { $names += $name }
        }
        $result.secret_references=[ordered]@{ result='available'; count=$names.Count; names=@($names | Select-Object -Unique) }
    } else { $result.secret_references.result=$secretState }

    $result.send_email_extension = Get-GuardentraSendEmailExtensionSummary -ProjectId $project
    return $result
}

function New-GuardentraCloudInventoryComment {
    param($Inventory)
    $rows=@()
    foreach($item in @($Inventory)) {
        $rows += [ordered]@{
            environment=$item.environment
            project_id=$item.project_id
            repository_sha=$item.repository_sha
            principal_kind=$item.principal_kind
            project_read=$item.project_read
            cloud_tasks_result=$item.cloud_tasks.result
            cloud_tasks_count=$item.cloud_tasks.count
            scanner_compute_result=$item.compute.result
            scanner_compute_count=$item.compute.count
            cloud_sql_result=$item.cloud_sql.result
            cloud_sql_count=$item.cloud_sql.count
            cloud_sql_instances=@($item.cloud_sql.instances | ForEach-Object { $_.name })
            app_hosting_result=$item.app_hosting.result
            app_hosting_backends=@($item.app_hosting.backends | ForEach-Object { $_.id })
            network_result=$item.network.result
            networks=@($item.network.networks | ForEach-Object { $_.name })
            subnets=@($item.network.subnets | ForEach-Object { $_.name })
            iam_result=$item.iam.result
            iam_roles=@($item.iam.roles)
            cloud_task_queues=@($item.cloud_tasks.queues | ForEach-Object { $_.name })
            scanner_compute=@($item.compute.instances | ForEach-Object { $_.name })
            secret_reference_result=$item.secret_references.result
            secret_reference_count=$item.secret_references.count
            send_email_result=$item.send_email_extension.result
            send_email_state=$item.send_email_extension.state
            secret_payloads_read=$false
            mutations_performed=$false
            observed_utc=$item.observed_utc
        }
    }
    return ('GUARDENTRA_CLOUD_INVENTORY v1' + [Environment]::NewLine + ($rows | ConvertTo-Json -Depth 6 -Compress))
}

function Get-GuardentraCloudInventoryDigest {
    param([string]$Text)
    $sha=[Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-','').ToLowerInvariant()
    } finally { $sha.Dispose() }
}

function Publish-GuardentraCloudInventory {
    param($Inventory,[string]$StateRoot='')
    $gh=Get-Command gh -ErrorAction SilentlyContinue
    if (-not $gh) { return $false }
    if ([string]::IsNullOrWhiteSpace($StateRoot)) {
        $StateRoot=Join-Path $PSScriptRoot 'state\cloud-authority'
    }
    New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null

    $body=New-GuardentraCloudInventoryComment -Inventory $Inventory
    $digest=Get-GuardentraCloudInventoryDigest ($body -replace '"observed_utc":"[^"]+"','"observed_utc":"<ignored>"')
    $ledger=Join-Path $StateRoot 'published.json'
    if (Test-Path -LiteralPath $ledger) {
        try {
            $prior=Get-Content -LiteralPath $ledger -Raw -Encoding UTF8 | ConvertFrom-Json
            if ([string]$prior.digest -ceq $digest) { return $true }
        } catch { }
    }

    $tmp=[IO.Path]::GetTempFileName()
    try {
        Set-Content -LiteralPath $tmp -Value $body -Encoding UTF8
        $output=& gh issue comment $script:GuardentraCloudEvidenceIssue --repo $script:GuardentraCloudEvidenceRepo --body-file $tmp 2>&1
        if ($LASTEXITCODE -ne 0) { return $false }
        [ordered]@{ schema='guardentra.cloud_inventory_publish.v1'; digest=$digest; published_utc=[datetime]::UtcNow.ToString('o') } |
            ConvertTo-Json -Compress | Set-Content -LiteralPath $ledger -Encoding UTF8
        return $true
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-GuardentraCloudAuthorityInventory {
    [CmdletBinding()]
    param(
        [ValidateSet('all','staging','production')][string]$Environment='all',
        [switch]$Publish
    )

    $sha=''
    try { $sha=([string](& git rev-parse HEAD 2>$null | Select-Object -First 1)).Trim() } catch { }
    $targets = if ($Environment -eq 'all') { @('staging','production') } else { @($Environment) }
    $inventory=@()
    foreach($target in $targets) {
        $inventory += ,(Get-GuardentraCloudEnvironmentInventory -Environment $target -RepositorySha $sha)
    }
    if ($Publish) { [void](Publish-GuardentraCloudInventory -Inventory $inventory) }
    return $inventory
}
