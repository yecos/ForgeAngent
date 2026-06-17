"""
Forge — Ollama client wrapper.

Wraps the ollama Python SDK with a thin interface matching what the
TypeScript runtime exposes (chat completions with system prompts).
"""
from typing import List, Dict, Any
import ollama
from .config import settings


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
    return response["message"]["content"]


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
        if chunk.get("message", {}).get("content"):
            yield chunk["message"]["content"]


def embed(text: str) -> List[float]:
    """Generate embeddings using the configured local model."""
    response = ollama.embeddings(
        model=settings.embedding_model,
        prompt=text,
    )
    return response["embedding"]


def list_models() -> List[str]:
    """List locally available Ollama models."""
    return [m["name"] for m in ollama.list().get("models", [])]
