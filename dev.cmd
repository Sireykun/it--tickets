@echo off
rem Shortcut for start.ps1 so `.\dev` works without changing the PowerShell execution policy.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
