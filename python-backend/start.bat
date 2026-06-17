@echo off
REM ============================================================
REM  Forge Python Backend - Windows starter
REM  Double-click or run from CMD.
REM ============================================================

setlocal

REM Change to script directory
cd /d "%~dp0"

REM ── Check Python is installed ──────────────────────────────────
where python >nul 2>nul
if errorlevel 1 goto :no_python

REM ── Create virtual environment if it doesn't exist ────────────
if exist ".venv\Scripts\python.exe" goto :venv_exists
echo [INFO] Creating virtual environment...
python -m venv .venv
if errorlevel 1 goto :venv_failed
goto :activate

:venv_exists
echo [INFO] Virtual environment already exists.

:activate
REM ── Activate virtual environment ──────────────────────────────
call ".venv\Scripts\activate.bat"

REM ── Upgrade pip ───────────────────────────────────────────────
echo [INFO] Upgrading pip...
python -m pip install --upgrade pip

REM ── Check if dependencies are installed ───────────────────────
echo [INFO] Checking dependencies...
python _check.py deps
if errorlevel 1 goto :install_deps
goto :check_ollama

:install_deps
echo [INFO] Installing dependencies (this can take 5-10 minutes on first run)...
pip install -r requirements.txt
if errorlevel 1 goto :deps_failed
echo [OK] Dependencies installed successfully.

:check_ollama
echo [INFO] Checking Ollama...
python _check.py ollama
if errorlevel 1 goto :no_ollama

:check_models
echo [INFO] Checking models...
python _check.py models
if errorlevel 1 goto :no_models

REM ── Start the server ──────────────────────────────────────────
echo.
echo ============================================================
echo  Forge backend is starting on http://localhost:8000
echo  Press Ctrl+C to stop.
echo ============================================================
echo.

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
goto :end

REM ── Error handlers ────────────────────────────────────────────

:no_python
echo [ERROR] Python not found in PATH.
echo Install Python 3.10+ from https://python.org and rerun.
goto :pause_exit

:venv_failed
echo [ERROR] Failed to create virtual environment.
goto :pause_exit

:deps_failed
echo.
echo [ERROR] Dependency installation failed.
echo Try installing manually:
echo     pip install -r requirements.txt
goto :pause_exit

:no_ollama
echo.
echo [WARNING] Ollama is not running.
echo Please start Ollama first:
echo   - Open a new terminal and run:  ollama serve
echo   - Or start it from the Windows system tray icon
goto :pause_exit

:no_models
echo.
echo [WARNING] No LLM model found in Ollama.
echo Please pull a model first:
echo     ollama pull llama3.1:8b
echo     ollama pull nomic-embed-text
goto :pause_exit

:pause_exit
echo.
pause
exit /b 1

:end
endlocal
