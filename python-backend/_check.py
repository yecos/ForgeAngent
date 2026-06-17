"""
Forge — Pre-flight checks for the Python backend.

Runs all verifications (deps, Ollama, models) in Python so the .bat / .sh
scripts stay simple and don't break on Windows CMD quoting rules.

Usage:
    python _check.py deps    # Check if all pip dependencies are installed
    python _check.py ollama  # Check if Ollama is running at localhost:11434
    python _check.py models  # Check if a usable LLM model is available

Exit codes:
    0 = OK
    1 = Check failed (see printed message)
"""
from __future__ import annotations

import sys
import urllib.request

REQUIRED_PACKAGES = [
    "fastapi",
    "uvicorn",
    "socketio",  # python-socketio imports as 'socketio'
    "ollama",
    "chromadb",
    "duckduckgo_search",
]

OLLAMA_URL = "http://localhost:11434/api/tags"

# Any of these substrings in a model name means we have a usable LLM
LLM_HINTS = ("llama", "qwen", "phi", "mistral", "gemma", "deepseek", "yi", "solar")


def check_deps() -> int:
    """Return 0 if all required packages are importable, 1 otherwise."""
    missing = []
    for pkg in REQUIRED_PACKAGES:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)

    if missing:
        print(f"[FAIL] Missing packages: {', '.join(missing)}")
        return 1

    print("[OK] All Python dependencies are installed.")
    return 0


def check_ollama() -> int:
    """Return 0 if Ollama responds at localhost:11434, 1 otherwise."""
    try:
        with urllib.request.urlopen(OLLAMA_URL, timeout=2) as resp:
            if resp.status == 200:
                print("[OK] Ollama is running at http://localhost:11434")
                return 0
            print(f"[FAIL] Ollama returned HTTP {resp.status}")
            return 1
    except urllib.error.URLError:
        print("[FAIL] Ollama is not running at http://localhost:11434")
        print("       Start it in another terminal with:  ollama serve")
        return 1
    except Exception as e:
        print(f"[FAIL] Cannot reach Ollama: {e}")
        return 1


def check_models() -> int:
    """Return 0 if at least one usable LLM model is available, 1 otherwise."""
    try:
        import ollama
    except ImportError:
        print("[FAIL] ollama Python package not installed")
        return 1

    try:
        response = ollama.list()
        models = [m.get("name", "") for m in response.get("models", [])]
    except Exception as e:
        print(f"[FAIL] Cannot list Ollama models: {e}")
        return 1

    if not models:
        print("[FAIL] No models installed in Ollama.")
        print("       Run:  ollama pull llama3.1:8b")
        print("       And:  ollama pull nomic-embed-text")
        return 1

    has_llm = any(any(hint in m.lower() for hint in LLM_HINTS) for m in models)
    if not has_llm:
        print(f"[FAIL] Models found: {models}")
        print("       None of them look like a usable LLM.")
        print("       Pull one with:  ollama pull llama3.1:8b")
        return 1

    print(f"[OK] Available models: {models}")
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python _check.py [deps|ollama|models|all]")
        return 1

    check = sys.argv[1].lower()
    if check == "deps":
        return check_deps()
    if check == "ollama":
        return check_ollama()
    if check == "models":
        return check_models()
    if check == "all":
        rc = check_deps()
        if rc:
            return rc
        rc = check_ollama()
        if rc:
            return rc
        return check_models()

    print(f"Unknown check: {check}")
    print("Usage: python _check.py [deps|ollama|models|all]")
    return 1


if __name__ == "__main__":
    sys.exit(main())
