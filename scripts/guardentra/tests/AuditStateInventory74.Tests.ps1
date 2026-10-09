$ErrorActionPreference = 'Stop'
$geCollector = Join-Path (Split-Path $PSScriptRoot -Parent) 'Get-AuditStateInventory74.ps1'
$geTempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('ge-audit-test-' + [Guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($geTempRoot) | Out-Null
$global:geInventoryCalls = [System.Collections.Generic.List[object]]::new()
$global:geInventoryFailRole = $false

function Assert-GeInventory {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

# Mock every CLI call; unknown commands fail instead of reaching Google Cloud.
function global:gcloud {
    $geCallArgs = @($args)
    $global:geInventoryCalls.Add($geCallArgs)
    $global:LASTEXITCODE = 0
    if ($geCallArgs -notcontains '--quiet' -or $geCallArgs -notcontains '--format=json') { throw 'Missing output guards' }
    $geCommand = $geCallArgs[0..2] -join ' '
    if ($geCommand -eq 'iam roles describe') {
        if ($geCallArgs -contains '--project=guardentra-staging' -or @($geCallArgs | Where-Object { $_ -like '--organization*' }).Count -gt 0) {
            throw 'Predefined role must not receive project/organization scope'
        }
        if ($geCallArgs -notcontains '--billing-project=guardentra-staging') { throw 'Missing explicit quota project' }
        if ($global:geInventoryFailRole) { $global:LASTEXITCODE = 1; return }
        switch ($geCallArgs[3]) {
            'roles/datastore.user' { return '{"name":"roles/datastore.user","includedPermissions":["datastore.entities.get"]}' }
            'roles/firebase.admin' { return '{"name":"roles/firebase.admin","includedPermissions":["storage.objects.get","storage.objects.create","firebase.projects.get"]}' }
            'roles/storage.objectViewer' { return '{"name":"roles/storage.objectViewer","includedPermissions":["storage.objects.get","storage.objects.list"]}' }
            default { throw 'Unexpected role' }
        }
    }
    if ($geCallArgs -notcontains '--project=guardentra-staging') { throw 'Missing resource project guard' }
    switch ($geCommand) {
        'auth list --filter=status:ACTIVE' { return '[{"account":"admin@guardentra.com","status":"ACTIVE"}]' }
        'projects describe guardentra-staging' { return '{"projectId":"guardentra-staging","projectNumber":"965959469996"}' }
        'projects get-iam-policy guardentra-staging' {
            return '{"bindings":[{"role":"roles/datastore.user","members":["serviceAccount:firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com"]},{"role":"roles/firebase.admin","members":["serviceAccount:firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com"]},{"role":"roles/storage.objectViewer","members":["serviceAccount:firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com"]},{"role":"roles/storage.objectViewer","condition":{"title":"fixture"},"members":["serviceAccount:firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com"]},{"role":"roles/owner","members":["user:admin@guardentra.com"]}]}'
        }
        'iam service-accounts describe' {
            if ($geCallArgs[3] -ne 'firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com') { throw 'Wrong runtime' }
            return '{"email":"firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com"}'
        }
        default { throw ('Unapproved command: ' + $geCommand) }
    }
}

try {
    $geReportPath = Join-Path $geTempRoot 'inventory.json'
    & $geCollector -ReportPath $geReportPath | Out-Null
    $geReport = Get-Content -LiteralPath $geReportPath -Raw | ConvertFrom-Json
    Assert-GeInventory ($geReport.project.projectId -eq 'guardentra-staging') 'Wrong report project'
    Assert-GeInventory ($geReport.selectedCliAccount -eq 'admin@guardentra.com') 'Wrong report account'
    Assert-GeInventory (@($geReport.runtimeRoleDefinitions).Count -eq 3) 'Roles must be deduplicated'
    Assert-GeInventory (@($geReport.runtimeBindings).Count -eq 4) 'Conditional binding must be preserved'
    Assert-GeInventory (@($geReport.runtimeStorageRoles).Count -eq 2) 'Overlapping Storage roles missing'
    Assert-GeInventory (@($global:geInventoryCalls).Count -eq 7) 'Unexpected command count'
    Assert-GeInventory ($geReport.runtimeStorageRoles[0].storagePermissions -contains 'storage.objects.create') 'Broad Firebase Storage access missing'

    $geOriginal = [System.IO.File]::ReadAllText($geReportPath)
    $geCallsBefore = $global:geInventoryCalls.Count
    $geRejected = $false
    try { & $geCollector -ReportPath $geReportPath | Out-Null } catch { $geRejected = $_.Exception.Message -like 'Report path already exists*' }
    Assert-GeInventory $geRejected 'Existing report must be rejected'
    Assert-GeInventory ($global:geInventoryCalls.Count -eq $geCallsBefore) 'Overwrite rejection must precede CLI calls'
    Assert-GeInventory ([System.IO.File]::ReadAllText($geReportPath) -eq $geOriginal) 'Existing report changed'

    $global:geInventoryFailRole = $true
    $geFailedPath = Join-Path $geTempRoot 'failed.json'
    $geRejected = $false
    try { & $geCollector -ReportPath $geFailedPath | Out-Null } catch { $geRejected = $_.Exception.Message -like 'Read-only gcloud metadata request failed: iam roles describe*' }
    Assert-GeInventory $geRejected 'CLI failure must propagate'
    Assert-GeInventory (-not (Test-Path -LiteralPath $geFailedPath)) 'Failed inventory must not create a report'
    Write-Output 'PASS: audit inventory command scope, overlapping roles, failure and no-overwrite regressions'
} finally {
    Remove-Item -LiteralPath $geTempRoot -Recurse -Force
    Remove-Item Function:\gcloud
    Remove-Variable geInventoryCalls, geInventoryFailRole -Scope Global
}
