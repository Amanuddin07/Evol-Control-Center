@echo off
setlocal
echo Starting EVOL CONTROL CENTER Windows Build...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" %*
if errorlevel 1 (
  echo.
  echo Build failed with exit code %errorlevel%.
  pause
  exit /b %errorlevel%
)
echo.
echo Build succeeded! Check the "dist" folder for EVOL-Control-Center.exe and EVOL-Control-Center-Setup.exe.
pause
