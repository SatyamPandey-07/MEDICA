import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import asyncio
from ingestion_agent.app.config.settings import settings

async def reset_db():
    """Resets the database by deleting the SQLite file."""
    db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Database reset complete. Deleted {db_path}")
    else:
        print(f"No database file found at {db_path}")

def run_reset():
    """Entry point for uv run clean"""
    asyncio.run(reset_db())

if __name__ == "__main__":
    run_reset()
