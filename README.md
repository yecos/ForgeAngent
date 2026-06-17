# ⚒️ Forge — Multi-Agente Local para Desarrollo

Sistema multi-agente local inspirado en [Hermes Agent](https://github.com/nousresearch/hermes-agent) de NousResearch, optimizado para **desarrollo de aplicaciones** con GPU NVIDIA.

## ✨ Características

- **5 agentes especializados** coordinados por un Orchestrator (estilo Hermes)
- **100% local** con Ollama — tus datos nunca salen de tu máquina
- **Bilingüe ES/EN** — el agente se adapta al idioma del usuario
- **Memoria persistente** con ChromaDB (vectorial + FTS)
- **RAG sobre tus documentos** — sube PDFs, código, markdown
- **Búsqueda web** con DuckDuckGo (sin API key)
- **Ejecución de código** sandboxed con límites de memoria y tiempo
- **SOUL.md** — personalidad editable (Hermes-style)
- **Skills** — memoria procedural reutilizable
- **Streaming en tiempo real** vía WebSocket

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16 + Tailwind + shadcn/ui)                    │
│  ┌──────────────┬─────────────┬────────────┬──────────────┐    │
│  │  Chat UI     │ Memoria     │ Skills     │ Documentos   │    │
│  │  Bilingüe    │ Persistente │ (procedim.)│ (RAG upload) │    │
│  └──────────────┴─────────────┴────────────┴──────────────┘    │
│                          ↕ WebSocket                            │
├─────────────────────────────────────────────────────────────────┤
│  Agent Runtime (TS mini-service en preview / Python en local)   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Orchestrator → plan → delegate → synthesize             │  │
│  │       ↓         ↓         ↓           ↓                  │  │
│  │   Coder    Researcher  Doc Analyst  Reviewer             │  │
│  │   (code)   (web)        (RAG)         (verify)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↕                                       │
├─────────────────────────────────────────────────────────────────┤
│  Backend Local (Ollama + ChromaDB + DuckDuckGo + Sandbox)       │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Inicio Rápido (Local con GPU NVIDIA)

### 1. Instalar Ollama

```bash
# Linux / WSL2
curl -fsSL https://ollama.ai/install.sh | sh

# Descargar un modelo (8-12 GB VRAM recomendado)
ollama pull llama3.1:8b
ollama pull nomic-embed-text  # para embeddings
```

**Modelos recomendados según tu GPU:**

| GPU              | VRAM    | Modelo recomendado           |
|------------------|---------|------------------------------|
| RTX 3060 / 4060  | 8-12 GB | `llama3.1:8b`                |
| RTX 4070 / 4080  | 12-16 GB| `llama3.1:13b` o `qwen2.5:14b` |
| RTX 4090         | 24 GB   | `llama3.1:70b` o `qwen2.5:32b` |
| RTX 4090 + 3090  | 48 GB   | `llama3.1:70b` (quantizado)  |

### 2. Iniciar el backend Python

