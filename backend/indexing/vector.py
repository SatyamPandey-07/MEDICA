"""
MEDICA Vector Index
Manages semantic embeddings using pgvector.
Supports pluggable embedding providers: local (sentence-transformers), Gemini, OpenAI.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import EmbeddingProvider, settings
from core.logging import get_logger
from core.types import PaperMetadata
from shared.database import get_session
from shared.models import PaperEmbedding

logger = get_logger(__name__)


# ============================================================
# Embedding Provider Interface
# ============================================================

class EmbeddingProviderBase(ABC):
    """Abstract interface for all embedding providers."""

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of texts, return list of float vectors."""
        ...

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Return the vector dimension size."""
        ...


class LocalEmbeddingProvider(EmbeddingProviderBase):
    """
    Local embedding using sentence-transformers.
    No API key required. Runs on CPU.
    Default model: all-MiniLM-L6-v2 (384 dims)
    """

    def __init__(self) -> None:
        self._model = None

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(settings.embedding_model)
            logger.info("embedding_model_loaded", model=settings.embedding_model)
        return self._model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        import asyncio
        model = self._get_model()
        # Run CPU-bound inference in thread pool
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None, lambda: model.encode(texts, show_progress_bar=False).tolist()
        )
        return embeddings

    @property
    def dimensions(self) -> int:
        return 384


class GeminiEmbeddingProvider(EmbeddingProviderBase):
    """Google Gemini embedding provider. Requires GEMINI_API_KEY."""

    async def embed(self, texts: list[str]) -> list[list[float]]:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        result = []
        for text in texts:
            response = genai.embed_content(
                model=f"models/{settings.embedding_model}",
                content=text,
                task_type="retrieval_document",
            )
            result.append(response["embedding"])
        return result

    @property
    def dimensions(self) -> int:
        return 768


class OpenAIEmbeddingProvider(EmbeddingProviderBase):
    """OpenAI embedding provider. Requires OPENAI_API_KEY."""

    def __init__(self) -> None:
        self._client = None

    async def embed(self, texts: list[str]) -> list[list[float]]:
        from openai import AsyncOpenAI
        if self._client is None:
            self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await self._client.embeddings.create(
            input=texts, model=settings.embedding_model
        )
        return [item.embedding for item in response.data]

    @property
    def dimensions(self) -> int:
        return 1536  # text-embedding-3-small


def create_embedding_provider() -> EmbeddingProviderBase:
    """Factory: create embedding provider based on config."""
    if settings.embedding_provider == EmbeddingProvider.GEMINI:
        return GeminiEmbeddingProvider()
    elif settings.embedding_provider == EmbeddingProvider.OPENAI:
        return OpenAIEmbeddingProvider()
    else:
        return LocalEmbeddingProvider()


# ============================================================
# Vector Index
# ============================================================

class VectorIndex:
    """
    Manages paper embeddings in pgvector.

    Indexes:
      - Abstract embedding (primary for semantic search)
      - Title embedding (for title-focused queries)

    Uses cosine similarity for retrieval.
    """

    def __init__(self) -> None:
        self.provider = create_embedding_provider()

    async def _ensure_ivfflat_index(self, session: AsyncSession) -> None:
        """Create IVFFlat index for fast ANN search if it doesn't exist."""
        try:
            await session.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_embeddings_vector "
                "ON paper_embeddings USING ivfflat (vector vector_cosine_ops) "
                "WITH (lists = 100)"
            ))
            await session.commit()
        except Exception as e:
            logger.warning("ivfflat_index_creation_warning", error=str(e))

    async def index_paper(self, paper: PaperMetadata) -> None:
        """Generate and store embeddings for a paper."""
        texts_to_embed = []
        embed_types = []

        # Always embed abstract
        if paper.abstract:
            texts_to_embed.append(f"{paper.title}\n\n{paper.abstract}")
            embed_types.append("abstract")

        # Also embed title alone
        texts_to_embed.append(paper.title)
        embed_types.append("title")

        if not texts_to_embed:
            return

        try:
            vectors = await self.provider.embed(texts_to_embed)

            async with get_session() as session:
                for embed_type, vector in zip(embed_types, vectors):
                    embedding = PaperEmbedding(
                        paper_id=paper.id,
                        embedding_type=embed_type,
                        embedding_model=settings.embedding_model,
                        vector=vector,
                    )
                    session.add(embedding)

            logger.debug("paper_embedded", pmid=paper.pmid, types=embed_types)

        except Exception as e:
            logger.error("embedding_failed", pmid=paper.pmid, error=str(e))

    async def search(
        self,
        query: str,
        limit: int = 10,
        embedding_type: str = "abstract",
    ) -> list[tuple[UUID, float]]:
        """
        Semantic search using cosine similarity.

        Returns list of (paper_id, similarity_score) tuples.
        """
        query_vectors = await self.provider.embed([query])
        query_vector = query_vectors[0]

        async with get_session() as session:
            result = await session.execute(
                text("""
                    SELECT paper_id, 1 - (vector <=> CAST(:query_vec AS vector)) AS similarity
                    FROM paper_embeddings
                    WHERE embedding_type = :embed_type
                    ORDER BY vector <=> CAST(:query_vec AS vector)
                    LIMIT :limit
                """),
                {
                    "query_vec": str(query_vector),
                    "embed_type": embedding_type,
                    "limit": limit,
                },
            )
            rows = result.fetchall()
            return [(row.paper_id, float(row.similarity)) for row in rows]

    async def embed_query(self, query: str) -> list[float]:
        """Embed a query string for external use."""
        vectors = await self.provider.embed([query])
        return vectors[0]
