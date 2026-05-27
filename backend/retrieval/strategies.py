"""
MEDICA Retrieval Strategies
Pluggable retrieval strategies implementing the Strategy Pattern.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from core.types import EvidenceLevel, RetrievalResult, SearchQuery
from indexing.metadata import MetadataIndex
from indexing.vector import VectorIndex

# Import here to avoid circular — resolved at runtime
from shared.models import PaperRecord


def _record_to_metadata(record: PaperRecord):
    """Lazy import to avoid circular dependency."""
    from retrieval.engine import _record_to_metadata as _convert
    return _convert(record)


class RetrievalStrategy(ABC):
    """Abstract base for all retrieval strategies."""

    @abstractmethod
    async def retrieve(self, query: SearchQuery) -> list[RetrievalResult]:
        ...


class SemanticStrategy(RetrievalStrategy):
    """Pure semantic vector search using pgvector cosine similarity."""

    def __init__(self, vector_index: VectorIndex, metadata_index: MetadataIndex) -> None:
        self.vector_index = vector_index
        self.metadata_index = metadata_index

    async def retrieve(self, query: SearchQuery) -> list[RetrievalResult]:
        vector_results = await self.vector_index.search(
            query.query, limit=query.limit * 2
        )
        results = []
        for paper_id, score in vector_results:
            record = await self.metadata_index.get_by_id(paper_id)
            if record:
                results.append(RetrievalResult(
                    paper=_record_to_metadata(record),
                    score=score,
                    strategy="semantic",
                    snippet=record.abstract[:300] if record.abstract else None,
                ))
        return results


class TagStrategy(RetrievalStrategy):
    """Tag-based exact retrieval. Filters by cancer/drug/biomarker tags."""

    def __init__(self, metadata_index: MetadataIndex) -> None:
        self.metadata_index = metadata_index

    async def retrieve(self, query: SearchQuery) -> list[RetrievalResult]:
        records = await self.metadata_index.filter_papers(
            cancer_tags=query.cancer_filter or None,
            drug_tags=query.drug_filter or None,
            evidence_levels=query.evidence_filter or None,
            date_from=query.date_from,
            date_to=query.date_to,
            limit=query.limit * 2,
        )
        return [
            RetrievalResult(
                paper=_record_to_metadata(r),
                score=r.confidence_score or 0.0,
                strategy="tag",
                snippet=r.abstract[:300] if r.abstract else None,
            )
            for r in records
        ]


class TemporalStrategy(RetrievalStrategy):
    """Date-filtered retrieval sorted by recency."""

    def __init__(self, metadata_index: MetadataIndex) -> None:
        self.metadata_index = metadata_index

    async def retrieve(self, query: SearchQuery) -> list[RetrievalResult]:
        records = await self.metadata_index.filter_papers(
            date_from=query.date_from,
            date_to=query.date_to,
            limit=query.limit * 2,
        )
        return [
            RetrievalResult(
                paper=_record_to_metadata(r),
                score=r.confidence_score or 0.0,
                strategy="temporal",
                snippet=r.abstract[:300] if r.abstract else None,
            )
            for r in records
        ]


class HybridStrategy(RetrievalStrategy):
    """
    Hybrid retrieval combining semantic + FTS + tag results.
    Merges and deduplicates, then re-scores by weighted combination.
    """

    def __init__(self, vector_index: VectorIndex, metadata_index: MetadataIndex) -> None:
        self.vector_index = vector_index
        self.metadata_index = metadata_index
        self._semantic = SemanticStrategy(vector_index, metadata_index)
        self._tag = TagStrategy(metadata_index)

    async def retrieve(self, query: SearchQuery) -> list[RetrievalResult]:
        from uuid import UUID
        import asyncio

        # Run semantic and FTS concurrently
        semantic_task = asyncio.create_task(self._semantic.retrieve(query))
        fts_task = asyncio.create_task(self._fts_retrieve(query))

        semantic_results, fts_results = await asyncio.gather(semantic_task, fts_task)

        # Also get tag results if filters present
        tag_results = []
        if query.cancer_filter or query.drug_filter or query.biomarker_filter:
            tag_results = await self._tag.retrieve(query)

        # Merge with score boosting
        merged: dict[UUID, RetrievalResult] = {}

        for result in semantic_results:
            merged[result.paper.id] = RetrievalResult(
                paper=result.paper,
                score=result.score * 0.6,  # Semantic weight: 60%
                strategy="hybrid",
                snippet=result.snippet,
            )

        for result in fts_results:
            if result.paper.id in merged:
                merged[result.paper.id].score += result.score * 0.3  # FTS weight: 30%
            else:
                merged[result.paper.id] = RetrievalResult(
                    paper=result.paper,
                    score=result.score * 0.3,
                    strategy="hybrid",
                    snippet=result.snippet,
                )

        for result in tag_results:
            if result.paper.id in merged:
                merged[result.paper.id].score += result.score * 0.1  # Tag weight: 10%
            else:
                merged[result.paper.id] = RetrievalResult(
                    paper=result.paper,
                    score=result.score * 0.1,
                    strategy="hybrid",
                    snippet=result.snippet,
                )

        return sorted(merged.values(), key=lambda r: r.score, reverse=True)

    async def _fts_retrieve(self, query: SearchQuery) -> list[RetrievalResult]:
        """PostgreSQL full-text search."""
        records = await self.metadata_index.full_text_search(query.query, limit=query.limit)
        return [
            RetrievalResult(
                paper=_record_to_metadata(r),
                score=0.5,  # FTS results get base score
                strategy="fts",
                snippet=r.abstract[:300] if r.abstract else None,
            )
            for r in records
        ]
