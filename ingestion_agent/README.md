# 🧬 OncologyAgent: Research Ingestion Agent

OncologyAgent is a high-fidelity research discovery and retrieval system designed to automate the ingestion of oncology research papers from 16+ sources.

---

## 🚀 Quick Start

### 1. Setup
```bash
cp .env.example .env
# Update NCBI_EMAIL in .env
uv sync
```

### 2. Commands
I have simplified the project so you can run everything with short `uv` commands:

| Task | Command | Description |
| :--- | :--- | :--- |
| **Start Agent** | `uv run start` | Runs the continuous 5-minute polling service. |
| **Manual Sync** | `uv run sync` | Performs a one-time search across all 16 platforms. |
| **Clean DB** | `uv run clean` | Deletes the local SQLite database for a fresh start. |

---

## 🏗️ Architecture
- **Language:** Python 3.12+
- **Database:** SQLite (Local)
- **Deduplication:** Title + Abstract hashing
- **Precision:** State-aware (only fetches papers newer than the last check)

## 🛠️ Configuration
Edit the `.env` file to manage:
- `POLLING_INTERVAL`: Seconds between cycles (default 300).
- `NCBI_EMAIL`: Required for API compliance.
- API Keys for CORE, BASE, etc. (See `SOURCES.md`).
