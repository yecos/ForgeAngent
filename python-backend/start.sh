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
source .venv/bin/activate

# Upgrade pip
echo "[INFO] Upgrading pip..."
python -m pip install --upgrade pip

# Install dependencies if not installed
if ! python -c "import fastapi, uvicorn, socketio, ollama, chromadb" 2>/dev/null; then
    echo "[INFO] Installing dependencies (this can take 5-10 minutes on first run)..."
    pip install -r requirements.txt
fi

# Check Ollama
if ! curl -s --max-time 2 http://localhost:11434/api/tags > /dev/null; then
    echo ""
    echo "[WARNING] Ollama is not running at http://localhost:11434"
    echo "Start it in another terminal:  ollama serve"
    exit 1
fi

# Start the server
echo ""
echo "============================================================"
echo "  Forge backend is starting on http://localhost:8000"
echo "  Press Ctrl+C to stop."
echo "============================================================"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
