"""
Forge — Tool implementations (real local versions of the TS demo tools).

Each tool returns a JSON-serializable dict that gets sent to the agent
and the frontend.

Cross-platform: works on Linux, macOS and Windows.
  - Memory limits use `resource` on Unix; on Windows we skip them (subprocess
    timeout still applies).
  - Code execution uses `subprocess.run` with `timeout` everywhere.
"""
from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List

from duckduckgo_search import DDGS

from config import settings
from llm import embed

# ──────────────────────────────────────────────────────────────────────
#  Cross-platform resource module
# ──────────────────────────────────────────────────────────────────────

try:
    import resource  # Unix only
    _HAS_RESOURCE = True
except ImportError:
    resource = None  # type: ignore
    _HAS_RESOURCE = False


# ──────────────────────────────────────────────────────────────────────
#  Memory — backed by ChromaDB (persistent vector store)
# ──────────────────────────────────────────────────────────────────────

try:
    import chromadb
    _chroma = chromadb.PersistentClient(path=str(settings.chroma_path))
    _mem_col = _chroma.get_or_create_collection("memories")
    _doc_col = _chroma.get_or_create_collection("documents")
    _skill_col = _chroma.get_or_create_collection("skills")
except Exception as e:  # noqa: BLE001
    print(f"[forge] ChromaDB init failed (memory/doc/skill features disabled): {e}")
    _chroma = None
    _mem_col = None
    _doc_col = None
    _skill_col = None


def _safe_add(collection, ids: List[str], documents: List[str], metadatas: List[Dict]):
    if collection is None:
        return
    try:
        embeddings = [embed(d) for d in documents]
        collection.add(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
    except Exception as e:  # noqa: BLE001
        print(f"[forge] vector add failed: {e}")


def _safe_query(collection, query: str, n: int = 5):
    if collection is None:
        return []
    try:
        qe = embed(query)
        r = collection.query(query_embeddings=[qe], n_results=n)
        return list(zip(r["ids"][0], r["documents"][0], r["metadatas"][0]))
    except Exception as e:  # noqa: BLE001
        print(f"[forge] vector query failed: {e}")
        return []


# ──────────────────────────────────────────────────────────────────────
#  Web search — DuckDuckGo (no API key required)
# ──────────────────────────────────────────────────────────────────────

def web_search(query: str, num: int | None = None) -> Any:
    """Real web search via DuckDuckGo."""
    n = num or settings.web_search_max_results
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=n))
        return [
            {
                "title": r.get("title"),
                "url": r.get("href") or r.get("link"),
                "snippet": r.get("body") or r.get("snippet"),
                "host": (r.get("href", "") or "").split("/")[2] if r.get("href") else "",
            }
            for r in results
        ]
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


# ──────────────────────────────────────────────────────────────────────
#  Document RAG — ChromaDB over uploaded files
# ──────────────────────────────────────────────────────────────────────

def doc_search(query: str, n: int = 3) -> Any:
    """Search uploaded documents by semantic similarity."""
    if _doc_col is None:
        return {"error": "Vector store not available"}
    try:
        results = _safe_query(_doc_col, query, n)
        if not results:
            return {"error": "No matching passages found."}
        return [
            {
                "document": meta.get("filename", "unknown"),
                "documentId": meta.get("doc_id", ""),
                "excerpt": doc[:600],
                "position": meta.get("offset", 0),
            }
            for _id, doc, meta in results
        ]
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


def ingest_document(doc_id: str, filename: str, text: str, chunk_size: int = 800):
    """Chunk and ingest a document into the vector store."""
    if _doc_col is None:
        return
    chunks = []
    for i in range(0, len(text), chunk_size):
        chunk = text[i : i + chunk_size]
        if chunk.strip():
            chunks.append(chunk)
    if not chunks:
        return
    ids = [f"{doc_id}-{i}" for i in range(len(chunks))]
    metas = [
        {"doc_id": doc_id, "filename": filename, "offset": i * chunk_size}
        for i in range(len(chunks))
    ]
    _safe_add(_doc_col, ids, chunks, metas)


# ──────────────────────────────────────────────────────────────────────
#  Code execution — sandboxed Python subprocess (cross-platform)
# ──────────────────────────────────────────────────────────────────────

_BLOCKED_ATTRS = {
    "os.system", "os.popen", "os.exec", "os.spawn",
    "subprocess.Popen", "subprocess.run", "subprocess.call",
    "socket.socket", "shutil.rmtree",
}


