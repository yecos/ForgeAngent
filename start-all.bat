@echo off
REM ============================================================
REM  Forge — One-click starter for Windows
REM
REM  Starts BOTH the Python backend (in a new window) and the
REM  Next.js frontend (in this window). Wait for backend to be
REM  healthy before starting the frontend.
REM
REM  Just double-click or run from CMD:
REM      start-all.bat
REM ============================================================

setlocal

REM Change to script directory (project root)
cd /d "%~dp0"

echo ============================================================
echo  Forge — One-click starter
echo  Starting backend + frontend...
echo ============================================================
echo.

REM ── Step 1: Check if backend is already running on port 8000 ──
echo [INFO] Checking if Python backend is already running...
powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto :backend_ready
echo [INFO] Backend not running. Starting it in a new window...

REM ── Step 2: Start backend in a new window ─────────────────────
if not exist "python-backend\start.bat" goto :no_backend_script
start "Forge Backend" cmd /k "cd /d %~dp0python-backend && start.bat"

REM ── Step 3: Wait for backend to come up (max 60 seconds) ──────
echo [INFO] Waiting for backend to be ready (max 60 seconds)...
set /a counter=0
:wait_loop
powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto :backend_ready
set /a counter+=1
if %counter% GEQ 30 goto :backend_timeout
echo     [%counter%/30] Backend still starting...
timeout /t 2 /nobreak >nul
goto :wait_loop

:backend_ready
echo [OK] Python backend is running on http://localhost:8000
echo.

REM ── Step 4: Ensure .env exists ────────────────────────────────
if exist ".env" goto :env_ok
echo [INFO] Creating .env file...
echo DATABASE_URL=file:./db/forge.db> .env

:env_ok
echo [OK] .env exists.

REM ── Step 5: Install npm deps if missing ───────────────────────
if exist "node_modules\next" goto :npm_ok
echo [INFO] Installing npm dependencies (3-5 minutes on first run)...
call npm install
if errorlevel 1 goto :npm_failed

:npm_ok
echo [OK] npm dependencies installed.

REM ── Step 6: Initialize database ───────────────────────────────
echo [INFO] Initializing SQLite database...
call npx prisma db push >nul 2>&1
echo [OK] Database ready.

REM ── Step 7: Ensure store.ts points to local backend ───────────
findstr /C:"http://localhost:8000" src\lib\store.ts >nul
if errorlevel 1 goto :patch_store
echo [OK] store.ts already points to local backend.
goto :start_frontend

:patch_store
echo [INFO] Patching src\lib\store.ts to use http://localhost:8000 ...
powershell -Command "(Get-Content src\lib\store.ts) -replace 'io\('/\?XTransformPort=3003'', 'io(''http://localhost:8000''' | Set-Content src\lib\store.ts"
echo [OK] store.ts patched.

:start_frontend
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
echo Make sure you're running this from the project root.
pause
exit /b 1

:backend_timeout
echo.
echo [ERROR] Backend did not start within 60 seconds.
echo Check the backend window for errors.
echo Common causes:
echo   1. Ollama not running (start it with: ollama serve)
echo   2. No models installed (run: ollama pull llama3.1:8b)
echo   3. Port 8000 already in use by another program
pause
exit /b 1

:npm_failed
echo [ERROR] npm install failed.
pause
exit /b 1

:end
endlocal
