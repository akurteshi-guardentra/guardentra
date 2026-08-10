# Local audit spine bring-up (Path A).
# Requires Docker Desktop running.
# Usage: powershell -File scripts/phase2-local-spine.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

# Docker Desktop ships docker.exe outside default PATH on some Windows shells.
$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
if (Test-Path "$dockerBin\docker.exe") {
  $env:Path = "$dockerBin;" + $env:Path
}

Write-Host "Starting audit Postgres (docker compose)..."
docker compose -f docker-compose.audit.yml up -d

Write-Host "Waiting for health..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  docker compose -f docker-compose.audit.yml exec -T audit-postgres pg_isready -U audit_migrator -d guardentra_audit 2>$null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw "Postgres did not become ready" }

$env:AUDIT_SPINE_ENABLED = "true"
$env:AUDIT_DATABASE_URL = "postgres://audit_app:audit_app@localhost:5433/guardentra_audit"
$env:AUDIT_DATABASE_URL_MIGRATOR = "postgres://audit_migrator:audit_migrator@localhost:5433/guardentra_audit"

Write-Host "Migrating..."
npm run migrate:audit

Write-Host "Verify gate..."
npm run verify:audit-spine

Write-Host "Live emit/verify/tamper..."
npm run phase2:live-prove

Write-Host ""
Write-Host "Add to .env.local for local server:"
Write-Host "AUDIT_SPINE_ENABLED=true"
Write-Host "AUDIT_DATABASE_URL=postgres://audit_app:audit_app@localhost:5433/guardentra_audit"
Write-Host "AUDIT_DATABASE_URL_MIGRATOR=postgres://audit_migrator:audit_migrator@localhost:5433/guardentra_audit"
Write-Host "AUDIT_WORKER_ENABLED=true"
Write-Host "OK - local spine ready."
