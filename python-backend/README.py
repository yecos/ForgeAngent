"""
Forge — Backend Python (referencia para GPU NVIDIA local)

Este backend replica la lógica del mini-servicio TypeScript (mini-services/agent-runtime)
pero usando herramientas reales para ejecución local:
  - Ollama (modelos locales con GPU NVIDIA)
  - ChromaDB (memoria vectorial persistente)
  - DuckDuckGo Search (búsqueda web gratuita, sin API key)
  - Sandbox con subprocess + resource limits (ejecución de código Python)

Compatible con el frontend Next.js: expone el mismo protocolo WebSocket
(eventos: agent_event, run, memory:list, skills:list, soul, etc.)

Requisitos:
  - Python 3.10+
  - Ollama instalado (https://ollama.ai) con un modelo descargado:
      ollama pull llama3.1:8b       # ~5 GB, recomendado para 8-12 GB VRAM
      ollama pull nomic-embed-text # embeddings para memoria y RAG
  - CUDA toolkit si usas GPU NVIDIA (Ollama lo detecta automáticamente)

Instalación rápida:
  Linux/macOS/WSL2:
    cd python-backend
    chmod +x start.sh && ./start.sh

  Windows (CMD o doble clic en start.bat):
    cd python-backend
    start.bat

Instalación manual:
  cd python-backend
  python -m venv .venv
  # Linux/macOS/WSL2:
  source .venv/bin/activate
  # Windows (PowerShell):
  # .venv\\Scripts\\Activate.ps1
  # Windows (CMD):
  # .venv\\Scripts\\activate.bat
  pip install -r requirements.txt
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Luego, en el frontend, editar src/lib/store.ts y cambiar:
    socketSingleton = io('/?XTransformPort=3003', { ... })
por:
    socketSingleton = io('http://localhost:8000', { ... })

NOTA sobre dependencias:
  CrewAI fue removido de los requisitos porque pin versiones específicas de
  pydantic/openai/langchain que chocan con chromadb (ResolutionImpossible).
  Nuestra orquestación multi-agente se hace manualmente con llamadas a
  Ollama chat — más rápido y sin dependencias pesadas.

Troubleshooting:
  - "ResolutionImpossible": borrar .venv y recrear con los nuevos requirements
  - "No module named 'socketio'": pip install python-socketio (módulo se importa como 'socketio')
  - "No module named 'chromadb'": pip install chromadb
  - CUDA OOM: usar modelo más pequeño (qwen2.5:1.5b)
  - Puerto ocupado: cambiar --port 8000 a --port 8001
"""
