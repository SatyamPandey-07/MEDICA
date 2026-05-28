"""MEDICA ingestion package."""
from ingestion.base import SourceAdapter
from ingestion.crossref import CrossRefAdapter
from ingestion.pipeline import IngestionPipeline
from ingestion.pubmed import PubMedAdapter
from ingestion.semantic_scholar import SemanticScholarAdapter
from ingestion.europe_pmc import EuropePMCAdapter
from ingestion.clinical_trials import ClinicalTrialsAdapter
from ingestion.fda import FDAAdapter
from ingestion.who import WHOAdapter

__all__ = [
    "SourceAdapter",
    "PubMedAdapter",
    "CrossRefAdapter",
    "SemanticScholarAdapter",
    "EuropePMCAdapter",
    "ClinicalTrialsAdapter",
    "FDAAdapter",
    "WHOAdapter",
    "IngestionPipeline",
]
