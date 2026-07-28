"""
MEDICA Core Type System
All shared Pydantic models used across layers.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


# ============================================================
# Enumerations
# ============================================================

class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    DISPUTED = "disputed"
    RETRACTED = "retracted"
    UNVERIFIED = "unverified"


class EvidenceLevel(str, Enum):
    META_ANALYSIS = "meta_analysis"
    SYSTEMATIC_REVIEW = "systematic_review"
    RCT = "randomized_controlled_trial"
    COHORT = "cohort_study"
    CASE_CONTROL = "case_control"
    CASE_SERIES = "case_series"
    EXPERT_OPINION = "expert_opinion"
    PRECLINICAL = "preclinical"
    UNKNOWN = "unknown"


class StudyType(str, Enum):
    META_ANALYSIS = "meta_analysis"
    SYSTEMATIC_REVIEW = "systematic_review"
    CLINICAL_TRIAL = "clinical_trial"
    OBSERVATIONAL = "observational"
    CASE_STUDY = "case_study"
    REVIEW = "review"
    PRECLINICAL = "preclinical"
    EDITORIAL = "editorial"
    OTHER = "other"


class TrialPhase(str, Enum):
    PHASE_1 = "phase_1"
    PHASE_2 = "phase_2"
    PHASE_3 = "phase_3"
    PHASE_4 = "phase_4"
    NOT_APPLICABLE = "not_applicable"


class DataSource(str, Enum):
    PUBMED = "pubmed"
    EUROPE_PMC = "europe_pmc"
    CLINICAL_TRIALS = "clinical_trials"
    CROSSREF = "crossref"
    SEMANTIC_SCHOLAR = "semantic_scholar"
    FDA = "fda"
    WHO = "who"
    MANUAL = "manual"


# ============================================================
# Core Document Models
# ============================================================

class PaperTags(BaseModel):
    cancer: list[str] = Field(default_factory=list)
    treatment: list[str] = Field(default_factory=list)
    biomarkers: list[str] = Field(default_factory=list)
    drugs: list[str] = Field(default_factory=list)
    genes: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    outcomes: list[str] = Field(default_factory=list)
    study_type: list[str] = Field(default_factory=list)
    temporal: list[str] = Field(default_factory=list)
    system: list[str] = Field(default_factory=list)


class PaperMetadata(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    title: str
    pmid: str | None = None
    doi: str | None = None
    journal: str | None = None
    published: datetime | None = None
    published_precision: str | None = None  # "day" | "month" | "year" — how much of `published` is real
    authors: list[str] = Field(default_factory=list)
    source: DataSource = DataSource.PUBMED
    verification_status: VerificationStatus = VerificationStatus.PENDING
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence_level: EvidenceLevel = EvidenceLevel.UNKNOWN
    study_type: StudyType = StudyType.OTHER
    trial_phase: TrialPhase | None = None
    sample_size: int | None = None
    biomarkers: list[str] = Field(default_factory=list)
    is_open_access: bool = False
    tags: PaperTags = Field(default_factory=PaperTags)
    linked_entities: list[str] = Field(default_factory=list)
    related_papers: list[str] = Field(default_factory=list)
    contradictory_papers: list[str] = Field(default_factory=list)
    citation_count: int = 0
    abstract: str | None = None
    keywords: list[str] = Field(default_factory=list)
    adversarial_review: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    knowledge_path: str | None = None


class RawPaper(BaseModel):
    """Raw paper as fetched from an external source, before normalization."""
    source: DataSource
    external_id: str  # PMID, DOI, SS ID, etc.
    title: str
    abstract: str | None = None
    authors: list[str] = Field(default_factory=list)
    journal: str | None = None
    published_date: str | None = None
    doi: str | None = None
    pmid: str | None = None
    keywords: list[str] = Field(default_factory=list)
    citation_count: int = 0
    raw_data: dict[str, Any] = Field(default_factory=dict)


class ExtractedClaim(BaseModel):
    """A structured scientific claim extracted from a paper."""
    id: UUID = Field(default_factory=uuid4)
    paper_id: UUID
    claim_text: str
    evidence_level: EvidenceLevel = EvidenceLevel.UNKNOWN
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    verified: bool = False
    disputed: bool = False
    source_section: str | None = None  # abstract, findings, etc.


class KnowledgeEntity(BaseModel):
    """A named oncology entity: drug, biomarker, gene, cancer type, etc."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    canonical_name: str
    entity_type: str  # drug | biomarker | gene | cancer | treatment
    aliases: list[str] = Field(default_factory=list)
    description: str | None = None
    related_entities: list[str] = Field(default_factory=list)
    paper_ids: list[str] = Field(default_factory=list)
    ontology_refs: dict[str, str] = Field(default_factory=dict)  # MESH, OMIM, etc.


class VerificationResult(BaseModel):
    """Result of the adversarial verification agent."""
    paper_id: UUID
    status: VerificationStatus
    confidence_score: float = Field(ge=0.0, le=1.0)
    evidence_level: EvidenceLevel
    flags: list[str] = Field(default_factory=list)  # weak_evidence, sensationalized, etc.
    contradictions: list[str] = Field(default_factory=list)  # paper IDs
    adversarial_review: str | None = None
    verified_at: datetime = Field(default_factory=datetime.utcnow)


class RetrievalResult(BaseModel):
    """A single result from the retrieval engine."""
    paper: PaperMetadata
    score: float
    strategy: str
    snippet: str | None = None
    highlights: list[str] = Field(default_factory=list)


class SearchQuery(BaseModel):
    query: str
    cancer_filter: list[str] = Field(default_factory=list)
    drug_filter: list[str] = Field(default_factory=list)
    biomarker_filter: list[str] = Field(default_factory=list)
    evidence_filter: list[EvidenceLevel] = Field(default_factory=list)
    date_from: datetime | None = None
    date_to: datetime | None = None
    limit: int = Field(default=10, ge=1, le=100)
    strategy: str = "hybrid"  # semantic | hybrid | tag | temporal


# ============================================================
# Chat Models
# ============================================================

class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    role: ChatRole
    content: str
    sources: list[RetrievalResult] = Field(default_factory=list)
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatSession(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    title: str | None = None
    messages: list[ChatMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# Pipeline Models
# ============================================================

class PipelineCheckpoint(BaseModel):
    """Tracks ingestion pipeline progress for resumable seeding."""
    job_id: str
    source: DataSource
    query: str
    total_fetched: int = 0
    total_processed: int = 0
    total_failed: int = 0
    processed_ids: list[str] = Field(default_factory=list)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    completed: bool = False


class IngestionStats(BaseModel):
    source: DataSource
    fetched: int = 0
    normalized: int = 0
    verified: int = 0
    indexed: int = 0
    failed: int = 0
    duplicates_skipped: int = 0
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
