@echo off
REM ============================================================
REM  Forge Python Backend - Windows starter
REM  Double-click or run from CMD.
REM ============================================================

setlocal

REM Change to script directory
cd /d "%~dp0"

REM Check Python is installed
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python not found in PATH.
    echo Install Python 3.10+ from https://python.org and rerun.
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist ".venv\Scripts\python.exe" (
    echo [INFO] Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

REM Activate virtual environment
call ".venv\Scripts\activate.bat"

REM Upgrade pip
echo [INFO] Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies if not installed
echo [INFO] Checking dependencies...
python -c "import fastapi, uvicorn, socketio, ollama, chromadb" 2>nul
if errorlevel 1 (
    echo [INFO] Installing dependencies (this can take 5-10 minutes on first run)...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [ERROR] Dependency installation failed.
        echo Try installing manually:
        echo     pip install fastapi "uvicorn[standard]" python-socketio ollama chromadb duckduckgo-search
        pause
        exit /b 1
    )
)

REM Check Ollama is running
echo [INFO] Checking Ollama...
python -c "import urllib.request; urllib.request.urlopen('http://localhost:11434/api/tags', timeout=2)" 2>nul
if errorlevel 1 (
    echo.
    echo [WARNING] Ollama is not running at http://localhost:11434
    echo Please start Ollama first:
    echo   - Open a new terminal and run: ollama serve
    echo   - Or start it from the Windows tray icon
    echo.
    pause
    exit /b 1
)

REM Check models are available
echo [INFO] Checking models...
python -c "import ollama; models = [m['name'] for m in ollama.list().get('models', [])]; print('Available models:', models); assert any('llama' in m or 'qwen' in m or 'phi' in m for m in models), 'No LLM model found. Run: ollama pull llama3.1:8b'" 2>nul
if errorlevel 1 (
    echo.
    echo [WARNING] No LLM model found in Ollama.
    echo Please pull a model first:
    echo     ollama pull llama3.1:8b
    echo     ollama pull nomic-embed-text
    echo.
    pause
    exit /b 1
)

REM Start the server
echo.
echo ============================================================
echo  Forge backend is starting on http://localhost:8000
echo  Press Ctrl+C to stop.
echo ============================================================
echo.

uvicorn main:app --host 0.0.0.0 --port 8000 --reload

endlocal
pause
