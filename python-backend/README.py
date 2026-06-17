# Forge — Backend Python (referencia para GPU NVIDIA local)
#
# Este backend replica la lógica del mini-servicio TypeScript (mini-services/agent-runtime)
# pero usando herramientas reales para ejecución local:
#   - Ollama (modelos locales con GPU NVIDIA)
#   - CrewAI (orquestación multi-agente)
#   - ChromaDB (memoria vectorial persistente)
#   - DuckDuckGo Search (búsqueda web gratuita, sin API key)
#   - Sandbox con subprocess + resource limits (ejecución de código Python)
#
# Compatible con el frontend Next.js: expone el mismo protocolo WebSocket
# (eventos: agent_event, run, memory:list, skills:list, soul, etc.)
#
# Requisitos:
#   - Python 3.10+
#   - Ollama instalado (https://ollama.ai) con un modelo descargado:
#       ollama pull llama3.1:8b       # ~5 GB, recomendado para 8-12 GB VRAM
#       ollama pull qwen2.5-coder:7b # alternativo para código
#   - CUDA toolkit si usas GPU NVIDIA (Ollama lo detecta automáticamente)
#
# Instalación:
#   cd python-backend
#   python -m venv .venv
#   source .venv/bin/activate          # Windows: .venv\Scripts\activate
#   pip install -r requirements.txt
#
# Ejecutar:
#   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
#
# Luego, en el frontend, configurar la variable de entorno:
#   NEXT_PUBLIC_AGENT_RUNTIME_URL=http://localhost:8000
# y modificar src/lib/store.ts para conectar directamente a esa URL.
