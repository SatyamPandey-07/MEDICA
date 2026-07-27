"""
MEDICA Initial Seeder
Seeds the knowledge base with foundational oncology research from PubMed.
Supports resumable execution, deduplication, and batch processing.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from core.logging import get_logger
from core.types import IngestionStats
from ingestion.pipeline import IngestionPipeline
from ingestion.pubmed import PubMedAdapter
from ingestion.semantic_scholar import SemanticScholarAdapter
from processing.linker import EntityLinker
from processing.normalizer import Normalizer
from processing.tagger import Tagger
from verification.multi_layer_verifier import MultiLayerVerifier

logger = get_logger(__name__)

# ============================================================
# Seed Queries
# Priority oncology topics for initial knowledge base seeding.
# Each query will fetch up to PAPERS_PER_QUERY papers from PubMed.
# ============================================================
SEED_QUERIES = [
    # Immunotherapy - high value, most active area
    ("pembrolizumab cancer immunotherapy PD-L1", "immunotherapy"),
    ("nivolumab checkpoint inhibitor oncology", "immunotherapy"),
    ("CAR-T cell therapy cancer treatment", "immunotherapy"),
    ("CTLA-4 PD-1 immune checkpoint cancer", "immunotherapy"),

    # Breast cancer
    ("HER2 positive breast cancer trastuzumab treatment", "breast_cancer"),
    ("triple negative breast cancer treatment outcomes", "breast_cancer"),
    ("BRCA1 BRCA2 breast cancer olaparib PARP inhibitor", "breast_cancer"),
    ("CDK4/6 inhibitor palbociclib breast cancer", "breast_cancer"),

    # Lung cancer
    ("EGFR mutation NSCLC osimertinib targeted therapy", "lung_cancer"),
    ("ALK rearrangement non-small cell lung cancer", "lung_cancer"),
    ("pembrolizumab NSCLC PD-L1 first line treatment", "lung_cancer"),
    ("small cell lung cancer immunotherapy", "lung_cancer"),

    # Colorectal cancer
    ("KRAS mutation colorectal cancer treatment resistance", "colorectal_cancer"),
    ("MSI-H colorectal cancer immunotherapy response", "colorectal_cancer"),
    ("bevacizumab colorectal cancer VEGF", "colorectal_cancer"),

    # Glioblastoma
    ("glioblastoma multiforme GBM treatment temozolomide", "glioblastoma"),
    ("glioblastoma immunotherapy checkpoint inhibitor", "glioblastoma"),
    ("IDH mutation glioma prognosis treatment", "glioblastoma"),

    # Pancreatic cancer
    ("pancreatic ductal adenocarcinoma PDAC treatment", "pancreatic_cancer"),
    ("BRCA pancreatic cancer PARP inhibitor olaparib", "pancreatic_cancer"),

    # Prostate cancer
    ("enzalutamide abiraterone prostate cancer androgen", "prostate_cancer"),
    ("PARP inhibitor prostate cancer BRCA", "prostate_cancer"),

    # Leukemia
    ("acute myeloid leukemia AML venetoclax treatment", "leukemia"),
    ("CLL chronic lymphocytic leukemia ibrutinib BTK", "leukemia"),

    # Melanoma
    ("BRAF V600E melanoma vemurafenib dabrafenib", "melanoma"),
    ("melanoma pembrolizumab nivolumab immunotherapy", "melanoma"),

    # Biomarkers
    ("tumor mutational burden TMB immunotherapy response", "biomarkers"),
    ("microsatellite instability MSI cancer immunotherapy", "biomarkers"),
    ("liquid biopsy ctDNA cancer early detection", "biomarkers"),

    # Renal cell carcinoma
    ("renal cell carcinoma sunitinib nivolumab treatment", "renal_cell_carcinoma"),

    # General oncology
    ("cancer drug resistance mechanisms targeted therapy", "resistance"),
    ("cancer biomarker predictive response treatment", "biomarkers"),
    ("oncology clinical trial randomized controlled", "clinical_trials"),
    ("meta-analysis cancer treatment outcomes systematic review", "evidence"),
]

PAPERS_PER_QUERY = 30  # Adjust based on time/API limits


@dataclass
class SeederStats:
    total_queries: int = 0
    completed_queries: int = 0
    total_papers: int = 0
    failed_queries: list[str] = field(default_factory=list)


async def run_seeder(
    max_papers_per_query: int = PAPERS_PER_QUERY,
    queries: list[tuple[str, str]] | None = None,
    resume: bool = True,
) -> SeederStats:
    """
    Run the initial seeding process.

    Fetches papers from PubMed for all seed queries and runs them
    through the full ingestion pipeline.

    Args:
        max_papers_per_query: Max papers to fetch per query
        queries: Override default seed queries
        resume: Resume from checkpoints if interrupted

    Returns:
        SeederStats with overall progress
    """
    from indexing.vector import VectorIndex
    from indexing.metadata import MetadataIndex
    from knowledge.store import KnowledgeStore

    queries = queries or SEED_QUERIES
    stats = SeederStats(total_queries=len(queries))

    # Initialize pipeline components
    adapter = PubMedAdapter()
    normalizer = Normalizer()
    tagger = Tagger()
    linker = EntityLinker()
    verifier = MultiLayerVerifier()
    knowledge_store = KnowledgeStore()
    vector_index = VectorIndex()
    metadata_index = MetadataIndex()

    pipeline = IngestionPipeline(
        adapter=adapter,
        normalizer=normalizer,
        tagger=tagger,
        linker=linker,
        verifier=verifier,
        knowledge_store=knowledge_store,
        vector_index=vector_index,
        metadata_index=metadata_index,
    )

    logger.info("seeder_start", total_queries=len(queries), papers_per_query=max_papers_per_query)

    for query_str, category in queries:
        job_id = f"seed_{category}_{query_str[:20].replace(' ', '_')}"
        logger.info("seeder_query", query=query_str, category=category)

        try:
            result: IngestionStats = await pipeline.run(
                query=query_str,
                max_results=max_papers_per_query,
                job_id=job_id,
                resume=resume,
            )
            stats.total_papers += result.indexed
            stats.completed_queries += 1

        except Exception as e:
            logger.error("seeder_query_failed", query=query_str, error=str(e))
            stats.failed_queries.append(query_str)

        # Brief pause between queries
        await asyncio.sleep(1.0)

    logger.info(
        "seeder_complete",
        total_papers=stats.total_papers,
        completed=stats.completed_queries,
        failed=len(stats.failed_queries),
    )

    await adapter.close()
    return stats


if __name__ == "__main__":
    import asyncio
    asyncio.run(run_seeder())
