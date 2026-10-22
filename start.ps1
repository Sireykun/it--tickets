# Starts the whole stack (database, mail, web app, email worker) with one command:
#   .\dev   (or: powershell -ExecutionPolicy Bypass -File .\start.ps1)
# Safe to re-run: install, migrate and seed are all idempotent.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Invoke-Step($label, [scriptblock]$command) {
    Write-Host "==> $label" -ForegroundColor Cyan
    & $command
    if ($LASTEXITCODE -ne 0) { throw "Failed: $label" }
}

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker is not running. Start Docker Desktop and try again." }

Invoke-Step "Starting database and mail server" { docker compose up -d --build db mail }
Invoke-Step "Installing packages" { docker compose run --rm app npm install --no-audit --no-fund }
Invoke-Step "Applying database migrations" { docker compose run --rm app npx prisma migrate deploy }
Invoke-Step "Seeding accounts" { docker compose run --rm app npm run db:seed }
Invoke-Step "Starting web app and email worker" { docker compose up -d web worker }
# Turbopack misses edits made on Windows, so restart to make sure the latest code is served.
Invoke-Step "Restarting to load the latest code" { docker compose restart web worker }

Write-Host "==> Waiting for http://localhost:3000" -ForegroundColor Cyan
for ($i = 0; $i -lt 90; $i++) {
    try {
        Invoke-WebRequest "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 5 | Out-Null
        Write-Host "App is up: http://localhost:3000 (staff: /staff)" -ForegroundColor Green
        Start-Process "http://localhost:3000"
        exit 0
    } catch {
        Start-Sleep -Seconds 2
    }
}
throw "The app did not respond in time. Check: docker compose logs web"
