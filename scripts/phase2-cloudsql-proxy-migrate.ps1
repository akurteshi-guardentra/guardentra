# Local Cloud SQL Auth Proxy migrate + live prove (Path B).
# Requires: gcloud auth, cloud-sql-proxy on PATH, passwords in .local-secrets/cloudsql-audit-users.env
# Private IP instances need a VPC path (run from GCE in the subnet, or VPN). From a GCE bastion:
#   cloud-sql-proxy --private-ip guardentra-7f582:europe-west3:guardentra-audit --port 5433
#
# Usage (after proxy is listening on 5433):
#   powershell -File scripts/phase2-cloudsql-proxy-migrate.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$secretsFile = Join-Path $PSScriptRoot "..\.local-secrets\cloudsql-audit-users.env"
if (-not (Test-Path $secretsFile)) { throw "Missing $secretsFile — create audit users first." }

Get-Content $secretsFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_ -split '=', 2
  Set-Item -Path "Env:$k" -Value $v.Trim()
}

if (-not $env:AUDIT_APP_PASSWORD -or -not $env:AUDIT_MIGRATOR_PASSWORD) {
  throw "AUDIT_APP_PASSWORD and AUDIT_MIGRATOR_PASSWORD required in secrets file"
}

$port = if ($env:AUDIT_PROXY_PORT) { $env:AUDIT_PROXY_PORT } else { "5433" }
$env:AUDIT_SPINE_ENABLED = "true"
$env:AUDIT_WORKER_ENABLED = "false"
$env:AUDIT_DATABASE_URL = "postgres://audit_app:$($env:AUDIT_APP_PASSWORD)@127.0.0.1:${port}/guardentra_audit"
$env:AUDIT_DATABASE_URL_MIGRATOR = "postgres://audit_migrator:$($env:AUDIT_MIGRATOR_PASSWORD)@127.0.0.1:${port}/guardentra_audit"

Write-Host "Migrating via Auth Proxy on port $port..."
npm run migrate:audit
Write-Host "Live prove..."
npm run phase2:live-prove
Write-Host "OK - Cloud SQL migrate + live-prove green."
