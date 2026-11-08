@echo off
rem Double-click to start HangyoPlop. The first run installs dependencies (needs Node.js).
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo First run: installing HangyoPlop dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Install failed. Make sure Node.js 18 or newer is installed: https://nodejs.org
    pause
    exit /b 1
  )
)
set ELECTRON_RUN_AS_NODE=
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
