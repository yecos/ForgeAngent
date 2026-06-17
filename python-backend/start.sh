#!/usr/bin/env bash
# ============================================================
#  Forge Python Backend - Unix starter (Linux / macOS / WSL2)
#  Make executable: chmod +x start.sh
#  Run: ./start.sh
# ============================================================
set -e

cd "$(dirname "$0")"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 not found. Install Python 3.10+."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "[INFO] Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate
# shellcheck disable=SC1091
source .venv/bin/activate

# Upgrade pip
echo "[INFO] Upgrading pip..."
python -m pip install --upgrade pip

# Check dependencies
echo "[INFO] Checking dependencies..."
if ! python _check.py deps; then
    echo "[INFO] Installing dependencies (this can take 5-10 minutes on first run)..."
    pip install -r requirements.txt
    echo "[OK] Dependencies installed."
fi

# Check Ollama
echo "[INFO] Checking Ollama..."
if ! python _check.py ollama; then
    echo ""
    echo "Start Ollama in another terminal:  ollama serve"
    exit 1
fi

# Check models
echo "[INFO] Checking models..."
if ! python _check.py models; then
    echo ""
    echo "Pull a model first:"
    echo "  ollama pull llama3.1:8b"
    echo "  ollama pull nomic-embed-text"
    exit 1
fi

# Start the server
# NOTE: --reload removed because WatchFiles scans the .venv directory
# (thousands of files) which can take 60+ seconds on first start.
# Use --reload only during active backend development.
echo ""
echo "============================================================"
echo "  Forge backend is starting on http://localhost:8000"
echo "  Press Ctrl+C to stop."
echo "============================================================"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000