```bash
cd python-backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Arrancar (Ollama debe estar corriendo en localhost:11434)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Iniciar el frontend Next.js

```bash
# En otra terminal, en la raíz del proyecto
bun install         # o npm install
bun run dev         # arranca en http://localhost:3000
```

### 4. Apuntar el frontend al backend Python

Edita `src/lib/store.ts` y cambia:

```ts
socketSingleton = io('/?XTransformPort=3003', { ... })
```

por:

```ts
socketSingleton = io('http://localhost:8000', { transports: ['websocket', 'polling'] })
```

Abre http://localhost:3000 y empieza a chatear con Forge.

## 🎮 Uso

### Chat multi-agente

Escribe tu request en español o inglés. El Orchestrator decidirá qué agentes actúan:

- **"Crea una API REST en Python con FastAPI"** → Coder escribe, Reviewer verifica
- **"Busca las últimas novedades de Next.js 16"** → Researcher busca, Reviewer sintetiza
- **"Analiza los documentos que subí"** → Doc Analyst extrae, Orchestrator resume
- **"Ejecuta este código y dime qué pasa"** → Coder ejecuta en sandbox

Cada respuesta muestra el **pipeline de agentes** que se ejecutó, con detalles expandibles:

```
🧭 Orchestrator → 💻 Coder → ✅ Reviewer → 🧭 Orchestrator (síntesis)
```

### Panel de Memoria

Guarda hechos, preferencias y eventos que persisten entre sesiones:

- "Prefiero Python sobre JavaScript para backend"
- "Mi proyecto usa PostgreSQL 16"
- "Estoy trabajando en una app de e-commerce"

Los agentes consultan esta memoria automáticamente con `memory_recall`.

### Panel de Skills

Pídele a Forge que cree skills reutilizables:

> "Crea una skill llamada `deploy-vercel` que explique cómo desplegar en Vercel"

Luego Forge puede invocar esa skill cuando sea relevante.

### Panel de Documentos

Sube `.txt`, `.md`, `.json`, `.csv`, `.py`, `.js`, `.html`, etc. El Doc Analyst los indexa en ChromaDB y los busca por similitud semántica cuando necesita responder preguntas basadas en ellos.

### SOUL.md

Edita la personalidad base del agente (Hermes-style). Cualquier cambio aplica inmediatamente a todos los agentes.

## 🛠️ Stack Técnico

### Frontend
- **Next.js 16** con App Router + Turbopack
- **TypeScript 5** estricto
- **Tailwind CSS 4** + **shadcn/ui** (New York)
- **Zustand** para estado global
- **Socket.io-client** para tiempo real
- **react-markdown** + **react-syntax-highlighter** para respuestas enriquecidas
- **framer-motion** para animaciones
- **Prisma ORM** + SQLite (persistencia de chats)

### Backend Python (local)
- **FastAPI** + **Uvicorn** (servidor ASGI)
- **python-socketio** (mismo protocolo que el runtime TS)
- **Ollama** Python SDK (inferencia local)
- **CrewAI** (orquestación multi-agente)
- **ChromaDB** (vector store para memoria y RAG)
- **sentence-transformers** (embeddings alternativos)
- **duckduckgo-search** (búsqueda web sin API key)
- **pypdf** + **python-docx** (parsing de documentos)
- **subprocess** + **resource** (sandbox de código)

### Runtime de preview (TS mini-service)
- **Bun** + **TypeScript** + **socket.io** server
- **z-ai-web-dev-sdk** (stand-in de Ollama para demo en el navegador)
- Implementa el mismo protocolo que el backend Python — el frontend funciona con ambos

## 📁 Estructura del Proyecto

```
forge/
├── src/                          # Frontend Next.js
│   ├── app/                      # App router (página única)
│   ├── components/               # Componentes UI (chat, paneles, etc.)
│   ├── lib/
│   │   ├── store.ts              # Zustand store + socket.io client
│   │   ├── db.ts                 # Prisma client
│   │   └── utils.ts              # cn() helper
│   └── components/ui/            # shadcn/ui components
├── prisma/
│   └── schema.prisma             # Conversations, Messages, Memories, Skills, Documents
├── mini-services/
│   └── agent-runtime/            # WebSocket mini-service (TS demo runtime)
│       └── index.ts              # Orchestrador + 5 agentes + 7 herramientas
├── python-backend/               # Backend Python de referencia (GPU NVIDIA)
│   ├── main.py                   # FastAPI + Socket.IO server
│   ├── config.py                 # Settings (model, paths, limits)
│   ├── llm.py                    # Ollama wrapper
│   ├── agents.py                 # CrewAI multi-agent system
│   ├── soul_default.py           # Default SOUL.md
│   ├── tools/
│   │   ├── __init__.py
│   │   └── tools.py              # 7 herramientas reales
│   └── requirements.txt
└── prisma/schema.prisma          # Modelo de datos
```

## 🔧 Configuración

### Variables de entorno

Crea `.env` en la raíz con:

```env
DATABASE_URL=file:./db/forge.db
# Opcional: si quieres usar el backend Python en lugar del runtime TS
NEXT_PUBLIC_AGENT_RUNTIME_URL=http://localhost:8000
```

### Configurar el backend Python

Edita `python-backend/config.py`:

```python
@dataclass
class Settings:
    ollama_host: str = "http://localhost:11434"
    model: str = "llama3.1:8b"          # ← cambia según tu GPU
    temperature: float = 0.7
    max_tokens: int = 2048
    code_timeout: int = 10              # segundos
    code_max_memory_mb: int = 512       # límite de memoria del sandbox
    web_search_max_results: int = 5
