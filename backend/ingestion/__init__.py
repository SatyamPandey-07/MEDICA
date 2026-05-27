"""MEDICA ingestion package."""
from ingestion.base import SourceAdapter
from ingestion.crossref import CrossRefAdapter
from ingestion.pipeline import IngestionPipeline
from ingestion.pubmed import PubMedAdapter
from ingestion.semantic_scholar import SemanticScholarAdapter

__all__ = [
    "SourceAdapter",
    "PubMedAdapter",
    "CrossRefAdapter",
    "SemanticScholarAdapter",
    "IngestionPipeline",
]
