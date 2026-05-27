"""
MEDICA Retrieval Engine
Combines semantic, keyword, and tag-based retrieval with evidence-weighted reranking.
"""
from __future__ import annotations

from uuid import UUID

from core.logging import get_logger
from core.types import PaperMetadata, RetrievalResult, SearchQuery
from indexing.keyword import KeywordIndex
from indexing.metadata import MetadataIndex
from indexing.vector import VectorIndex
from retrieval.reranker import EvidenceReranker
from retrieval.strategies import (
    HybridStrategy,
    RetrievalStrategy,
    SemanticStrategy,
    TagStrategy,
    TemporalStrategy,
)
from shared.models import PaperRecord

logger = get_logger(__name__)


def _record_to_metadata(record: PaperRecord) -> PaperMetadata:
    """Convert a DB PaperRecord to PaperMetadata Pydantic model."""
    from core.types import (
        DataSource, EvidenceLevel, PaperTags, StudyType,
        TrialPhase, VerificationStatus,
    )
    tags_data = record.tags or {}
    tags = PaperTags(
        cancer=tags_data.get("cancer", []),
        treatment=tags_data.get("treatment", []),
        biomarkers=tags_data.get("biomarkers", []),
        drugs=tags_data.get("drugs", []),
        evidence=tags_data.get("evidence", []),
        outcomes=tags_data.get("outcomes", []),
        study_type=tags_data.get("study_type", []),
        temporal=tags_data.get("temporal", []),
        system=tags_data.get("system", []),
    )
    return PaperMetadata(
        id=record.id,
        title=record.title,
        pmid=record.pmid,
        doi=record.doi,
        journal=record.journal,
        published=record.published,
        authors=record.authors or [],
        source=DataSource(record.source),
        verification_status=VerificationStatus(record.verification_status),
        confidence_score=record.confidence_score or 0.0,
        evidence_level=EvidenceLevel(record.evidence_level) if record.evidence_level else EvidenceLevel.UNKNOWN,
        study_type=StudyType(record.study_type) if record.study_type else StudyType.OTHER,
        trial_phase=TrialPhase(record.trial_phase) if record.trial_phase else None,
        tags=tags,
        linked_entities=record.linked_entities or [],
        related_papers=record.related_papers or [],
        contradictory_papers=record.contradictory_papers or [],
        citation_count=record.citation_count or 0,
        abstract=record.abstract,
        keywords=record.keywords or [],
        knowledge_path=record.knowledge_path,
    )


class RetrievalEngine:
    """
    Hybrid retrieval engine combining multiple strategies.

    Strategies:
      - semantic: pgvector cosine similarity
      - keyword: PostgreSQL FTS + ripgrep
      - tag: exact tag matching
      - temporal: date-filtered retrieval
      - hybrid: combination of all (default)

    Post-retrieval:
      - Deduplication by paper ID
      - Evidence-weighted reranking
      - Score normalization
    """

    def __init__(self) -> None:
        self.vector_index = VectorIndex()
        self.metadata_index = MetadataIndex()
        self.keyword_index = KeywordIndex()
        self.reranker = EvidenceReranker()

        self._strategies: dict[str, RetrievalStrategy] = {
            "semantic": SemanticStrategy(self.vector_index, self.metadata_index),
            "keyword": None,  # Initialized lazily
            "tag": TagStrategy(self.metadata_index),
            "temporal": TemporalStrategy(self.metadata_index),
            "hybrid": HybridStrategy(self.vector_index, self.metadata_index),
        }

    async def search(self, query: SearchQuery) -> list[RetrievalResult]:
        """
        Execute a search using the specified strategy.

        Returns reranked, deduplicated RetrievalResult list.
        """
        strategy_name = query.strategy
        strategy = self._strategies.get(strategy_name)

        if strategy is None:
            logger.warning("unknown_strategy", strategy=strategy_name, fallback="hybrid")
            strategy = self._strategies["hybrid"]

        # Execute strategy
        raw_results = await strategy.retrieve(query)

        # Deduplicate by paper ID
        seen: set[UUID] = set()
        unique_results = []
        for result in raw_results:
            if result.paper.id not in seen:
                seen.add(result.paper.id)
                unique_results.append(result)

        # Evidence-weighted reranking
        reranked = self.reranker.rerank(unique_results, query)

        logger.info(
            "retrieval_complete",
            query=query.query[:60],
            strategy=strategy_name,
            results=len(reranked),
        )

        return reranked[: query.limit]

    async def get_paper(self, paper_id: UUID) -> PaperMetadata | None:
        """Fetch a single paper by ID."""
        record = await self.metadata_index.get_by_id(paper_id)
        if record is None:
            return None
        return _record_to_metadata(record)

    async def get_related(self, paper_id: UUID, limit: int = 5) -> list[RetrievalResult]:
        """Get semantically related papers."""
        paper = await self.get_paper(paper_id)
        if paper is None:
            return []

        query_text = f"{paper.title} {paper.abstract or ''}"
        vectors = await self.vector_index.search(query_text, limit=limit + 1)

        results = []
        for pid, score in vectors:
            if pid == paper_id:
                continue
            record = await self.metadata_index.get_by_id(pid)
            if record:
                results.append(RetrievalResult(
                    paper=_record_to_metadata(record),
                    score=score,
                    strategy="semantic_related",
                ))

        return results[:limit]
