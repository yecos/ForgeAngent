"""
Forge — Configuración central del backend Python.

Ajusta estos valores antes de arrancar el backend.
"""
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Settings:
    # ── Ollama ────────────────────────────────────────────────────────────
    # Modelo principal usado por todos los agentes.
    # Recomendado por perfil de hardware:
    #   8-12 GB VRAM (RTX 3060/4060):  llama3.1:8b  | qwen2.5-coder:7b
    #   12-24 GB VRAM (RTX 4070/4080): llama3.1:13b | qwen2.5:14b
    #   24+  GB VRAM (RTX 4090):       llama3.1:70b | qwen2.5:32b
    ollama_host: str = "http://localhost:11434"
    model: str = "llama3.1:8b"
    embedding_model: str = "nomic-embed-text"  # ollama pull nomic-embed-text
    temperature: float = 0.7
    max_tokens: int = 2048

    # ── Server ────────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list = field(default_factory=lambda: ["*"])

    # ── Persistence ───────────────────────────────────────────────────────
    # ChromaDB directory (vector memory + document index)
    chroma_path: Path = Path("./data/chroma")
    # SQLite database for chat history, skills, memories metadata
    sqlite_path: Path = Path("./data/forge.db")
    # Uploaded documents
    documents_path: Path = Path("./data/documents")

    # ── Code Sandbox ──────────────────────────────────────────────────────
    # Time limit (seconds) for code execution
    code_timeout: int = 10
    # Max memory (MB) for code execution subprocess
    code_max_memory_mb: int = 512
    # Working directory for code execution
    code_workdir: Path = Path("./data/sandbox")

    # ── SOUL.md ───────────────────────────────────────────────────────────
    soul_path: Path = Path("./SOUL.md")

    # ── Web search ────────────────────────────────────────────────────────
    web_search_max_results: int = 5


settings = Settings()

# Ensure directories exist
for p in [settings.chroma_path, settings.documents_path, settings.code_workdir]:
    p.mkdir(parents=True, exist_ok=True)
