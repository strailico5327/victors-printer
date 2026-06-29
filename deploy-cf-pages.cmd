@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-cf-pages.ps1"
exit /b %ERRORLEVEL%
