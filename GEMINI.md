# OncologyAgent: Ingestion Agent (Integrated into MEDICA)

## Project Overview
OncologyAgent is a specialized tool for automated discovery and retrieval of oncology research papers from PubMed and 10+ other sources, integrated as a standalone package inside the **MEDICA** workspace.

- **Main Technologies:** Python 3.12+, SQLAlchemy 2.0, SQLite (aiosqlite), Pydantic, HTTPX.
- **Location:** `MEDICA/ingestion_agent`
- **Entry Point:** `MEDICA/ingestion_agent/app/main.py` (Continuous polling) or `MEDICA/ingestion_agent/scripts/fetch_once.py` (Manual sync).

## Building and Running
All commands should be executed from within the `MEDICA/` directory:

- **Environment Setup:**
  ```bash
  cd MEDICA
  cp .env.example .env
  # Update settings and NCBI_EMAIL in .env
  ```
- **Installing dependencies:**
  ```bash
  uv sync
  ```
- **Running the application (Continuous Polling):**
  ```bash
  PYTHONPATH=. uv run python -m ingestion_agent.app.main
  ```
- **Running the manual sync once:**
  ```bash
  PYTHONPATH=. uv run python -m ingestion_agent.scripts.fetch_once
  ```

## Development Conventions
- Follow standard Python (PEP 8) coding conventions.
- All models should inherit from `ingestion_agent.app.db.base.Base`.
- Use `ingestion_agent.app.utils.logger` for all logging.
- Ensure all dates are localized to IST (UTC+5:30).
- The database is automatically initialized on startup (`init_db` in `session.py`).

