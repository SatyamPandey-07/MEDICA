from datetime import datetime, timezone, timedelta
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from ingestion_agent.app.db.base import Base

IST = timezone(timedelta(hours=5, minutes=30))

class SyncState(Base):
    """
    Tracks the last time a specific source and keyword were successfully checked.
    Allows for high-precision incremental ingestion.
    """
    __tablename__ = "sync_states"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # Source platform (e.g., 'pubmed', 'arxiv')
    source: Mapped[str] = mapped_column(String(50), index=True)
    
    # The keyword or topic being searched
    keyword: Mapped[str] = mapped_column(String(255), index=True)
    
    # The timestamp of the last SUCCESSFUL check
    last_checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(IST)
    )

    def __repr__(self) -> str:
        return f"<SyncState(source={self.source}, keyword={self.keyword}, last_check={self.last_checked_at})>"
