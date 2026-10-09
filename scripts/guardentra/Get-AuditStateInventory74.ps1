param(
    [Parameter(Mandatory = $true)]
    [string]$ReportPath
)

$ErrorActionPreference = 'Stop'
$geProject = 'guardentra-staging'
$geRuntimeEmail = 'firebase-app-hosting-compute@guardentra-staging.iam.gserviceaccount.com'
$geRuntimeMember = 'serviceAccount:' + $geRuntimeEmail

if (Test-Path -LiteralPath $ReportPath) {
    throw 'Report path already exists. Choose a new path; no existing file will be overwritten.'
}

function Read-GeCloudJson {
    param([string[]]$CommandArgs)
    # This collector invokes only the fixed metadata GET/list commands below.
    $geArgs = @($CommandArgs) + @('--project=guardentra-staging', '--quiet', '--format=json')
    $geRaw = @(& gcloud @geArgs)
    if ($LASTEXITCODE -ne 0) {
        throw ('Read-only gcloud metadata request failed: ' + ($CommandArgs -join ' '))
    }
    return (($geRaw -join [Environment]::NewLine) | ConvertFrom-Json)
}

$geAccounts = @(Read-GeCloudJson -CommandArgs @('auth', 'list', '--filter=status:ACTIVE'))
if ($geAccounts.Count -ne 1) { throw 'Expected exactly one active Google CLI account.' }
$geProjectMetadata = Read-GeCloudJson -CommandArgs @('projects', 'describe', $geProject)
if ($geProjectMetadata.projectId -ne $geProject) { throw 'Project identity mismatch.' }
$gePolicy = Read-GeCloudJson -CommandArgs @('projects', 'get-iam-policy', $geProject)
$geRuntimeMetadata = Read-GeCloudJson -CommandArgs @('iam', 'service-accounts', 'describe', $geRuntimeEmail)

$geRuntimeBindings = @($gePolicy.bindings | Where-Object { $_.members -contains $geRuntimeMember })
$geRoleNames = @($geRuntimeBindings | ForEach-Object { $_.role } | Sort-Object -Unique)
if ($geRoleNames.Count -eq 0) { throw 'No runtime project bindings found; reconcile the identity before proceeding.' }
$geRoleDefinitions = @()
$geStorageRoles = @()
foreach ($geRoleName in $geRoleNames) {
    $geRole = Read-GeCloudJson -CommandArgs @('iam', 'roles', 'describe', $geRoleName)
    $geRoleDefinitions += $geRole
    $geStoragePermissions = @($geRole.includedPermissions | Where-Object { $_ -like 'storage.*' })
    if ($geStoragePermissions.Count -gt 0) {
        $geStorageRoles += [ordered]@{
            role = $geRoleName
            storagePermissions = $geStoragePermissions
        }
    }
}

$geReport = [ordered]@{
    capturedAtUtc = [DateTime]::UtcNow.ToString('o')
    issue = 74
    project = $geProjectMetadata
    selectedCliAccount = $geAccounts[0].account
    runtimeIdentity = $geRuntimeMetadata
    projectIamPolicy = $gePolicy
    runtimeBindings = $geRuntimeBindings
    runtimeRoleDefinitions = $geRoleDefinitions
    runtimeStorageRoles = $geStorageRoles
    scope = 'Read-only metadata; no secret payloads, tokens, state objects, API enablement, IAM writes or deployment.'
    limitations = 'Project policy only. Ancestor grants, service-account impersonation paths and live effective-access tests still require review.'
}

$geReportJson = $geReport | ConvertTo-Json -Depth 40
$geStream = [System.IO.File]::Open($ReportPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
$geWriter = [System.IO.StreamWriter]::new($geStream, [System.Text.UTF8Encoding]::new($false))
try { $geWriter.Write($geReportJson) } finally { $geWriter.Dispose() }
Write-Output ('Read-only report: ' + $ReportPath)
[ordered]@{
    capturedAtUtc = $geReport.capturedAtUtc
    projectId = $geProjectMetadata.projectId
    projectNumber = $geProjectMetadata.projectNumber
    selectedCliAccount = $geAccounts[0].account
    runtimeStorageRoles = $geStorageRoles
} | ConvertTo-Json -Depth 10
