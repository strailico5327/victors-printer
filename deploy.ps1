param(
	[string]$CommitMessage = "deploy: update site"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerRoot = Join-Path $projectRoot "worker"
$distPath = Join-Path $projectRoot "dist"

Write-Host "Syncing local changes with GitHub..." -ForegroundColor Cyan
Push-Location $projectRoot
try {
	git add -A

	$stagedChanges = git diff --cached --name-only
	if ($stagedChanges) {
		git commit -m $CommitMessage
	}
	else {
		Write-Host "No local file changes to commit." -ForegroundColor DarkGray
	}

	$branch = git branch --show-current
	if (-not $branch) {
		throw "Could not detect the current Git branch."
	}

	git pull --rebase origin $branch
	git push origin $branch
}
finally {
	Pop-Location
}

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
