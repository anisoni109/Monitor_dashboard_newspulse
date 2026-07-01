@echo off
REM NewsPulse Monitor Dashboard - Local Launcher
REM This starts the monitoring dashboard server locally
REM It connects to your deployed NewsPulse API at https://newspulse-458n.onrender.com

set MONITOR_PORT=3002
set NEWSPULSE_API_URL=https://newspulse-458n.onrender.com/api

echo ============================================
echo   NewsPulse Monitoring Dashboard Launcher
echo ============================================
echo.
echo   NewsPulse API URL: %NEWSPULSE_API_URL%
echo   Monitor Port:      %MONITOR_PORT%
echo.
echo   Starting monitor dashboard...
echo   Open http://localhost:%MONITOR_PORT% in your browser
echo.

set PORT=%MONITOR_PORT%
set NEWSPULSE_API_URL=%NEWSPULSE_API_URL%
node server.js

pause