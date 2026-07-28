"""
MEDICA SQLAlchemy ORM Models (PostgreSQL + pgvector)
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.config import settings


class Base(DeclarativeBase):
    pass


class PaperRecord(Base):
    """Core paper metadata stored in PostgreSQL."""
    __tablename__ = "papers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    pmid: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    doi: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    journal: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_precision: Mapped[str | None] = mapped_column(String(10), nullable=True)
    authors: Mapped[list] = mapped_column(JSON, default=list)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    abstract: Mapped[str | None] = mapped_column(Text, nullable=True)
    keywords: Mapped[list] = mapped_column(JSON, default=list)

    # Verification
    verification_status: Mapped[str] = mapped_column(String(20), default="pending")
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    evidence_level: Mapped[str] = mapped_column(String(50), default="unknown")
    study_type: Mapped[str] = mapped_column(String(50), default="other")
    trial_phase: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sample_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    biomarkers: Mapped[list] = mapped_column(JSON, default=list)
    is_open_access: Mapped[bool] = mapped_column(Boolean, default=False)

    # Tags and links (JSON arrays)
    tags: Mapped[dict] = mapped_column(JSON, default=dict)
    linked_entities: Mapped[list] = mapped_column(JSON, default=list)
    related_papers: Mapped[list] = mapped_column(JSON, default=list)
    contradictory_papers: Mapped[list] = mapped_column(JSON, default=list)
    citation_count: Mapped[int] = mapped_column(Integer, default=0)
    adversarial_review: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Filesystem path to markdown file
    knowledge_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    embeddings: Mapped[list[PaperEmbedding]] = relationship("PaperEmbedding", back_populates="paper", cascade="all, delete-orphan")
    claims: Mapped[list[ClaimRecord]] = relationship("ClaimRecord", back_populates="paper", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("pmid", name="uq_papers_pmid"),
        UniqueConstraint("doi", name="uq_papers_doi"),
        Index("ix_papers_verification_status", "verification_status"),
        Index("ix_papers_evidence_level", "evidence_level"),
        Index("ix_papers_published", "published"),
        Index("ix_papers_source", "source"),
    )


class PaperEmbedding(Base):
    """Vector embeddings for semantic search."""
    __tablename__ = "paper_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    embedding_type: Mapped[str] = mapped_column(String(50), default="abstract")  # abstract | title | full
    embedding_model: Mapped[str] = mapped_column(String(100), nullable=False)
    vector: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dimensions), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    paper: Mapped[PaperRecord] = relationship("PaperRecord", back_populates="embeddings")

    __table_args__ = (
        Index("ix_paper_embeddings_paper_id", "paper_id"),
    )


class ClaimRecord(Base):
    """Extracted scientific claims with verification status."""
    __tablename__ = "claims"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    claim_text: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_level: Mapped[str] = mapped_column(String(50), default="unknown")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    disputed: Mapped[bool] = mapped_column(Boolean, default=False)
    source_section: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    paper: Mapped[PaperRecord] = relationship("PaperRecord", back_populates="claims")


class KnowledgeEntityRecord(Base):
    """Named oncology entities: drugs, biomarkers, genes, cancer types."""
    __tablename__ = "knowledge_entities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    canonical_name: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # drug|biomarker|gene|cancer|treatment
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_entities: Mapped[list] = mapped_column(JSON, default=list)
    paper_ids: Mapped[list] = mapped_column(JSON, default=list)
    ontology_refs: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_entities_entity_type", "entity_type"),
        Index("ix_entities_canonical_name", "canonical_name"),
    )


class ChatSessionRecord(Base):
    """Persisted chat sessions for research continuity."""
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    messages: Mapped[list] = mapped_column(JSON, default=list)
    llm_config: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class IngestionJobRecord(Base):
    """Tracks ingestion job status for the scheduler and admin dashboard."""
    __tablename__ = "ingestion_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_name: Mapped[str] = mapped_column(String(200), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|running|done|failed
    fetched: Mapped[int] = mapped_column(Integer, default=0)
    processed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    checkpoint_data: Mapped[dict] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_ingestion_jobs_status", "status"),
        Index("ix_ingestion_jobs_source", "source"),
    )
