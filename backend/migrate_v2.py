"""One-shot migration: adds columns introduced in v2.0 that were missed by init_db."""
import asyncio
import sys
sys.path.insert(0, ".")

from shared.database import engine
from sqlalchemy import text


async def migrate():
    async with engine.connect() as conn:

        # ── chat_sessions ────────────────────────────────────────────────────
        r = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='chat_sessions' ORDER BY ordinal_position"
        ))
        chat_cols = [row[0] for row in r]
        print("chat_sessions columns:", chat_cols)

        if "llm_config" not in chat_cols:
            await conn.execute(text(
                "ALTER TABLE chat_sessions ADD COLUMN llm_config JSONB NOT NULL DEFAULT '{}'"
            ))
            await conn.commit()
            print("[ADDED] Added chat_sessions.llm_config")
        else:
            print("[OK] chat_sessions.llm_config already exists")

        # ── papers ───────────────────────────────────────────────────────────
        r2 = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='papers' ORDER BY ordinal_position"
        ))
        paper_cols = [row[0] for row in r2]
        print("papers columns:", paper_cols)

        migrations = [
            ("sample_size",    "INTEGER"),
            ("biomarkers",     "JSONB NOT NULL DEFAULT '[]'"),
            ("is_open_access", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ]
        for col, typedef in migrations:
            if col not in paper_cols:
                await conn.execute(text(f"ALTER TABLE papers ADD COLUMN {col} {typedef}"))
                await conn.commit()
                print(f"[ADDED] Added papers.{col}")
            else:
                print(f"[OK] papers.{col} already exists")

    print("\nMigration complete.")


asyncio.run(migrate())
