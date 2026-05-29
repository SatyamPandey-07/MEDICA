from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from ingestion_agent.app.config.settings import settings

"""
Database Session Management for the Ingestion Agent.
Utilizes SQLAlchemy 2.0 Async engine with SQLite (aiosqlite).
"""

# Core engine initialization
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    # SQLite-specific: Ensure the directory exists if needed (handled by sqlite usually)
)

# Factory for creating asynchronous database sessions
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_session() -> AsyncSession:
    """Dependency for providing database sessions to services."""
    async with async_session_factory() as session:
        yield session

async def init_db():
    """Initializes the database by creating all tables."""
    from ingestion_agent.app.db.base import Base
    from ingestion_agent.app.models.paper import Paper 
    from ingestion_agent.app.models.sync_state import SyncState
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
