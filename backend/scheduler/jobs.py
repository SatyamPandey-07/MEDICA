"""
MEDICA Scheduler Jobs
Defines background jobs for daily research ingestion and weekly graph optimization.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import select

from core.logging import get_logger
from core.events import bus
from ingestion.pubmed import PubMedAdapter
from ingestion.pipeline import IngestionPipeline
from processing.normalizer import Normalizer
from processing.tagger import Tagger
from processing.linker import EntityLinker
from verification.adversarial import AdversarialVerifier
from knowledge.store import KnowledgeStore
from knowledge.graph import graph
from indexing.vector import VectorIndex
from indexing.metadata import MetadataIndex
from shared.database import get_session
from shared.models import PaperRecord, IngestionJobRecord

logger = get_logger(__name__)


async def daily_fetch_job() -> None:
    """
    Daily fetch job (triggered at 2 AM).
    Ingests new literature for crucial oncology seed queries.
    """
    logger.info("scheduler_job_daily_fetch_start")

    # Ingestion queries for emerging research
    target_queries = [
        "osimertinib EGFR resistance lung cancer",
        "trastuzumab deruxtecan HER2 breast cancer",
        "pembrolizumab colorectal cancer MSI-H",
        "glioblastoma CAR-T cell immunotherapy",
    ]

    adapter = PubMedAdapter()
    normalizer = Normalizer()
    tagger = Tagger()
    linker = EntityLinker()
    verifier = AdversarialVerifier()
    store = KnowledgeStore()
    vector = VectorIndex()
    metadata = MetadataIndex()

    pipeline = IngestionPipeline(
        adapter=adapter,
        normalizer=normalizer,
        tagger=tagger,
        linker=linker,
        verifier=verifier,
        knowledge_store=store,
        vector_index=vector,
        metadata_index=metadata,
    )

    total_ingested = 0

    for query in target_queries:
        logger.info("scheduler_daily_query_start", query=query)
        try:
            # Record job in DB
            async with get_session() as session:
                job_record = IngestionJobRecord(
                    job_name=f"daily_fetch_{query.replace(' ', '_')}",
                    source="pubmed",
                    query=query,
                    status="running",
                    started_at=datetime.utcnow(),
                )
                session.add(job_record)
                await session.commit()
                job_id = str(job_record.id)

            stats = await pipeline.run(query, max_results=5, job_id=job_id, resume=False)

            # Update job record in DB
            async with get_session() as session:
                result = await session.execute(
                    select(IngestionJobRecord).where(IngestionJobRecord.id == UUID(job_id))
                )
                job = result.scalar_one_or_none()
                if job:
                    job.status = "done"
                    job.fetched = stats.fetched
                    job.processed = stats.indexed
                    job.failed = stats.failed
                    job.completed_at = datetime.utcnow()
                    await session.commit()

            total_ingested += stats.indexed
            logger.info("scheduler_daily_query_success", query=query, ingested=stats.indexed)

        except Exception as e:
            logger.error("scheduler_daily_query_error", query=query, error=str(e))
            if 'job_id' in locals():
                async with get_session() as session:
                    result = await session.execute(
                        select(IngestionJobRecord).where(IngestionJobRecord.id == UUID(job_id))
                    )
                    job = result.scalar_one_or_none()
                    if job:
                        job.status = "failed"
                        job.error_message = str(e)
                        job.completed_at = datetime.utcnow()
                        await session.commit()

    logger.info("scheduler_job_daily_fetch_complete", total_ingested=total_ingested)
    await bus.emit("daily_fetch_complete", total_ingested=total_ingested)


async def weekly_optimize_job() -> None:
    """
    Weekly graph relinking and optimization job (triggered on Sundays).
    Recalculates citation relationships, semantic similarities, and updates
    contradiction/related fields across PostgreSQL and Markdown files.
    """
    logger.info("scheduler_job_weekly_optimize_start")
    
    store = KnowledgeStore()
    vector = VectorIndex()

    try:
        # 1. Rebuild knowledge graph from database
        async with get_session() as session:
            result = await session.execute(select(PaperRecord))
            records = result.scalars().all()

        logger.info("scheduler_rebuilding_graph", total_papers=len(records))
        # Local import to avoid circular: retrieval.engine → retrieval.strategies → retrieval.engine
        from retrieval.engine import _record_to_metadata  # noqa: PLC0415
        for record in records:
            try:
                paper_meta = _record_to_metadata(record)
                graph.add_paper(paper_meta)
            except Exception as graph_err:
                logger.warning("graph_add_paper_failed", pmid=record.pmid, error=str(graph_err))

        graph.save()
        logger.info("scheduler_graph_saved", stats=graph.stats())

        # 2. Semantic Cross-Linking (controversies and relationship mapping)
        logger.info("scheduler_computing_cross_links")
        for record in records:
            if not record.abstract:
                continue

            # Semantic search to find top 5 matches
            similar = await vector.search(
                query=f"{record.title}\n\n{record.abstract}",
                limit=6,
                embedding_type="abstract",
            )

            related_ids = []
            contradictory_ids = []

            for other_id, score in similar:
                if other_id == record.id:
                    continue  # Self-match

                if score >= 0.70:
                    related_ids.append(str(other_id))

                    # Contradiction heuristic: matching drug/biomarker/cancer tag, but opposing results
                    # (For a real system, we'd use LLM claims verification or check opposing efficacy findings.
                    # As a heuristic, we flag disputed findings or papers that have significant score differences.)
                    async with get_session() as session:
                        other_res = await session.execute(
                            select(PaperRecord).where(PaperRecord.id == other_id)
                        )
                        other_record = other_res.scalar_one_or_none()

                    if other_record:
                        # If one paper has high evidence, another disputed, or they have opposite evidence quality flags
                        record_flags = record.tags.get("evidence", []) if record.tags else []
                        other_flags = other_record.tags.get("evidence", []) if other_record.tags else []
                        
                        has_dispute = "disputed" in record_flags or "disputed" in other_flags
                        if has_dispute:
                            contradictory_ids.append(str(other_id))

            # Update DB record
            async with get_session() as session:
                db_res = await session.execute(
                    select(PaperRecord).where(PaperRecord.id == record.id)
                )
                db_record = db_res.scalar_one_or_none()
                if db_record:
                    db_record.related_papers = related_ids[:5]
                    db_record.contradictory_papers = contradictory_ids[:3]
                    await session.commit()

            # Update markdown file
            if record.knowledge_path:
                md_path = Path(record.knowledge_path)
                if md_path.exists():
                    await store.update_frontmatter(
                        md_path,
                        {
                            "related_papers": related_ids[:5],
                            "contradictory_papers": contradictory_ids[:3],
                        },
                    )

        logger.info("scheduler_job_weekly_optimize_success")
        await bus.emit("weekly_optimize_complete", total_papers=len(records))

    except Exception as e:
        logger.error("scheduler_job_weekly_optimize_failed", error=str(e))
