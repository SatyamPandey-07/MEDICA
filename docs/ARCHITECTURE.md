# 🏗️ OncologyAgent: Architecture & Integration

This document outlines the internal architecture of the OncologyAgent and provides guidance on integrating it into a larger multi-agent ecosystem.

## 🧱 Architectural Layers

The agent follows a layered architecture to ensure separation of concerns and maintainability:

1.  **Orchestration Layer (`ingestion_service.py`)**:
    *   Coordinates the entire ingestion cycle.
    *   Manages search terms (Buzzwords) and source sequencing.
    *   Implements global rate-limiting, jitter, and circuit-breaker logic.

2.  **Service Layer (`services/`)**:
    *   Encapsulates external API logic (PubMed, ArXiv, Semantic Scholar, etc.).
    *   Handles source-specific authentication, request formatting, and XML/JSON parsing.
    *   Implements local retry logic and browser-mimicry to bypass throttling.

3.  **Data Access Layer (`repositories/`)**:
    *   Handles all database interactions using SQLAlchemy.
    *   Provides high-level methods for bulk upserts and sync checkpointing.

4.  **Domain Model Layer (`models/`)**:
    *   Defines the schema for `Paper` (metadata) and `SyncState` (checkpointing).
    *   Ensures data consistency and normalization (e.g., IST timezone conversion).

## 🔄 Data Flow

1.  **Trigger**: The agent starts either via a continuous polling loop (`main.py`) or a manual sync (`fetch_once.py`).
2.  **Discovery**: The `IngestionService` iterates through buzzwords and dispatches searches to 16+ services.
3.  **Fetch & Parse**: Services retrieve raw data, handle rate limits, and parse results into normalized dictionaries.
4.  **Deduplication**: The `PaperRepository` uses a `content_hash` (generated from Title + Abstract) to ensure no duplicate papers are stored.
5.  **Persistence**: New papers are bulk-inserted into the SQLite database.
6.  **Checkpointing**: The `SyncState` is updated for each source/keyword pair to ensure the next cycle only fetches newer results.

## 🤝 Integration Guide

To integrate this agent into a larger project:

### 1. Programmatic Entry Point
Avoid calling shell scripts. Instead, import and initialize the `IngestionService`:

```python
from ingestion_agent.app.services.ingestion_service import IngestionService
from ingestion_agent.app.db.session import init_db

async def run_agent():
    await init_db()
    agent = IngestionService()
    await agent.run_ingestion()
```

### 2. Shared Database
If the larger project uses a shared database, update the `DATABASE_URL` in `.env` or `config/settings.py`. The agent is designed to be "good neighbors" by using async connections and transaction-safe upserts.

### 3. Shared Logging
The agent uses a structured logger in `utils/logger.py`. You can redirect this to a central logging aggregator by modifying the log configuration to use your project's handler.

### 4. Configuration
Ensure the host project provides the necessary environment variables defined in `config/settings.py` (especially `NCBI_EMAIL` and optional API keys).
