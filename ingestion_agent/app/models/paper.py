from datetime import datetime, timezone, timedelta
from sqlalchemy import String, Text, DateTime, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ingestion_agent.app.db.base import Base

# Define Indian Standard Time (IST) offset for localization
IST = timezone(timedelta(hours=5, minutes=30))

class Paper(Base):
    """
    SQLAlchemy Model representing an oncology research paper.
    Unified for both Ingestion and Analysis agents.
    """
    __tablename__ = "papers"

    # Database-level Primary Key
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # Unique Identifier from the source (e.g., PMID, ArXiv ID, DOI)
    external_id: Mapped[str] = mapped_column(String(255), index=True)
    
    # Source platform (e.g., 'pubmed', 'arxiv', 'biorxiv')
    source: Mapped[str] = mapped_column(String(50), index=True)
    
    # Hash of title + abstract to prevent duplicates across different sources
    content_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    # Digital Object Identifier
    doi: Mapped[str | None] = mapped_column(String(100), index=True)
    
    # Metadata extracted from PubMed
    title: Mapped[str] = mapped_column(Text)
    abstract: Mapped[str | None] = mapped_column(Text)
    full_text: Mapped[str | None] = mapped_column(Text)
    journal: Mapped[str | None] = mapped_column(String(255))
    authors: Mapped[str | None] = mapped_column(Text)
    
    # Timeline metadata
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paper_url: Mapped[str | None] = mapped_column(String(500))
    pdf_url: Mapped[str | None] = mapped_column(String(500))
    
    # Classification for multi-agent filtering
    topic: Mapped[str] = mapped_column(String(100), index=True)
    
    # Additional metadata for flexibility
    metadata_json: Mapped[dict | None] = mapped_column(JSON, default={})
    
    # Operational metadata (Localized to IST)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(IST)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(IST)
    )

    # Composite Unique Index to prevent duplicates from the same source
    __table_args__ = (
        Index("ix_source_external_id", "source", "external_id", unique=True),
    )

    def __repr__(self) -> str:
        """Readable representation for logging and debugging."""
        return f"<Paper(source={self.source}, id={self.external_id}, title={self.title[:30]}...)>"
