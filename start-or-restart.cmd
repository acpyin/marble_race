@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-or-restart.ps1"
if errorlevel 1 (
  echo.
  echo Start failed. See the message above.
  pause
  exit /b 1
)
endlocal
