import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import asyncio
from ingestion_agent.app.services.ingestion_service import IngestionService
from ingestion_agent.app.utils.logger import logger

"""
Utility script for performing a single, high-fidelity data sync 
without starting the continuous polling service.
"""

async def sync_now():
    logger.info("Agent [Ingestion] manual sync starting...")
    
    # Initialize SQLite database and tables
    from ingestion_agent.app.db.session import init_db
    await init_db()
    
    ingestor = IngestionService()
    try:
        await ingestor.run_ingestion()
    finally:
        await ingestor.close()
    logger.info("Agent [Ingestion] manual sync complete.")

def run_sync():
    """Entry point for uv run sync"""
    asyncio.run(sync_now())

if __name__ == "__main__":
    run_sync()
