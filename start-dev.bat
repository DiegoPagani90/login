@echo off
echo Starting Laravel + React Development Servers
echo =============================================

echo.
echo Starting Laravel backend server on http://localhost:8000...
start "Laravel Backend" cmd /k "cd /d %~dp0 && php artisan serve"

echo.
echo Waiting 3 seconds before starting React...
timeout /t 3 /nobreak >nul

echo.
echo Starting React frontend server on http://localhost:5173...
start "React Frontend" cmd /k "cd /d %~dp0react && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this window...
pause >nul
