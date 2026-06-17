"""
Forge — Tools package.

Each tool is a Python function with a clear signature that agents can call.
Mirrors the tool names used by the TypeScript runtime so the frontend
works identically against either backend.

Tools:
    web_search(query)              — DuckDuckGo (no API key)
    doc_search(query)              — ChromaDB similarity search over uploaded docs
    execute_code(language, code)   — Sandboxed Python execution
    memory_remember(content, kind) — Store fact/preference in persistent memory
    memory_recall(query)           — Recall relevant memories
    skill_create(...)              — Create a reusable skill
    skill_lookup(query)            — Find an existing skill
"""
from .implementations import (
    web_search,
    doc_search,
    execute_code,
    memory_remember,
    memory_recall,
    skill_create,
    skill_lookup,
    ingest_document,
)

__all__ = [
    "web_search",
    "doc_search",
    "execute_code",
    "memory_remember",
    "memory_recall",
    "skill_create",
    "skill_lookup",
    "ingest_document",
]
