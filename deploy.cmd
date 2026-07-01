@echo off
setlocal
if "%~1"=="" (
	powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
) else (
	powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" -CommitMessage "%*"
)
exit /b %ERRORLEVEL%
