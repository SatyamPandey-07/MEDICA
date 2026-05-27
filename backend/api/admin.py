"""
MEDICA Admin and Verification API Endpoints
Manages background ingestion jobs, manual triggers, and evidence verification audits.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Body
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import get_logger
from core.types import DataSource
from shared.database import get_db, get_session
from shared.models import PaperRecord, IngestionJobRecord
from ingestion.pubmed import PubMedAdapter
from ingestion.pipeline import IngestionPipeline
from processing.normalizer import Normalizer
from processing.tagger import Tagger
from processing.linker import EntityLinker
from verification.adversarial import AdversarialVerifier
from knowledge.store import KnowledgeStore
from indexing.vector import VectorIndex
from indexing.metadata import MetadataIndex
from scheduler.jobs import weekly_optimize_job

logger = get_logger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


async def _bg_run_pipeline(
    job_uuid: UUID,
    source: str,
    query: str,
    limit: int,
):
    """Background task runner for manually triggered pipeline ingestion."""
    logger.info("bg_ingestion_trigger_start", job_id=str(job_uuid), query=query)
    
    # Setup components
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

    try:
        # Update state to running
        async with get_session() as session:
            res = await session.execute(select(IngestionJobRecord).where(IngestionJobRecord.id == job_uuid))
            job = res.scalar_one_or_none()
            if job:
                job.status = "running"
                await session.commit()

        stats = await pipeline.run(query, max_results=limit, job_id=str(job_uuid), resume=False)

        # Mark done
        async with get_session() as session:
            res = await session.execute(select(IngestionJobRecord).where(IngestionJobRecord.id == job_uuid))
            job = res.scalar_one_or_none()
            if job:
                job.status = "done"
                job.fetched = stats.fetched
                job.processed = stats.indexed
                job.failed = stats.failed
                job.completed_at = datetime.utcnow()
                await session.commit()

        logger.info("bg_ingestion_trigger_success", job_id=str(job_uuid), fetched=stats.fetched)

    except Exception as e:
        logger.error("bg_ingestion_trigger_failed", job_id=str(job_uuid), error=str(e))
        async with get_session() as session:
            res = await session.execute(select(IngestionJobRecord).where(IngestionJobRecord.id == job_uuid))
            job = res.scalar_one_or_none()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                job.completed_at = datetime.utcnow()
                await session.commit()


@router.post("/jobs/trigger")
async def trigger_ingestion_job(
    background_tasks: BackgroundTasks,
    source: str = Body("pubmed", embed=True),
    query: str = Body(..., embed=True),
    limit: int = Body(10, ge=1, le=100, embed=True),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a manual literature ingestion and indexing job in the background."""
    logger.info("api_trigger_ingestion_job", source=source, query=query, limit=limit)

    if source.lower() != "pubmed":
        raise HTTPException(status_code=400, detail="Only 'pubmed' source is supported currently.")

    job_uuid = uuid4()
    
    # Save job record
    job = IngestionJobRecord(
        id=job_uuid,
        job_name=f"manual_{query.replace(' ', '_')[:50]}",
        source=source,
        query=query,
        status="pending",
        started_at=datetime.utcnow(),
    )
    db.add(job)
    await db.commit()

    # Enqueue background task
    background_tasks.add_task(
        _bg_run_pipeline,
        job_uuid=job_uuid,
        source=source,
        query=query,
        limit=limit,
    )

    return {
        "status": "enqueued",
        "job_id": str(job_uuid),
        "message": f"Ingestion job for '{query}' successfully enqueued in background.",
    }


@router.get("/jobs")
async def list_ingestion_jobs(db: AsyncSession = Depends(get_db)):
    """List all running and historical ingestion jobs."""
    res = await db.execute(
        select(IngestionJobRecord).order_by(desc(IngestionJobRecord.created_at)).limit(50)
    )
    jobs = res.scalars().all()
    return [
        {
            "id": str(j.id),
            "job_name": j.job_name,
            "source": j.source,
            "query": j.query,
            "status": j.status,
            "fetched": j.fetched,
            "processed": j.processed,
            "failed": j.failed,
            "error_message": j.error_message,
            "created_at": j.created_at.isoformat(),
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None,
        }
        for j in jobs
    ]


