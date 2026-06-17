"""
Forge — Ollama client wrapper.

Wraps the ollama Python SDK with a thin interface matching what the
TypeScript runtime exposes (chat completions with system prompts).
"""
from typing import List, Dict, Any
import ollama
from config import settings


def chat(messages: List[Dict[str, str]], **kwargs) -> str:
    """Synchronous chat completion against the local Ollama server."""
    response = ollama.chat(
        model=settings.model,
        messages=messages,
        options={
            "temperature": kwargs.get("temperature", settings.temperature),
            "num_predict": kwargs.get("max_tokens", settings.max_tokens),
        },
    )
    # SDK 0.4+ returns a Pydantic ChatResponse; older returned a dict.
    if hasattr(response, "message"):
        return response.message.content or ""
    if isinstance(response, dict):
        return response.get("message", {}).get("content", "")
    return ""


def stream(messages: List[Dict[str, str]], **kwargs):
    """Streaming chat completion — yields content chunks."""
    for chunk in ollama.chat(
        model=settings.model,
        messages=messages,
        stream=True,
        options={
            "temperature": kwargs.get("temperature", settings.temperature),
            "num_predict": kwargs.get("max_tokens", settings.max_tokens),
        },
    ):
        # Handle both dict and Pydantic chunk shapes
        if isinstance(chunk, dict):
            content = chunk.get("message", {}).get("content")
        else:
            content = getattr(getattr(chunk, "message", None), "content", None)
        if content:
            yield content


def embed(text: str) -> List[float]:
    """Generate embeddings using the configured local model."""
    response = ollama.embeddings(
        model=settings.embedding_model,
        prompt=text,
    )
    # Handle both dict and Pydantic shapes
    if isinstance(response, dict):
        return response.get("embedding", [])
    return getattr(response, "embedding", []) or []


def list_models() -> List[str]:
    """
    List locally available Ollama models.

    Handles all SDK versions:
      - Old dict:  {"models": [{"name": "llama3.1:8b"}, ...]}
      - New dict:  {"models": [{"model": "llama3.1:8b"}, ...]}
      - Pydantic:  ListResponse(models=[Model(model="llama3.1:8b", ...)])
    """
    try:
        response = ollama.list()
    except Exception as e:
        print(f"[forge] ollama.list() failed: {e}")
        return []

    # Get the models list (dict or Pydantic)
    if hasattr(response, "models"):
        models = response.models
    elif isinstance(response, dict):
        models = response.get("models", [])
    else:
        models = []

    names: List[str] = []
    for m in models:
        name = None
        # Pydantic Model object — newer SDKs use .model
        if hasattr(m, "model") and getattr(m, "model"):
            name = m.model
        elif hasattr(m, "name") and getattr(m, "name"):
            name = m.name
        # Dict shape
        elif isinstance(m, dict):
            name = m.get("model") or m.get("name")
        if name:
            names.append(name)
    return names
