@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-update.ps1"
exit /b %ERRORLEVEL%