```

## 🔌 Protocolo WebSocket

El sistema usa un protocolo simple de eventos sobre Socket.IO. Funciona idéntico en el runtime TS y el backend Python:

### Cliente → Servidor

| Evento           | Payload                                  | Descripción                       |
|------------------|------------------------------------------|-----------------------------------|
| `run`            | `{message: string, runId: string}`      | Inicia una orquestación multi-agente |
| `memory:list`    | —                                        | Pide la lista de memorias         |
| `memory:add`     | `{content, kind?, pinned?}`              | Añade una memoria                 |
| `memory:clear`   | —                                        | Borra todas las memorias          |
| `skills:list`    | —                                        | Pide la lista de skills           |
| `document:add`   | `{id, filename, content, mimetype}`      | Sube un documento al RAG          |
| `document:list`  | —                                        | Pide la lista de documentos       |
| `soul:get`       | —                                        | Pide el SOUL.md actual            |
| `soul:update`    | `{content: string}`                      | Actualiza el SOUL.md              |

### Servidor → Cliente

| Evento                  | Payload                                                        |
|-------------------------|----------------------------------------------------------------|
| `agent_event`           | Evento del pipeline (ver tipos abajo)                          |
| `memory:list`           | `MemoryItem[]`                                                 |
| `memory:added`          | `{total: number}`                                              |
| `memory:cleared`        | —                                                              |
| `skills:list`           | `SkillItem[]`                                                  |
| `document:list`         | `DocumentItem[]`                                               |
| `document:added`        | `{id, filename, size}`                                         |
| `soul`                  | `string`                                                       |
| `agents:info`           | `Record<AgentName, {name, emoji, color}>`                     |

### Tipos de `agent_event`

```ts
type AgentEvent = {
  type: 'step_start' | 'step_end' | 'tool_call' | 'tool_result'
      | 'agent_message' | 'run_complete' | 'error' | 'plan'
  runId: string
  agent?: 'orchestrator' | 'coder' | 'researcher' | 'doc_analyst' | 'reviewer'
  content?: string
  toolName?: string
  toolArgs?: any
  toolResult?: any
  status?: 'pending' | 'running' | 'done' | 'error'
}
```

## 🆚 Diferencias con Hermes Agent

| Característica            | Hermes Agent                | Forge                          |
|---------------------------|-----------------------------|--------------------------------|
| **Multiplexado**          | 20+ plataformas mensajería  | Web app enfocada               |
| **Skills**                | ✅ Sistema completo + Hub    | ✅ Básico (crear/lookup)        |
| **Memoria**               | ✅ FTS5 + Honcho dialectic  | ✅ ChromaDB vectorial           |
| **SOUL.md**               | ✅                           | ✅ Igual                        |
| **MCP**                   | ✅                           | ❌ (roadmap)                    |
| **Multi-agent delegación**| ✅ Subagentes aislados       | ✅ CrewAI                       |
| **execute_code**          | ✅                           | ✅ Sandboxed Python             |
| **Voice mode**            | ✅                           | ❌ (roadmap)                    |
| **Cron**                  | ✅                           | ❌ (roadmap)                    |
| **Desktop app**           | ✅ (macOS/Linux/Windows)     | ❌ (web only)                   |
| **Foco**                  | Agente generalista           | **Desarrollo de aplicaciones** |

## 🛣️ Roadmap

- [ ] Soporte MCP (Model Context Protocol)
- [ ] Subagentes aislados en paralelo (en lugar de secuencia)
- [ ] Voice mode (Whisper + TTS local)
- [ ] Skills Hub compartido
- [ ] Plugins de editor (VSCode, JetBrains)
- [ ] Trajectory export para fine-tuning (estilo Atropos)
- [ ] Cron jobs / scheduled tasks
- [ ] Multi-usuario con autenticación

## 📝 Licencia

MIT

## 🙏 Créditos

- Inspirado en [Hermes Agent](https://github.com/nousresearch/hermes-agent) de [NousResearch](https://nousresearch.com)
- UI construida con [shadcn/ui](https://ui.shadcn.com)
- Multi-agente con [CrewAI](https://crewai.com)
- LLMs locales con [Ollama](https://ollama.ai)
- Vector store con [ChromaDB](https://trychroma.com)
