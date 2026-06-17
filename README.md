# ⚒️ Forge — Multi-Agente Local para Desarrollo

Sistema multi-agente local inspirado en [Hermes Agent](https://github.com/nousresearch/hermes-agent) de NousResearch, optimizado para **desarrollo de aplicaciones** con GPU NVIDIA.

> 🔗 **Repositorio**: https://github.com/yecos/ForgeAngent

## ✨ Características

- **5 agentes especializados** coordinados por un Orchestrator (estilo Hermes)
- **100% local** con Ollama — tus datos nunca salen de tu máquina
- **Bilingüe ES/EN** — el agente se adapta al idioma del usuario
- **Memoria persistente** con ChromaDB (vectorial)
- **RAG sobre tus documentos** — sube PDFs, código, markdown
- **Búsqueda web** con DuckDuckGo (sin API key)
- **Ejecución de código** sandboxed con límites de memoria y tiempo
- **SOUL.md** — personalidad editable (Hermes-style)
- **Skills** — memoria procedural reutilizable
- **Streaming en tiempo real** vía WebSocket

---

## 📋 Requisitos

### Para el frontend Next.js
- **Node.js 18+** o **Bun** (recomendado: [instalar Bun](https://bun.sh))
- **npm** o **bun**

### Para el backend Python local (con GPU NVIDIA)
- **Python 3.10+**
- **Ollama** instalado ([https://ollama.ai](https://ollama.ai))
- **GPU NVIDIA** con CUDA (opcional pero recomendado para velocidad)
  - Mínimo: 8 GB VRAM (RTX 3060 / 4060)
  - Recomendado: 12-24 GB VRAM (RTX 4070 / 4080 / 4090)
- **RAM**: 16 GB mínimo, 32 GB recomendado
- **Disco**: ~10 GB para modelos y dependencias

### Sin GPU (alternativa)
- CPU moderna (8+ núcleos) con 16 GB RAM
- Modelos pequeños: `qwen2.5:1.5b` o `phi3.5:3.8b`

---

## 🚀 Instalación Local — Paso a Paso

### Paso 1: Clonar el repositorio

```bash
git clone https://github.com/yecos/ForgeAngent.git
cd ForgeAngent
```

### Paso 2: Instalar Ollama y descargar modelos

**Instalar Ollama:**

```bash
# Linux / WSL2
curl -fsSL https://ollama.ai/install.sh | sh

# macOS
brew install ollama

# Windows
# Descarga el instalador desde https://ollama.ai/download/windows
```

**Iniciar el servicio Ollama:**

```bash
ollama serve
```

**Descargar el modelo principal** (en otra terminal):

```bash
# Para 8-12 GB VRAM (RTX 3060/4060) — RECOMENDADO
ollama pull llama3.1:8b

# Para 12-24 GB VRAM (RTX 4070/4080)
# ollama pull llama3.1:13b
# ollama pull qwen2.5-coder:7b

# Para 24+ GB VRAM (RTX 4090)
# ollama pull llama3.1:70b
# ollama pull qwen2.5:32b

# Modelo de embeddings (REQUERIDO para memoria y RAG)
ollama pull nomic-embed-text
```

**Verificar que Ollama está corriendo:**

```bash
curl http://localhost:11434/api/tags
# Debe devolver un JSON con la lista de modelos instalados
```

### Paso 3: Backend Python (servidor de agentes)

#### Opción A: Automática (recomendada)

**Windows:**
```cmd
cd python-backend
start.bat
```

**Linux / macOS / WSL2:**
```bash
cd python-backend
chmod +x start.sh
./start.sh
```

El script automáticamente:
- Crea el entorno virtual `.venv`
- Instala las dependencias
- Verifica que Ollama esté corriendo
- Verifica que haya modelos descargados
- Arranca el servidor en `http://localhost:8000`

#### Opción B: Manual

```bash
cd python-backend

# Crear entorno virtual
python -m venv .venv

# Activar entorno virtual
# Linux / macOS / WSL2:
source .venv/bin/activate
# Windows (PowerShell):
# .venv\Scripts\Activate.ps1
# Windows (CMD):
# .venv\Scripts\activate.bat

# Actualizar pip
python -m pip install --upgrade pip

# Instalar dependencias
pip install -r requirements.txt
```

> ⚠️ **Si tienes errores de ResolutionImpossible o conflictos de dependencias:**
> 
> 1. Borra el entorno virtual: `rmdir /s /q .venv` (Windows) o `rm -rf .venv` (Unix)
> 2. Crea uno nuevo: `python -m venv .venv`
> 3. Actívalo y reinstala: `pip install -r requirements.txt`
> 
> Los nuevos `requirements.txt` eliminaron `crewai` (que causaba conflictos) y
> ahora usan versiones loose (`>=` en vez de `==`).

**Verificar configuración** (edita `python-backend/config.py` si necesitas cambiar el modelo):

```python
# python-backend/config.py
@dataclass
class Settings:
    ollama_host: str = "http://localhost:11434"
    model: str = "llama3.1:8b"          # ← cambia si usas otro modelo
    embedding_model: str = "nomic-embed-text"
    # ... resto de configuración
```

**Arrancar el backend:**

```bash
# Asegúrate de estar en python-backend/ con .venv activado
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Debes ver:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

**Verificar que el backend responde:**

```bash
curl http://localhost:8000/health
# {"status":"ok","model":"llama3.1:8b","models":["llama3.1:8b","nomic-embed-text"]}
```

### Paso 4: Configurar el frontend para usar el backend Python

Edita `src/lib/store.ts` y reemplaza la línea que crea el socket:

```typescript
// ANTES (apunta al mini-servicio TS de demostración):
socketSingleton = io('/?XTransformPort=3003', {
  transports: ['polling', 'websocket'],
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
})

// DESPUÉS (apunta a tu backend Python local):
socketSingleton = io('http://localhost:8000', {
  transports: ['websocket', 'polling'],
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
})
```

### Paso 5: Frontend Next.js

Abre **otra terminal** (mantén el backend Python corriendo en la primera):

```bash
# Vuelve a la raíz del proyecto
cd /ruta/a/ForgeAngent

# Instalar Bun si no lo tienes (opcional pero recomendado)
curl -fsSL https://bun.sh/install | bash

# Instalar dependencias
bun install
# o alternativamente:
# npm install

# Configurar variables de entorno
cp .env.example .env

# Inicializar la base de datos SQLite
bun run db:push
# o: npx prisma db push

# Arrancar el servidor de desarrollo
bun run dev
# o: npm run dev
```

Debes ver:
```
▲ Next.js 16.1.3 (Turbopack)
- Local:        http://localhost:3000
✓ Ready in 610ms
```

### Paso 6: Abrir la aplicación

Abre tu navegador en **http://localhost:3000**

Deberías ver:
- ⚒️ Logo de Forge
- Indicador "online" arriba a la derecha
- 4 ejemplos de tareas en el estado vacío
- Panel lateral con: Chat, Memoria, Skills, Docs, SOUL, Sistema

**¡Listo!** Prueba con:
> "Crea una API REST en Python con FastAPI para gestionar tareas"

Verás el pipeline multi-agente ejecutarse en tiempo real:
```
🧭 Orchestrator → 💻 Coder → ✅ Reviewer → 🧭 Orchestrator (síntesis)
```

---

## 🎮 Uso

### Chat multi-agente

Escribe tu request en español o inglés. El Orchestrator decidirá qué agentes actúan:

| Tipo de request | Agentes que actúan |
|---|---|
| "Crea una API REST en Python" | Coder → Reviewer |
| "Busca las novedades de Next.js 16" | Researcher → Reviewer |
| "Analiza los documentos que subí" | Doc Analyst |
| "Ejecuta este código y dime qué pasa" | Coder (con sandbox) |
| Tareas complejas | Orquestación completa |

Cada respuesta muestra el **pipeline de agentes** ejecutado, con detalles expandibles sobre:
- Plan generado por el Orchestrator
- Mensajes de cada agente
- Llamadas a herramientas y sus resultados
- Respuesta final sintetizada

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

Sube archivos `.txt`, `.md`, `.json`, `.csv`, `.py`, `.js`, `.html`, `.pdf`, `.docx`. El Doc Analyst los indexa en ChromaDB y los busca por similitud semántica cuando necesita responder preguntas basadas en ellos.

### SOUL.md

Edita la personalidad base del agente (Hermes-style). Cualquier cambio aplica inmediatamente a todos los agentes. Ejemplo de personalización:

```markdown
# SOUL — Forge para mi equipo

Eres Forge, asistente del equipo de Ingeniería de Datos.
- Siempre respondes en español
- Usas SQL con convenciones Snake Case
- Citas las fuentes con formato APA
- Para scripts de Python, usas type hints
```

---

## 🛠️ Solución de Problemas

### "Cannot connect to Ollama"

```bash
# Verifica que Ollama está corriendo
curl http://localhost:11434/api/tags

# Si no responde, inícialo
ollama serve

# En Linux verifica el servicio
systemctl status ollama
```

### "Model not found"

```bash
# Lista modelos instalados
ollama list

# Si falta el modelo, descárgalo
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

### "CUDA out of memory"

Tu GPU no tiene suficiente VRAM. Soluciones:
1. Usa un modelo más pequeño: `ollama pull qwen2.5:1.5b` y actualiza `config.py`
2. Cierra otras apps que usen GPU (juegos, navegadores con many tabs)
3. Reduce `max_tokens` en `config.py` (de 2048 a 1024)

### "Port 8000 already in use"

```bash
# Encuentra qué proceso usa el puerto
lsof -i :8000      # Linux/macOS
netstat -ano | findstr :8000   # Windows

# Mata el proceso o usa otro puerto:
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
# Recuerda actualizar src/lib/store.ts también
```

### "Port 3000 already in use"

```bash
# Next.js por defecto usa 3000
# Para cambiarlo:
bun run dev -- -p 3001
```

### "WebSocket connection failed" en el frontend

1. Verifica que el backend Python esté corriendo: `curl http://localhost:8000/health`
2. Verifica que `src/lib/store.ts` apunte a `http://localhost:8000` (Paso 4)
3. Revisa la consola del navegador (F12) para ver errores de conexión
4. Si usas el runtime TS de demostración en lugar del backend Python, mantén `/?XTransformPort=3003`

### "ChromaDB initialization failed"

```bash
# Borrar el directorio de ChromaDB (se regenera al arrancar)
rm -rf python-backend/data/chroma

# Reiniciar el backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### "Prisma database error"

```bash
# En la raíz del proyecto
bun run db:push   # o: npx prisma db push
bun run db:generate
```

### Errores de instalación de paquetes Python

```bash
# Actualiza pip y herramientas
pip install --upgrade pip setuptools wheel

# En Linux instala dependencias del sistema:
sudo apt install -y build-essential python3-dev

# sentence-transformers puede requerir:
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

---

## 📁 Estructura del Proyecto

```
ForgeAngent/
├── src/                              # Frontend Next.js
│   ├── app/
│   │   ├── page.tsx                  # Página principal con 6 paneles
│   │   ├── layout.tsx                # Layout raíz
│   │   └── globals.css               # Estilos globales
│   ├── components/
│   │   ├── chat-view.tsx             # Vista de chat con streaming
│   │   ├── chat-input.tsx            # Input con auto-resize
│   │   ├── agent-activity.tsx        # Visualizador del pipeline
│   │   ├── memory-panel.tsx          # Panel de memoria
│   │   ├── skills-panel.tsx          # Panel de skills
│   │   ├── documents-panel.tsx       # Subida de documentos
│   │   ├── soul-panel.tsx            # Editor SOUL.md
│   │   ├── settings-panel.tsx        # Estado del sistema
│   │   └── ui/                       # shadcn/ui components
│   ├── lib/
│   │   ├── store.ts                  # Zustand + Socket.IO client
│   │   ├── db.ts                     # Prisma client
│   │   └── utils.ts                  # cn() helper
│   └── hooks/
│       └── use-toast.ts
├── prisma/
│   └── schema.prisma                 # Conversation, Message, Memory, Skill, Document
├── python-backend/                   # Backend Python para GPU NVIDIA
│   ├── main.py                       # FastAPI + Socket.IO server
│   ├── config.py                     # Settings (modelo, paths, límites)
│   ├── llm.py                        # Ollama wrapper
│   ├── agents.py                     # CrewAI multi-agent system
│   ├── soul_default.py               # SOUL.md por defecto
│   ├── tools/
│   │   ├── __init__.py
│   │   └── tools.py                  # 7 herramientas reales
│   ├── requirements.txt
│   └── README.py                     # Docstring con instrucciones
├── mini-services/
│   └── agent-runtime/                # Runtime TS (demo, sin GPU)
│       ├── index.ts                  # Orchestrador + 5 agentes + 7 herramientas
│       └── package.json
├── examples/
│   └── websocket/                    # Ejemplo de WebSocket
├── public/
│   ├── logo.svg
│   └── robots.txt
├── .env.example                      # Plantilla de variables de entorno
├── .gitignore
├── README.md                         # Este archivo
├── package.json                      # Dependencias frontend
├── bun.lock
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json                   # Config shadcn/ui
└── Caddyfile                         # Config gateway (solo preview)
```

---

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
│  Agent Runtime (Python con FastAPI + Socket.IO)                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Orchestrator → plan → delegate → synthesize             │  │
│  │       ↓         ↓         ↓           ↓                  │  │
│  │   Coder    Researcher  Doc Analyst  Reviewer             │  │
│  │   (code)   (web)        (RAG)         (verify)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↕                                       │
├─────────────────────────────────────────────────────────────────┤
│  Stack Local                                                    │
│  • Ollama (LLM en GPU)         • ChromaDB (vectores)           │
│  • DuckDuckGo (web search)     • Sandbox (subprocess)          │
└─────────────────────────────────────────────────────────────────┘
```

---

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

---

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

---

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

---

## 🛣️ Roadmap

- [ ] Soporte MCP (Model Context Protocol)
- [ ] Subagentes aislados en paralelo (en lugar de secuencia)
- [ ] Voice mode (Whisper + TTS local)
- [ ] Skills Hub compartido
- [ ] Plugins de editor (VSCode, JetBrains)
- [ ] Trajectory export para fine-tuning (estilo Atropos)
- [ ] Cron jobs / scheduled tasks
- [ ] Multi-usuario con autenticación
- [ ] Desktop app (Tauri)

---

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit tus cambios: `git commit -m 'feat: añadir nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## 📝 Licencia

MIT

## 🙏 Créditos

- Inspirado en [Hermes Agent](https://github.com/nousresearch/hermes-agent) de [NousResearch](https://nousresearch.com)
- UI construida con [shadcn/ui](https://ui.shadcn.com)
- Multi-agente con [CrewAI](https://crewai.com)
- LLMs locales con [Ollama](https://ollama.ai)
- Vector store con [ChromaDB](https://trychroma.com)
