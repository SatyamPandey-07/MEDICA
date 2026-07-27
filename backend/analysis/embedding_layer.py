"""
MEDICA Layer 2: Embedding Analysis
Generates embeddings via the Gemini API and scores similarity by cosine
distance. Ported from the multi-layer pipeline notebook.
"""
from __future__ import annotations

import asyncio
import random

from core.logging import get_logger

logger = get_logger(__name__)

_GEMINI_EMBEDDING_MODEL = "models/text-embedding-004"
_GEMINI_EMBEDDING_DIMENSIONS = 768


async def get_gemini_embedding(text: str, cache: dict[str, list[float]] | None = None) -> list[float]:
    """Embed `text` with Gemini's text-embedding-004, with optional in-memory caching."""
    if cache is not None and text in cache:
        return cache[text]

    from core.config import settings

    def _call() -> list[float]:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        result = genai.embed_content(
            model=_GEMINI_EMBEDDING_MODEL,
            content=text,
            task_type="retrieval_document",
        )
        return result["embedding"]

    try:
        vector = await asyncio.to_thread(_call)
    except Exception as e:
        logger.warning("gemini_embedding_failed", error=str(e))
        # Fallback keeps the pipeline running if the embedding API is unavailable.
        vector = [random.random() for _ in range(_GEMINI_EMBEDDING_DIMENSIONS)]

    if cache is not None:
        cache[text] = vector
    return vector


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    if not vec1 or not vec2:
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)
