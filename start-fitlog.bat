@echo off
setlocal
title FitLog Local Server
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm not found. Install Node.js 22 LTS first.
  pause
  exit /b 1
)

echo ==========================================
echo   FitLog - Local Server
echo ==========================================
echo.

echo Cleaning old process on port 5173...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  taskkill /f /pid %%p >nul 2>nul
)

for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do set LANIP=%%i

echo PC  : http://localhost:5173
if defined LANIP echo Phone: http://%LANIP%:5173  [same Wi-Fi required]
echo.
echo Keep this window open. Closing it stops the server.
echo Starting, please wait a few seconds...
echo.

start "" http://localhost:5173
npm run dev -- --host --port 5173 --strictPort

echo.
echo Server stopped.
pause
