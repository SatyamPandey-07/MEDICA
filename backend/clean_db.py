"""
MEDICA Database and Knowledge Base Cleanup Script
Drops and recreates all database tables, deletes knowledge base markdown files,
removes ingestion checkpoints, and resets the knowledge graph file.
"""
import asyncio
import os
import shutil
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, ".")

from shared.database import drop_db, init_db
from core.config import settings

async def clean_all():
    print("=== MEDICA Database and Knowledge Base Cleanup ===")
    
    # 1. Reset Database
    print("\n[1/4] Dropping all database tables...")
    try:
        await drop_db()
        print("✔ Database tables dropped successfully.")
    except Exception as e:
        print(f"❌ Error dropping database tables: {e}")
        
    print("\n[2/4] Initializing database schema...")
    try:
        await init_db()
        print("✔ Database schema initialized successfully.")
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        
    # 2. Reset Knowledge base markdown files
    print("\n[3/4] Resetting knowledge base markdown files...")
    kb_path = Path(settings.knowledge_base_path)
    cancers_dir = kb_path / "cancers"
    entities_dir = kb_path / "entities"
    
    deleted_files = 0
    for directory in [cancers_dir, entities_dir]:
        if directory.exists():
            for filepath in directory.rglob("*.md"):
                try:
                    filepath.unlink()
                    deleted_files += 1
                except Exception as e:
                    print(f"⚠ Could not delete file {filepath}: {e}")
    print(f"✔ Deleted {deleted_files} markdown files from the knowledge base.")

    # 3. Clean checkpoints and knowledge graph
    print("\n[4/4] Cleaning pipelines checkpoints and knowledge graph...")
    checkpoints_dir = Path("./data/checkpoints")
    if checkpoints_dir.exists():
        shutil.rmtree(checkpoints_dir)
        checkpoints_dir.mkdir(parents=True, exist_ok=True)
        print("✔ Ingestion checkpoints cleared.")
        
    kg_path = Path("./data/knowledge_graph.json")
    if kg_path.exists():
        try:
            kg_path.unlink()
            print("✔ Knowledge graph JSON file deleted.")
        except Exception as e:
            print(f"⚠ Could not delete knowledge graph file: {e}")
            
    print("\n=== Cleanup Complete. MEDICA is in a fresh, clean state! ===")

if __name__ == "__main__":
    asyncio.run(clean_all())