def _validate_code(code: str) -> tuple[bool, str]:
    """Static check: parse AST and reject unsafe patterns."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"SyntaxError: {e}"
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute):
            attr_chain: List[str] = []
            n = node
            while isinstance(n, ast.Attribute):
                attr_chain.append(n.attr)
                n = n.value
            if isinstance(n, ast.Name):
                attr_chain.append(n.id)
                full = ".".join(reversed(attr_chain))
                for blocked in _BLOCKED_ATTRS:
                    if full.startswith(blocked):
                        return False, f"Blocked: {full}"
    return True, ""


def _set_unix_limits():
    """Pre-exec function for Unix — sets memory limit on the subprocess."""
    if not _HAS_RESOURCE:
        return
    limit = settings.code_max_memory_mb * 1024 * 1024
    try:
        resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
    except Exception:
        pass  # best-effort


def execute_code(language: str, code: str) -> Any:
    """Run Python code in a sandboxed subprocess with timeout."""
    if language.lower() not in ("python", "py", "python3"):
        return {
            "supported": False,
            "message": f"Language '{language}' not supported. Use 'python'.",
        }

    ok, err = _validate_code(code)
    if not ok:
        return {"supported": True, "language": "python", "error": err}

    # Write to a temp file
    workdir = settings.code_workdir
    workdir.mkdir(parents=True, exist_ok=True)
    script_path = workdir / f"exec_{os.getpid()}_{abs(hash(code)) & 0xFFFFFFFF:x}.py"
    script_path.write_text(code, encoding="utf-8")

    # Build subprocess kwargs — cross-platform
    subprocess_kwargs: Dict[str, Any] = {
        "capture_output": True,
        "text": True,
        "timeout": settings.code_timeout,
        "cwd": str(workdir),
        # Restricted environment
        "env": {
            "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
            "PYTHONPATH": "",
            "PYTHONIOENCODING": "utf-8",
        },
    }

    # Unix-only: memory limit via preexec_fn
    if _HAS_RESOURCE:
        subprocess_kwargs["preexec_fn"] = _set_unix_limits
    # Windows-only: use CREATE_NEW_PROCESS_GROUP to isolate
    if sys.platform == "win32":
        subprocess_kwargs["creationflags"] = 0x00000200  # CREATE_NEW_PROCESS_GROUP

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            **subprocess_kwargs,
        )
        return {
            "supported": True,
            "language": "python",
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "supported": True,
            "language": "python",
            "error": f"Timeout after {settings.code_timeout}s",
        }
    except Exception as e:  # noqa: BLE001
        return {
            "supported": True,
            "language": "python",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }
    finally:
        try:
            script_path.unlink()
        except Exception:
            pass


# ──────────────────────────────────────────────────────────────────────
#  Memory — facts and preferences
# ──────────────────────────────────────────────────────────────────────

def memory_remember(content: str, kind: str = "fact") -> Any:
    """Persist a memory in the vector store."""
    if _mem_col is None:
        return {"error": "Vector store not available"}
    import uuid
    mid = str(uuid.uuid4())
    _safe_add(
        _mem_col,
        [mid],
        [content],
        [{"kind": kind, "source": "agent"}],
    )
    return {"stored": True, "id": mid}


def memory_recall(query: str, n: int = 5) -> Any:
    """Retrieve relevant memories."""
    if _mem_col is None:
        return {"error": "Vector store not available"}
    results = _safe_query(_mem_col, query, n)
    if not results:
        return {"note": "No matching memories."}
    return [{"id": _id, "content": doc, **meta} for _id, doc, meta in results]


# ──────────────────────────────────────────────────────────────────────
#  Skills — procedural memory
# ──────────────────────────────────────────────────────────────────────

def skill_create(name: str, description: str, trigger: str, steps: List[str]) -> Any:
    """Create or update a skill in the vector store."""
    if _skill_col is None:
        return {"error": "Vector store not available"}
    try:
        existing = _skill_col.get(where={"name": name})
        if existing["ids"]:
            _skill_col.delete(ids=existing["ids"])
    except Exception:
        pass
    content = f"{name}\n{description}\n{trigger}\n" + "\n".join(steps)
    _safe_add(
        _skill_col,
        [name],
        [content],
        [{"name": name, "description": description, "trigger": trigger, "steps": json.dumps(steps)}],
    )
    return {"created": True, "name": name}


def skill_lookup(query: str, n: int = 3) -> Any:
    """Find skills relevant to a query."""
    if _skill_col is None:
        return {"error": "Vector store not available"}
    results = _safe_query(_skill_col, query, n)
    if not results:
        return {"note": "No matching skills."}
    return [
        {
            "name": meta.get("name"),
            "description": meta.get("description"),
            "trigger": meta.get("trigger"),
            "steps": json.loads(meta.get("steps", "[]")),
        }
        for _id, _doc, meta in results
    ]
