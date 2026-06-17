"""
Forge — FastAPI + Socket.IO server.

Entry point. Run with:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

Exposes the same WebSocket protocol as the TypeScript runtime so the
Next.js frontend connects transparently.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any, Dict, List

import socketio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents import run_orchestration
from config import settings
from llm import chat, list_models
from soul_default import DEFAULT_SOUL_MD
from forge_tools import (
    web_search,
    doc_search,
    execute_code,
    memory_remember,
    memory_recall,
    skill_create,
    skill_lookup,
)
from forge_tools.implementations import ingest_document

# ──────────────────────────────────────────────────────────────────────
#  State
# ──────────────────────────────────────────────────────────────────────

# In-memory stores (mirrors the TS runtime; for production use SQLite/Prisma)
_memories: List[Dict[str, Any]] = []
_skills: List[Dict[str, Any]] = []
_documents: List[Dict[str, Any]] = []

# Load SOUL.md
if settings.soul_path.exists():
    SOUL_MD = settings.soul_path.read_text(encoding="utf-8")
else:
    SOUL_MD = DEFAULT_SOUL_MD
    settings.soul_path.write_text(SOUL_MD, encoding="utf-8")


# ──────────────────────────────────────────────────────────────────────
#  FastAPI app
# ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Forge Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.model, "models": list_models()}


# ── Status endpoints (graceful responses for common polling paths) ─────
# Some clients (e.g. other agent dashboards open in the browser) poll
# generic status endpoints. We return a friendly Forge-branded response
# instead of a confusing 404.

@app.get("/api/status")
@app.get("/api/system")
async def api_status():
    return {
        "service": "Forge",
        "version": "1.0.0",
        "status": "running",
        "model": settings.model,
        "endpoints": [
            "/health",
            "/api/status",
            "/api/tools",
            "/documents",
            "/memory",
            "/soul",
            "socket.io (WebSocket)",
        ],
    }


@app.get("/api/tools")
async def api_tools():
    """List available tools for the agents."""
    return {
        "tools": [
            {"name": "web_search", "description": "DuckDuckGo web search"},
            {"name": "doc_search", "description": "Semantic search over uploaded documents"},
            {"name": "execute_code", "description": "Sandboxed Python execution"},
            {"name": "memory_remember", "description": "Store a fact or preference"},
            {"name": "memory_recall", "description": "Recall relevant memories"},
            {"name": "skill_create", "description": "Create a reusable skill"},
            {"name": "skill_lookup", "description": "Look up an existing skill"},
        ]
    }


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a document, extract text, and ingest into ChromaDB."""
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    doc = {
        "id": doc_id,
        "filename": file.filename,
        "content": text,
        "mimetype": file.content_type or "text/plain",
        "size": len(content),
    }
    _documents.append(doc)
    ingest_document(doc_id, file.filename, text)
    return {"id": doc_id, "filename": file.filename, "size": len(content)}


@app.get("/documents")
async def list_documents():
    return [{"id": d["id"], "filename": d["filename"], "size": d["size"]} for d in _documents]


@app.get("/memory")
async def list_memory():
    return _memories


@app.post("/memory")
async def add_memory(content: str, kind: str = "fact", pinned: bool = False):
    item = {"kind": kind, "content": content, "source": "user", "pinned": pinned}
    _memories.append(item)
    memory_remember(content, kind)
    return {"stored": True, "total": len(_memories)}


@app.get("/soul")
async def get_soul():
    return {"content": SOUL_MD}


@app.post("/soul")
async def update_soul(content: str):
    global SOUL_MD
    SOUL_MD = content
    settings.soul_path.write_text(content, encoding="utf-8")
    return {"updated": True}


# ──────────────────────────────────────────────────────────────────────
#  Socket.IO server (same protocol as the TS runtime)
# ──────────────────────────────────────────────────────────────────────
#
# IMPORTANT: do NOT use app.mount('/socket.io', ...) — that pattern breaks
# python-socketio because Starlette strips the mount prefix from the path
# before forwarding to the sub-app. The Socket.IO server expects the path
# to be /socket.io/... and receives /... instead, returning 404 to the client.
#
# Correct pattern: wrap the FastAPI app inside socketio.ASGIApp via
# `other_asgi_app`. The combined ASGI app routes:
#   - /socket.io/*  → python-socketio
#   - everything else → FastAPI (including /health, /api/status, etc.)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")


