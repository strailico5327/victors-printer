$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerRoot = Join-Path $projectRoot "worker"
$distPath = Join-Path $projectRoot "dist"

Write-Host "Building Victor's Printer..." -ForegroundColor Cyan
Push-Location $projectRoot
try {
	pnpm build
}
finally {
	Pop-Location
}

if (-not (Test-Path $distPath)) {
	throw "Build output not found: $distPath"
}

Write-Host "Deploying dist to Cloudflare Pages project victors-printer..." -ForegroundColor Cyan
Push-Location $workerRoot
try {
	pnpm exec wrangler pages deploy ..\dist --project-name victors-printer --branch main
}
finally {
	Pop-Location
}

Write-Host "Done." -ForegroundColor Green
