import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import asyncio
from ingestion_agent.app.services.ingestion_service import IngestionService
from ingestion_agent.app.config.settings import settings
from ingestion_agent.app.utils.logger import logger

"""
Ingestion Agent Entrypoint.
Handles the continuous lifecycle of the discovery and retrieval pipeline.
"""

async def main():
    """
    Main Execution Loop:
    - Periodically triggers the IngestionService.
    - Monitors for system-level errors.
    - Sleeps based on POLLING_INTERVAL (default 1 hour).
    """
    logger.info("Agent [Ingestion] online.")
    
    # Initialize SQLite database and tables
    from ingestion_agent.app.db.session import init_db
    await init_db()
    
    ingestor = IngestionService()
    
    try:
        while True:
            try:
                logger.info("--- Starting Multi-Source Ingestion Cycle ---")
                # Trigger full discovery/retrieval cycle across all sources
                await ingestor.run_ingestion()
                logger.info("--- Cycle Complete ---")
            except Exception as e:
                logger.error(f"Ingestion Agent Failure: {e}")
            
            logger.info(f"Standby: Next cycle in {settings.POLLING_INTERVAL}s")
            await asyncio.sleep(settings.POLLING_INTERVAL)
    finally:
        await ingestor.close()

def run():
    """Entry point for uv run start"""
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Agent [Ingestion] offline (manual shutdown).")

if __name__ == "__main__":
    run()