@sio.event
async def connect(sid, environ):
    print(f"[forge] connected: {sid}")
    await sio.emit("agents:info", {}, to=sid)
    await sio.emit("memory:list", _memories, to=sid)
    await sio.emit("skills:list", _skills, to=sid)
    await sio.emit("document:list", [{"id": d["id"], "filename": d["filename"], "size": d["size"]} for d in _documents], to=sid)
    await sio.emit("soul", SOUL_MD, to=sid)


@sio.event
async def disconnect(sid):
    print(f"[forge] disconnected: {sid}")


@sio.on("run")
async def on_run(sid, data):
    """Trigger a multi-agent orchestration run."""
    message = data.get("message", "")
    run_id = data.get("runId", f"run-{uuid.uuid4().hex[:8]}")

    loop = asyncio.get_event_loop()

    def emit(event: dict):
        """Bridge sync emit → async sio.emit."""
        evt = {**event, "runId": run_id}
        asyncio.run_coroutine_threadsafe(sio.emit("agent_event", evt, to=sid), loop)

    # Run the (sync, blocking) orchestration in a thread
    def work():
        try:
            run_orchestration(message, on_event=emit)
        except Exception as e:
            emit({"type": "error", "content": str(e)})

    await asyncio.to_thread(work)


@sio.on("memory:list")
async def on_memory_list(sid):
    await sio.emit("memory:list", _memories, to=sid)


@sio.on("memory:add")
async def on_memory_add(sid, data):
    item = {
        "kind": data.get("kind", "fact"),
        "content": data.get("content", ""),
        "source": "user",
        "pinned": data.get("pinned", False),
    }
    _memories.append(item)
    memory_remember(item["content"], item["kind"])
    await sio.emit("memory:added", {"total": len(_memories)})


@sio.on("memory:clear")
async def on_memory_clear(sid):
    _memories.clear()
    await sio.emit("memory:cleared")


@sio.on("skills:list")
async def on_skills_list(sid):
    await sio.emit("skills:list", _skills, to=sid)


@sio.on("document:add")
async def on_document_add(sid, data):
    """Add a document from base64 or text content."""
    doc_id = data.get("id", f"doc-{uuid.uuid4().hex[:8]}")
    doc = {
        "id": doc_id,
        "filename": data.get("filename", "untitled"),
        "content": data.get("content", ""),
        "mimetype": data.get("mimetype", "text/plain"),
        "size": len(data.get("content", "").encode("utf-8")),
    }
    _documents.append(doc)
    ingest_document(doc_id, doc["filename"], doc["content"])
    await sio.emit("document:added", {"id": doc_id, "filename": doc["filename"], "size": doc["size"]})


@sio.on("document:list")
async def on_document_list(sid):
    await sio.emit("document:list", [{"id": d["id"], "filename": d["filename"], "size": d["size"]} for d in _documents], to=sid)


@sio.on("soul:get")
async def on_soul_get(sid):
    await sio.emit("soul", SOUL_MD, to=sid)


@sio.on("soul:update")
async def on_soul_update(sid, data):
    global SOUL_MD
    SOUL_MD = data.get("content", SOUL_MD)
    settings.soul_path.write_text(SOUL_MD, encoding="utf-8")
    await sio.emit("soul", SOUL_MD)


@sio.on("agents:info")
async def on_agents_info(sid):
    await sio.emit("agents:info", {
        "orchestrator": {"name": "Orchestrator", "emoji": "🧭", "color": "#f59e0b"},
        "coder": {"name": "Coder", "emoji": "💻", "color": "#10b981"},
        "researcher": {"name": "Researcher", "emoji": "🔍", "color": "#3b82f6"},
        "doc_analyst": {"name": "Doc Analyst", "emoji": "📚", "color": "#a855f7"},
        "reviewer": {"name": "Reviewer", "emoji": "✅", "color": "#ec4899"},
    }, to=sid)


@sio.on("tool:web_search")
async def on_tool_web_search(sid, data):
    results = web_search(data.get("query", ""))
    await sio.emit("tool:web_search:result", {"query": data.get("query"), "results": results}, to=sid)


# ──────────────────────────────────────────────────────────────────────
#  Combined ASGI app: Socket.IO + FastAPI
# ──────────────────────────────────────────────────────────────────────
# This MUST be at the very end of the module so that all routes and sio
# handlers are already registered. `app` is reassigned to the combined
# ASGI app, which is what uvicorn imports as `main:app`.

app = socketio.ASGIApp(sio, other_asgi_app=app)


# ──────────────────────────────────────────────────────────────────────
#  Run with uvicorn
# ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
