from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from ingestion_agent.app.models.paper import Paper
from ingestion_agent.app.models.sync_state import SyncState, IST
from ingestion_agent.app.utils.logger import logger
from datetime import datetime

class PaperRepository:
    """
    Data Access Object (DAO) for the Ingestion Agent.
    
    Separates database interaction logic from business services.
    Ensures structural integrity and handles duplicate prevention.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_external_id(self, source: str, external_id: str) -> Paper | None:
        """Retrieves a single paper by its source and source-specific ID."""
        result = await self.session.execute(
            select(Paper).where(
                (Paper.source == source) & (Paper.external_id == external_id)
            )
        )
        return result.scalar_one_or_none()

    async def get_by_content_hash(self, content_hash: str) -> Paper | None:
        """Retrieves a single paper by its content fingerprint (title + abstract hash)."""
        result = await self.session.execute(
            select(Paper).where(Paper.content_hash == content_hash)
        )
        return result.scalar_one_or_none()

    async def get_last_sync(self, source: str, keyword: str) -> datetime | None:
        """Fetches the last successful sync time for a source/keyword."""
        result = await self.session.execute(
            select(SyncState.last_checked_at).where(
                (SyncState.source == source) & (SyncState.keyword == keyword)
            )
        )
        return result.scalar()

    async def update_sync_checkpoint(self, source: str, keyword: str):
        """Updates or creates the sync checkpoint for a source/keyword."""
        result = await self.session.execute(
            select(SyncState).where(
                (SyncState.source == source) & (SyncState.keyword == keyword)
            )
        )
        sync_state = result.scalar_one_or_none()
        
        now = datetime.now(IST)
        if sync_state:
            sync_state.last_checked_at = now
        else:
            sync_state = SyncState(source=source, keyword=keyword, last_checked_at=now)
            self.session.add(sync_state)
        
        await self.session.commit()

    async def create(self, paper_data: dict) -> Paper:
        """Instantiates and persists a new Paper record."""
        paper = Paper(**paper_data)
        self.session.add(paper)
        await self.session.commit()
        await self.session.refresh(paper)
        return paper

    async def bulk_upsert(self, papers_data: list[dict]) -> int:
        """
        Robust batch insertion.
        Returns the count of successfully stored new papers.
        Automatically rolls back failed individual inserts to maintain integrity.
        """
        inserted_count = 0
        for data in papers_data:
            # 1. Check for ID-based duplicates (same source, same ID)
            existing_id = await self.get_by_external_id(data["source"], data["external_id"])
            if existing_id:
                continue
            
            # 2. Check for Content-based duplicates (title + abstract hash)
            # This catches papers that are identical but from different sources
            existing_hash = await self.get_by_content_hash(data["content_hash"])
            if existing_hash:
                logger.debug(f"Skipping content duplicate: {data['title'][:50]}...")
                continue
            
            try:
                await self.create(data)
                inserted_count += 1
            except IntegrityError:
                await self.session.rollback()
                logger.debug(f"Skipped concurrent duplicate ({data['source']} ID {data['external_id']})")
            except Exception as e:
                logger.error(f"DB Insertion Error ({data['source']} ID {data['external_id']}): {e}")
                await self.session.rollback()
        
        return inserted_count
