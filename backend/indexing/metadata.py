"""
MEDICA Metadata Index
SQLAlchemy-based metadata storage and retrieval for papers.
Handles upserts, filtering, and tag-based queries.
"""
from __future__ import annotations

from uuid import UUID
from datetime import datetime

from sqlalchemy import select, and_, or_, func, cast
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.logging import get_logger
from core.types import EvidenceLevel, PaperMetadata, VerificationStatus
from shared.database import get_session
from shared.models import PaperRecord

logger = get_logger(__name__)


class MetadataIndex:
    """
    PostgreSQL metadata store for paper records.

    Provides:
      - Upsert (insert or update) by PMID/DOI
      - Tag-based filtering
      - Evidence level filtering
      - Full-text search via PostgreSQL tsvector
      - Admin stats and reporting
    """

    def _paper_to_record_dict(self, paper: PaperMetadata) -> dict:
        """Convert PaperMetadata to a dict suitable for DB insertion."""
        return {
            "id": paper.id,
            "title": paper.title,
            "pmid": paper.pmid,
            "doi": paper.doi,
            "journal": paper.journal,
            "published": paper.published,
            "authors": paper.authors,
            "source": paper.source.value,
            "abstract": paper.abstract,
            "keywords": paper.keywords,
            "verification_status": paper.verification_status.value,
            "confidence_score": paper.confidence_score,
            "evidence_level": paper.evidence_level.value,
            "study_type": paper.study_type.value,
            "trial_phase": paper.trial_phase.value if paper.trial_phase else None,
            "tags": {
                "cancer": paper.tags.cancer,
                "treatment": paper.tags.treatment,
                "biomarkers": paper.tags.biomarkers,
                "drugs": paper.tags.drugs,
                "evidence": paper.tags.evidence,
                "outcomes": paper.tags.outcomes,
                "study_type": paper.tags.study_type,
                "temporal": paper.tags.temporal,
                "system": paper.tags.system,
            },
            "linked_entities": paper.linked_entities,
            "related_papers": paper.related_papers,
            "contradictory_papers": paper.contradictory_papers,
            "citation_count": paper.citation_count,
            "adversarial_review": paper.adversarial_review,
            "knowledge_path": paper.knowledge_path,
        }

    async def upsert_paper(self, paper: PaperMetadata) -> None:
        """Insert or update a paper record."""
        record_dict = self._paper_to_record_dict(paper)

        async with get_session() as session:
            # Use PostgreSQL INSERT ... ON CONFLICT DO UPDATE
            stmt = pg_insert(PaperRecord).values(**record_dict)

            # Conflict on PMID or DOI
            if paper.pmid:
                stmt = stmt.on_conflict_do_update(
                    constraint="uq_papers_pmid",
                    set_={k: v for k, v in record_dict.items() if k not in ("id", "pmid")},
                )
            elif paper.doi:
                stmt = stmt.on_conflict_do_update(
                    constraint="uq_papers_doi",
                    set_={k: v for k, v in record_dict.items() if k not in ("id", "doi")},
                )
            else:
                # No unique constraint — just insert
                stmt = stmt.on_conflict_do_nothing()

            await session.execute(stmt)

        logger.debug("paper_upserted", pmid=paper.pmid, doi=paper.doi)

    async def get_by_pmid(self, pmid: str) -> PaperRecord | None:
        """Fetch paper record by PMID."""
        async with get_session() as session:
            result = await session.execute(
                select(PaperRecord).where(PaperRecord.pmid == pmid)
            )
            return result.scalar_one_or_none()

    async def get_id_mappings(self) -> tuple[dict[str, str], dict[str, str]]:
        """Return mappings of {pmid: id} and {doi: id} as strings."""
        async with get_session() as session:
            result = await session.execute(
                select(PaperRecord.id, PaperRecord.pmid, PaperRecord.doi)
            )
            rows = result.all()
            pmid_to_id = {}
            doi_to_id = {}
            for row in rows:
                paper_id = str(row[0])
                if row[1]:
                    pmid_to_id[str(row[1])] = paper_id
                if row[2]:
                    doi_to_id[str(row[2])] = paper_id
            return pmid_to_id, doi_to_id

    async def get_by_id(self, paper_id: UUID) -> PaperRecord | None:
        """Fetch paper record by UUID."""
        async with get_session() as session:
            result = await session.execute(
                select(PaperRecord).where(PaperRecord.id == paper_id)
            )
            return result.scalar_one_or_none()

    async def search_by_ids(self, paper_ids: list[UUID]) -> list[PaperRecord]:
        """Fetch multiple paper records by ID list."""
        if not paper_ids:
            return []
        async with get_session() as session:
            result = await session.execute(
                select(PaperRecord).where(PaperRecord.id.in_(paper_ids))
            )
            return list(result.scalars().all())

    async def filter_papers(
        self,
        cancer_tags: list[str] | None = None,
        drug_tags: list[str] | None = None,
        evidence_levels: list[EvidenceLevel] | None = None,
        verification_status: VerificationStatus | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[PaperRecord]:
        """Filter papers by tags, evidence level, status, and date range."""
        async with get_session() as session:
            q = select(PaperRecord)
            conditions = []

            if evidence_levels:
                conditions.append(
                    PaperRecord.evidence_level.in_([e.value for e in evidence_levels])
                )
            if verification_status:
                conditions.append(
                    PaperRecord.verification_status == verification_status.value
                )
            if date_from:
                conditions.append(PaperRecord.published >= date_from)
            if date_to:
                conditions.append(PaperRecord.published <= date_to)

            # Tag filtering via JSON operators
            if cancer_tags:
                for tag in cancer_tags:
                    conditions.append(
                        func.jsonb_exists(
                            cast(PaperRecord.tags["cancer"], JSONB),
                            tag
                        )
                    )

            if conditions:
                q = q.where(and_(*conditions))

            q = q.order_by(
                PaperRecord.confidence_score.desc(),
                PaperRecord.citation_count.desc(),
            ).limit(limit).offset(offset)

            result = await session.execute(q)
            return list(result.scalars().all())

    async def full_text_search(self, query: str, limit: int = 20) -> list[PaperRecord]:
        """PostgreSQL full-text search on title and abstract."""
        from sqlalchemy import text
        async with get_session() as session:
            result = await session.execute(
                text("""
                    SELECT * FROM papers
                    WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(abstract, ''))
                          @@ plainto_tsquery('english', :query)
                    ORDER BY ts_rank(
                        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(abstract, '')),
                        plainto_tsquery('english', :query)
                    ) DESC
                    LIMIT :limit
                """),
                {"query": query, "limit": limit},
            )
            rows = result.mappings().all()
            return [PaperRecord(**dict(row)) for row in rows]

    async def stats(self) -> dict:
        """Get database statistics for admin dashboard."""
        from sqlalchemy import text
        async with get_session() as session:
            result = await session.execute(text("""
                SELECT
                    COUNT(*) as total_papers,
                    COUNT(*) FILTER (WHERE verification_status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE verification_status = 'disputed') as disputed,
                    COUNT(*) FILTER (WHERE verification_status = 'pending') as pending,
                    AVG(confidence_score) as avg_confidence,
                    COUNT(DISTINCT source) as sources
                FROM papers
            """))
            row = result.mappings().one()
            return dict(row)
