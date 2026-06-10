"""
MEDICA Ingestion Pipeline
Orchestrates: FETCH → NORMALIZE → VERIFY → TAG → LINK → EMBED → INDEX → STORE
Supports checkpointing, deduplication, retries, and batch processing.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from core.config import settings
from core.events import bus
from core.logging import get_logger
from core.types import DataSource, IngestionStats, PipelineCheckpoint, RawPaper
from ingestion.base import SourceAdapter
from knowledge.graph import graph as kg_graph
from shared.utils import paper_fingerprint

logger = get_logger(__name__)

CHECKPOINT_DIR = Path("./data/checkpoints")


class IngestionPipeline:
    """
    Main ingestion pipeline.

    Takes a SourceAdapter and runs the full pipeline for a given query.
    Supports:
      - Checkpointing (resume interrupted jobs)
      - Deduplication (skip already processed papers)
      - Batch processing
      - Rate-aware execution
      - Event emissions for downstream handlers
    """

    def __init__(
        self,
        adapter: SourceAdapter,
        normalizer: Any,
        tagger: Any,
        linker: Any,
        verifier: Any,
        knowledge_store: Any,
        vector_index: Any,
        metadata_index: Any,
    ) -> None:
        self.adapter = adapter
        self.normalizer = normalizer
        self.tagger = tagger
        self.linker = linker
        self.verifier = verifier
        self.knowledge_store = knowledge_store
        self.vector_index = vector_index
        self.metadata_index = metadata_index
        CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    def _checkpoint_path(self, job_id: str) -> Path:
        return CHECKPOINT_DIR / f"{job_id}.json"

    def _load_checkpoint(self, job_id: str) -> PipelineCheckpoint | None:
        path = self._checkpoint_path(job_id)
        if path.exists():
            data = json.loads(path.read_text())
            return PipelineCheckpoint(**data)
        return None

    def _save_checkpoint(self, checkpoint: PipelineCheckpoint) -> None:
        path = self._checkpoint_path(checkpoint.job_id)
        path.write_text(checkpoint.model_dump_json(indent=2))

    def _is_duplicate(self, raw: RawPaper, checkpoint: PipelineCheckpoint) -> bool:
        fp = paper_fingerprint(raw.title, raw.pmid, raw.doi)
        return fp in checkpoint.processed_ids

    async def run(
        self,
        query: str,
        max_results: int = 100,
        job_id: str | None = None,
        resume: bool = True,
    ) -> IngestionStats:
        """
        Run the full ingestion pipeline for a query.

        Args:
            query: Search query for the source adapter
            max_results: Maximum papers to process
            job_id: Optional stable ID for checkpointing
            resume: If True, resume from existing checkpoint

        Returns:
            IngestionStats with counts of processed/failed/skipped papers
        """
        job_id = job_id or f"{self.adapter.source.value}_{query[:30].replace(' ', '_')}_{int(datetime.utcnow().timestamp())}"
        stats = IngestionStats(source=self.adapter.source)

        # Load or create checkpoint
        checkpoint = None
        offset = 0
        if resume:
            checkpoint = self._load_checkpoint(job_id)
            if checkpoint and checkpoint.completed:
                logger.info("pipeline_already_complete", job_id=job_id)
                return stats

        if checkpoint is None:
            checkpoint = PipelineCheckpoint(
                job_id=job_id,
                source=self.adapter.source,
                query=query,
            )

        offset = checkpoint.total_fetched
        logger.info("pipeline_start", job_id=job_id, source=self.adapter.source, query=query, offset=offset)

        async for raw_paper in self.adapter.fetch_papers(query, max_results=max_results, offset=offset):
            stats.fetched += 1
            checkpoint.total_fetched += 1

            # Deduplication
            fp = paper_fingerprint(raw_paper.title, raw_paper.pmid, raw_paper.doi)
            if fp in checkpoint.processed_ids:
                stats.duplicates_skipped += 1
                logger.debug("duplicate_skipped", fingerprint=fp)
                continue

            try:
                # 1. NORMALIZE
                paper = await self.normalizer.normalize(raw_paper)

                # 2. TAG
                paper = await self.tagger.tag(paper)

                # 3. LINK
                paper = await self.linker.link(paper)

                # 4. VERIFY
                verification = await self.verifier.verify(paper)
                paper.verification_status = verification.status
                paper.confidence_score = verification.confidence_score
                paper.evidence_level = verification.evidence_level
                paper.adversarial_review = verification.adversarial_review

                # 5. STORE to knowledge filesystem
                knowledge_path = await self.knowledge_store.store(paper, adversarial_review=verification.adversarial_review)
                paper.knowledge_path = str(knowledge_path)

                # 6. EMBED + INDEX
                await self.metadata_index.upsert_paper(paper)
                await self.vector_index.index_paper(paper)

                # 7. Register in knowledge graph
                kg_graph.add_paper(paper)
                kg_graph.save()

                # Mark processed
                checkpoint.processed_ids.append(fp)
                checkpoint.total_processed += 1
                stats.indexed += 1
                stats.normalized += 1
                stats.verified += 1

                # Emit event
                await bus.emit("paper_ingested", paper_id=str(paper.id), source=self.adapter.source.value)

                logger.info(
                    "paper_ingested",
                    title=paper.title[:60],
                    pmid=paper.pmid,
                    doi=paper.doi,
                    confidence=paper.confidence_score,
                    status=paper.verification_status,
                )

            except Exception as e:
                stats.failed += 1
                checkpoint.total_failed += 1
                logger.error(
                    "pipeline_paper_error",
                    title=raw_paper.title[:60],
                    error=str(e),
                )

            # Save checkpoint every 10 papers
            if (stats.fetched % 10) == 0:
                checkpoint.last_updated = datetime.utcnow()
                self._save_checkpoint(checkpoint)

        # Final checkpoint
        checkpoint.completed = True
        checkpoint.last_updated = datetime.utcnow()
        self._save_checkpoint(checkpoint)

        stats.completed_at = datetime.utcnow()
        logger.info(
            "pipeline_complete",
            job_id=job_id,
            fetched=stats.fetched,
            processed=stats.indexed,
            failed=stats.failed,
            duplicates=stats.duplicates_skipped,
        )
        await bus.emit("ingestion_complete", stats=stats.model_dump())
        return stats