@router.get("/verification/stats")
async def get_verification_stats(db: AsyncSession = Depends(get_db)):
    """Compile evidence audit metrics (verified/unverified counts, averages)."""
    
    # Counts by status
    res_status = await db.execute(
        select(PaperRecord.verification_status, func.count(PaperRecord.id))
        .group_by(PaperRecord.verification_status)
    )
    status_counts = dict(res_status.fetchall())

    # Count by evidence level
    res_level = await db.execute(
        select(PaperRecord.evidence_level, func.count(PaperRecord.id))
        .group_by(PaperRecord.evidence_level)
    )
    level_counts = dict(res_level.fetchall())

    # Average confidence score
    res_score = await db.execute(select(func.avg(PaperRecord.confidence_score)))
    avg_score = res_score.scalar() or 0.0

    # Total counts
    res_total = await db.execute(select(func.count(PaperRecord.id)))
    total = res_total.scalar() or 0

    return {
        "total_papers": total,
        "average_confidence_score": float(avg_score),
        "status_distribution": {
            "verified": status_counts.get("verified", 0),
            "unverified": status_counts.get("unverified", 0),
            "disputed": status_counts.get("disputed", 0),
            "pending": status_counts.get("pending", 0),
        },
        "evidence_level_distribution": {
            k: v for k, v in level_counts.items()
        }
    }


@router.get("/verification/papers")
async def list_verification_papers(
    status: str = Query("all", description="Filter: all, verified, unverified, disputed, pending"),
    db: AsyncSession = Depends(get_db),
):
    """List paper records filtered by verification status to audit oncology claims."""
    stmt = select(PaperRecord)
    if status != "all":
        stmt = stmt.where(PaperRecord.verification_status == status)

    stmt = stmt.order_by(desc(PaperRecord.confidence_score)).limit(100)
    
    res = await db.execute(stmt)
    papers = res.scalars().all()

    return [
        {
            "id": str(p.id),
            "title": p.title,
            "pmid": p.pmid,
            "doi": p.doi,
            "journal": p.journal,
            "published": p.published.isoformat() if p.published else None,
            "verification_status": p.verification_status,
            "confidence_score": p.confidence_score,
            "evidence_level": p.evidence_level,
            "flags": p.tags.get("evidence", []) if p.tags else [],
        }
        for p in papers
    ]


@router.post("/optimize")
async def trigger_optimization(background_tasks: BackgroundTasks):
    """Manually trigger weekly graph optimize and cross-linking job in background."""
    background_tasks.add_task(weekly_optimize_job)
    return {
        "status": "triggered",
        "message": "Manual graph relinking and optimization triggered successfully."
    }


@router.post("/graph/rebuild")
async def rebuild_knowledge_graph(db: AsyncSession = Depends(get_db)):
    """
    Rebuild the knowledge graph from all papers already in the database.
    Use this to backfill the citation graph without re-running ingestion.
    """
    from knowledge.graph import graph as kg_graph
    from core.types import PaperMetadata, PaperTags

    logger.info("graph_rebuild_start")

    # Load all papers from DB
    res = await db.execute(select(PaperRecord).limit(500))
    papers = res.scalars().all()

    if not papers:
        return {"status": "empty", "message": "No papers in database. Run an ingestion job first.", "nodes": 0, "edges": 0}

    built = 0
    for p in papers:
        try:
            # Reconstruct tags from stored JSON
            tags_raw = p.tags or {}
            tags = PaperTags(
                cancer=tags_raw.get("cancer", []),
                drugs=tags_raw.get("drugs", []),
                biomarkers=tags_raw.get("biomarkers", []),
                treatment=tags_raw.get("treatment", []),
                genes=tags_raw.get("genes", []),
            )
            paper_meta = PaperMetadata(
                id=p.id,
                title=p.title or "",
                abstract=p.abstract or "",
                pmid=p.pmid,
                doi=p.doi,
                tags=tags,
                authors=p.authors or [],
            )
            kg_graph.add_paper(paper_meta)
            built += 1
        except Exception as e:
            logger.warning("graph_rebuild_paper_error", paper_id=str(p.id), error=str(e))

    kg_graph.save()
    stats = kg_graph.stats()

    logger.info("graph_rebuild_complete", built=built, **stats)
    return {
        "status": "rebuilt",
        "papers_processed": built,
        "nodes": stats["total_nodes"],
        "edges": stats["total_edges"],
        "cancer_nodes": stats["cancer_nodes"],
        "drug_nodes": stats["drug_nodes"],
        "biomarker_nodes": stats["biomarker_nodes"],
    }
