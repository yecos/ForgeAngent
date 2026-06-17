@echo off
REM ============================================================
REM  Forge Frontend - Windows starter
REM  Creates .env if missing, runs Prisma, starts Next.js dev server
REM ============================================================

setlocal

REM Change to project root (parent of python-backend)
cd /d "%~dp0"

REM ── Check Node.js / npm ────────────────────────────────────────
where npm >nul 2>nul
if errorlevel 1 goto :no_npm

REM ── Create .env if it doesn't exist ────────────────────────────
if exist ".env" goto :env_exists
echo [INFO] Creating .env file...
echo DATABASE_URL=file:./db/forge.db> .env
echo # Optional: point frontend to local Python backend> .env.local
echo # NEXT_PUBLIC_AGENT_RUNTIME_URL=http://localhost:8000>> .env.local
echo [OK] .env created with DATABASE_URL=file:./db/forge.db

:env_exists
echo [INFO] .env exists.

REM ── Install npm dependencies if not installed ──────────────────
if exist "node_modules\next" goto :deps_installed
echo [INFO] Installing npm dependencies (this can take 3-5 minutes)...
call npm install
if errorlevel 1 goto :npm_failed

:deps_installed
echo [OK] npm dependencies installed.

REM ── Initialize database ────────────────────────────────────────
echo [INFO] Initializing SQLite database...
call npx prisma db push
if errorlevel 1 goto :prisma_failed
echo [OK] Database initialized.

REM ── Auto-configure frontend to use local Python backend ────────
echo [INFO] Checking socket.io configuration in src\lib\store.ts...
findstr /C:"http://localhost:8000" src\lib\store.ts >nul
if errorlevel 1 goto :patch_store
echo [OK] store.ts already points to local backend.
goto :check_backend

:patch_store
echo [INFO] Patching src\lib\store.ts to use http://localhost:8000 ...
powershell -Command "(Get-Content src\lib\store.ts) -replace 'io\('/\?XTransformPort=3003'', 'io(''http://localhost:8000''' | Set-Content src\lib\store.ts"
echo [OK] store.ts patched.

:check_backend
echo [INFO] Checking that Python backend is running on port 8000...
powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>nul
if errorlevel 1 goto :backend_not_running
echo [OK] Python backend is running on http://localhost:8000

REM ── Start Next.js dev server ───────────────────────────────────
echo.
echo ============================================================
echo  Forge frontend is starting on http://localhost:3000
echo  Press Ctrl+C to stop.
echo ============================================================
echo.

call npm run dev
goto :end

REM ── Error handlers ────────────────────────────────────────────

:no_npm
echo [ERROR] Node.js / npm not found in PATH.
echo Install Node.js 18+ from https://nodejs.org and rerun.
goto :pause_exit

:npm_failed
echo [ERROR] npm install failed.
goto :pause_exit

:prisma_failed
echo [ERROR] Prisma db push failed.
echo Try:  npx prisma db push --force-reset
goto :pause_exit

:backend_not_running
echo.
echo [WARNING] Python backend is not running on http://localhost:8000
echo The frontend will start, but agent runs will fail.
echo Please start the backend in another terminal:
echo     cd python-backend
echo     start.bat
echo.
goto :pause_exit

:pause_exit
echo.
pause
exit /b 1

:end
endlocal
