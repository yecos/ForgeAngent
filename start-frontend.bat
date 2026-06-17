@echo off
REM ============================================================
REM  Forge Frontend - Windows starter
REM
REM  If the Python backend is not running, starts it automatically
REM  in a new window, waits for it to be healthy, then starts the
REM  Next.js frontend in this window.
REM ============================================================

setlocal

REM Change to project root
cd /d "%~dp0"

REM ── Check if backend is already running ────────────────────────
echo [INFO] Checking that Python backend is running on port 8000...
powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto :backend_ok

echo [INFO] Backend not running. Starting it automatically in a new window...
if not exist "python-backend\start.bat" goto :no_backend_script
start "Forge Backend" cmd /k "cd /d %~dp0python-backend && start.bat"

echo [INFO] Waiting for backend to be ready (max 120 seconds)...
set /a counter=0
:wait_loop
powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto :backend_ok
set /a counter+=1
if %counter% GEQ 60 goto :backend_timeout
timeout /t 2 /nobreak >nul
goto :wait_loop

:backend_ok
echo [OK] Python backend is running on http://localhost:8000
echo.

REM ── Check Node.js / npm ────────────────────────────────────────
where npm >nul 2>nul
if errorlevel 1 goto :no_npm

REM ── Create .env if it doesn't exist ────────────────────────────
if exist ".env" goto :env_exists
echo [INFO] Creating .env file...
echo DATABASE_URL=file:./db/forge.db> .env

:env_exists
echo [OK] .env exists.

REM ── Install npm dependencies if not installed ──────────────────
if exist "node_modules\next" goto :deps_installed
echo [INFO] Installing npm dependencies (this can take 3-5 minutes)...
call npm install
if errorlevel 1 goto :npm_failed

:deps_installed
echo [OK] npm dependencies installed.

REM ── Initialize database ────────────────────────────────────────
echo [INFO] Initializing SQLite database...
call npx prisma db push >nul 2>&1
echo [OK] Database initialized.

REM ── Auto-configure frontend to use local Python backend ────────
findstr /C:"http://localhost:8000" src\lib\store.ts >nul
if errorlevel 1 goto :patch_store
echo [OK] store.ts already points to local backend.
goto :start

:patch_store
echo [INFO] Patching src\lib\store.ts to use http://localhost:8000 ...
powershell -Command "(Get-Content src\lib\store.ts) -replace 'io\('/\?XTransformPort=3003'', 'io(''http://localhost:8000''' | Set-Content src\lib\store.ts"
echo [OK] store.ts patched.

:start
echo.
echo ============================================================
echo  Forge frontend is starting on http://localhost:3000
echo  Backend is running in the other window.
echo  Press Ctrl+C here to stop the frontend.
echo ============================================================
echo.

call npm run dev
goto :end

REM ── Error handlers ────────────────────────────────────────────

:no_backend_script
echo [ERROR] python-backend\start.bat not found.
goto :pause_exit

:no_npm
echo [ERROR] Node.js / npm not found in PATH.
echo Install Node.js 18+ from https://nodejs.org and rerun.
goto :pause_exit

:npm_failed
echo [ERROR] npm install failed.
goto :pause_exit

:backend_timeout
echo [ERROR] Backend did not start within 60 seconds.
echo Check the backend window for errors.
echo Common causes:
echo   1. Ollama not running (start it with: ollama serve)
echo   2. No models installed (run: ollama pull llama3.1:8b)
echo   3. Port 8000 already in use
goto :pause_exit

:pause_exit
echo.
pause
exit /b 1

:end
endlocal
