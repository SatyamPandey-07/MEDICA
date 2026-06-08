# 🧬 MEDICA — Oncology Research Operating System

<div align="center">

![MEDICA](https://img.shields.io/badge/MEDICA-Oncology%20AI-6366f1?style=for-the-badge&logo=molecule&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?style=for-the-badge&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)

**Autonomous oncology intelligence platform — research, analyse, and explore cancer treatment literature at scale.**

[Live Demo](https://medica-ictf.vercel.app) · [API Docs](http://localhost:8000/docs) · [Report Bug](https://github.com/SatyamPandey-07/MEDICA/issues)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start (Local Development)](#-quick-start-local-development)
- [Docker Setup (Recommended)](#-docker-setup-recommended)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 🎯 Overview

MEDICA is a full-stack oncology research operating system that combines:

- **AI-powered chat** with a ReAct agent loop for answering clinical questions using real papers
- **Semantic + full-text hybrid search** over a curated oncology knowledge base
- **Knowledge graph** showing relationships between cancer types, drugs, and biomarkers
- **Automated ingestion pipelines** pulling from PubMed, CrossRef, Semantic Scholar, Europe PMC, and ClinicalTrials.gov
- **Evidence auditing and verification** with configurable scoring

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Chat Copilot** | Streaming chat with a ReAct agent backed by Gemini / Groq / OpenAI |
| 🔍 **Hybrid Search** | pgvector semantic + PostgreSQL full-text search, merged and ranked |
| 🕸️ **Knowledge Graph** | Interactive citation and relationship graph across cancer types |
| 📄 **Paper Explorer** | Browse, filter, and deep-dive into indexed papers |
| 📅 **Research Timeline** | Chronological view of research across domains |
| ⚙️ **System Operator** | Admin dashboard for ingestion, verification, and pipeline control |
| 🔬 **Evidence Auditor** | Verification scoring and adversarial testing of indexed papers |
| 🔄 **Auto Ingestion** | Scheduled nightly fetch from PubMed and other sources |

---

## 🏗️ Architecture

```
┌───────────────────────────────────────────┐
│             Next.js Frontend              │
│  ┌───────────┐  ┌─────────┐  ┌────────┐  │
│  │ Chat UI   │  │ Search  │  │ Graph  │  │
│  └─────┬─────┘  └────┬────┘  └───┬────┘  │
└────────┼─────────────┼───────────┼────────┘
         │             │           │  HTTP / SSE
┌────────▼─────────────▼───────────▼────────┐
│          FastAPI Backend (Python)          │
│  ┌──────────┐ ┌─────────┐ ┌───────────┐   │
│  │ ReAct    │ │ Search  │ │ Ingestion │   │
│  │  Agent   │ │ Engine  │ │ Pipeline  │   │
│  └──────────┘ └─────────┘ └───────────┘   │
└──────────────────────┬─────────────────────┘
                       │
┌──────────────────────▼─────────────────────┐
│         PostgreSQL + pgvector              │
│   papers · chat_sessions · ingestion_jobs  │
└────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI 0.100+ |
| Language | Python 3.11+ |
| ORM | SQLAlchemy 2.0 (async) |
| Database driver | asyncpg, psycopg2-binary |
| Vector search | pgvector |
| LLM integration | Google Gemini, Groq, OpenAI, Anthropic |
| Scheduler | APScheduler |
| Embeddings | SentenceTransformers (local) or Gemini/OpenAI API |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |

### Infrastructure
| Layer | Technology |
|---|---|
| Database | PostgreSQL 15 + pgvector extension |
| Container | Docker + Docker Compose |
| Deployment | Vercel (frontend) |

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **PostgreSQL** ≥ 14 with **pgvector** extension installed
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/SatyamPandey-07/MEDICA.git
cd MEDICA
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and API keys (see [Environment Variables](#-environment-variables)).

### 3. Set Up the Database

Make sure PostgreSQL is running and create the database:

```sql
CREATE DATABASE medica;
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Set Up the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# On Windows:
.\venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations (creates all tables)
python migrate_v2.py

# Start the backend server
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: **http://localhost:8000**
Interactive API docs: **http://localhost:8000/docs**

### 5. Set Up the Frontend

In a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Frontend will be available at: **http://localhost:3000**

---

## 🐳 Docker Setup (Recommended)

The easiest way to run the entire stack is with Docker Compose. It spins up PostgreSQL (with pgvector), the FastAPI backend, and the Next.js frontend in one command.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) v2

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env and set your API keys (GEMINI_API_KEY, GROQ_API_KEY, etc.)
# The DATABASE_URL is pre-configured for the Docker network — do not change it
```

### 2. Build and Run

```bash
docker compose up --build
```

This will:
1. Start **PostgreSQL 15** with pgvector at port `5432`
2. Run database migrations automatically
3. Start the **FastAPI backend** at port `8000`
4. Start the **Next.js frontend** at port `3000`

### 3. Access the Application

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

### Useful Docker Commands

```bash
# Start in detached mode (background)
docker compose up -d

# View logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend

# Stop all services
docker compose down

# Stop and remove volumes (resets database)
docker compose down -v

# Rebuild a single service
docker compose up --build backend

# Open a shell in the backend container
docker compose exec backend bash

# Open psql in the database
docker compose exec db psql -U medica -d medica
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in your values.

> ⚠️ **Important:** Do NOT add inline comments after values (e.g. `FOO=bar # comment`). Dotenv parsers treat everything after `=` as the value.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection (asyncpg driver) |
| `DATABASE_URL_SYNC` | ✅ | — | PostgreSQL connection (psycopg2 driver) |
| `POSTGRES_USER` | ✅ | `medica` | Database user (Docker only) |
| `POSTGRES_PASSWORD` | ✅ | — | Database password (Docker only) |
| `POSTGRES_DB` | ✅ | `medica` | Database name (Docker only) |
| `LLM_PROVIDER` | ✅ | `gemini` | `gemini` \| `openai` \| `anthropic` \| `groq` |
| `GEMINI_API_KEY` | ⚠️ | — | Required if `LLM_PROVIDER=gemini` |
| `GROQ_API_KEY` | ⚠️ | — | Required if `LLM_PROVIDER=groq` |
| `OPENAI_API_KEY` | ⚠️ | — | Required if `LLM_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | ⚠️ | — | Required if `LLM_PROVIDER=anthropic` |
| `EMBEDDING_PROVIDER` | ✅ | `local` | `local` \| `gemini` \| `openai` |
| `EMBEDDING_MODEL` | ✅ | `all-MiniLM-L6-v2` | Embedding model name |
| `EMBEDDING_DIMENSIONS` | ✅ | `384` | Dimension count (384/768/1536) |
| `NCBI_API_KEY` | ❌ | — | Increases PubMed rate limit to 10 req/s |
| `NCBI_EMAIL` | ✅ | — | Required by NCBI Entrez API |
| `CORS_ORIGINS` | ✅ | `http://localhost:3000` | Comma-separated allowed origins |
| `ENVIRONMENT` | ✅ | `development` | `development` \| `production` |
| `SECRET_KEY` | ✅ | — | Random secret for app security |
| `SCHEDULER_ENABLED` | ❌ | `true` | Enable background ingestion scheduler |

---

## 📡 API Reference

Base URL: `http://localhost:8000/api`

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System health check (DB, LLM, graph stats) |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/chat` | Start a streaming chat session (SSE) |
| `GET` | `/chat/sessions` | List all chat sessions |
| `GET` | `/chat/sessions/{id}` | Get session history |
| `DELETE` | `/chat/sessions/{id}` | Delete a session |

**POST /chat — Request Body:**
```json
{
  "message": "What are the latest treatments for NSCLC?",
  "session_id": "optional-uuid-to-continue-a-session"
}
```

**POST /chat — SSE Response Stream:**
```
data: {"type": "token", "content": "Based"}
data: {"type": "token", "content": " on"}
data: {"type": "done", "session_id": "uuid", "title": "NSCLC treatments"}
```

### Search

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/search?q=&limit=&strategy=` | Hybrid semantic + full-text search |

**Query Parameters:**
- `q` — Search query (required)
- `limit` — Max results (default: 10, max: 50)
- `strategy` — `hybrid` \| `semantic` \| `keyword` (default: `hybrid`)

### Knowledge

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/knowledge/cancer-types` | List all cancer types |
| `GET` | `/knowledge/papers?cancer_type=` | List papers, filterable by cancer type |
| `GET` | `/knowledge/graph` | Knowledge graph nodes and edges |
| `GET` | `/knowledge/graph/stats` | Node and edge count statistics |

### Papers

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/papers/{id}` | Paper details by UUID or PMID |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/jobs` | List all ingestion jobs |
| `POST` | `/admin/jobs/trigger` | Trigger a PubMed ingestion run |
| `POST` | `/admin/optimize` | Rebuild search indexes |
| `POST` | `/admin/graph/rebuild` | Rebuild the knowledge graph |
| `GET` | `/admin/verification/stats` | Verification statistics |
| `GET` | `/admin/verification/papers` | Papers pending verification |

**POST /admin/jobs/trigger — Request Body:**
```json
{
  "query": "melanoma immunotherapy 2024",
  "limit": 20,
  "source": "pubmed"
}
```

---

## 📁 Project Structure

```
MEDICA/
├── backend/                    # FastAPI Python backend
│   ├── agents/                 # ReAct AI agent loop
│   │   ├── research_agent.py   # Main agent orchestrator
│   │   └── tools.py            # Agent tool definitions
│   ├── api/                    # API route handlers
│   │   ├── main.py             # App entrypoint & CORS
│   │   ├── chat.py             # Chat + SSE streaming
│   │   ├── search.py           # Hybrid search
│   │   └── admin.py            # Admin operations
│   ├── core/                   # Core config and utilities
│   │   ├── config.py           # Pydantic settings
│   │   ├── llm.py              # LLM provider abstraction
│   │   ├── guardrails.py       # Safety filters
│   │   └── events.py           # SSE event helpers
│   ├── ingestion/              # Data source connectors
│   │   ├── pubmed.py           # NCBI PubMed API
│   │   ├── crossref.py         # CrossRef DOI API
│   │   ├── europe_pmc.py       # Europe PMC API
│   │   ├── semantic_scholar.py # Semantic Scholar API
│   │   ├── clinical_trials.py  # ClinicalTrials.gov API
│   │   └── pipeline.py         # Ingestion orchestrator
│   ├── indexing/               # Search indexing
│   │   ├── vector.py           # pgvector embeddings
│   │   └── keyword.py          # Full-text indexing
│   ├── retrieval/              # Search strategies
│   │   ├── engine.py           # Hybrid search engine
│   │   ├── strategies.py       # Search strategy implementations
│   │   └── reranker.py         # Result re-ranking
│   ├── processing/             # Paper processing pipeline
│   │   ├── tagger.py           # Cancer/drug/biomarker tagger
│   │   ├── normalizer.py       # Text normalization
│   │   └── linker.py           # Cross-reference linking
│   ├── knowledge/              # Knowledge graph
│   │   ├── graph.py            # In-memory graph structure
│   │   └── seeder.py           # Graph seeding from DB
│   ├── shared/                 # Shared DB models
│   │   ├── database.py         # SQLAlchemy engine & session
│   │   └── models.py           # ORM models
│   ├── verification/           # Evidence auditing
│   │   ├── scorer.py           # Confidence scoring
│   │   └── adversarial.py      # Adversarial testing
│   ├── scheduler/              # Background task runner
│   │   ├── runner.py           # APScheduler wrapper
│   │   └── jobs.py             # Scheduled job definitions
│   ├── migrate_v2.py           # Database migration script
│   └── requirements.txt        # Python dependencies
│
├── frontend/                   # Next.js frontend
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Home / Chat Copilot
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global styles
│   │   ├── explorer/           # Knowledge Explorer page
│   │   ├── graph/              # Citation Graph page
│   │   ├── timeline/           # Research Timeline page
│   │   ├── verification/       # Evidence Auditor page
│   │   ├── admin/              # System Operator page
│   │   └── papers/[id]/        # Paper detail page
│   └── lib/
│       ├── api.ts              # API client helpers
│       └── types.ts            # TypeScript interfaces
│
├── knowledge/                  # Seeded oncology knowledge files
├── tests/                      # Backend test suite
├── .env.example                # Environment template
├── docker-compose.yml          # Full stack Docker Compose
├── Makefile                    # Development shortcuts
└── README.md                   # This file
```

---

## 🗄️ Database Schema

The application uses PostgreSQL 15 with the `pgvector` extension.

### `paper_records`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | TEXT | Paper title |
| `abstract` | TEXT | Full abstract |
| `pmid` | TEXT | PubMed ID (unique) |
| `doi` | TEXT | DOI |
| `journal` | TEXT | Journal name |
| `published` | DATE | Publication date |
| `authors` | JSONB | List of author names |
| `source` | TEXT | Data source (pubmed, crossref, etc.) |
| `embedding` | vector(384) | Semantic embedding |
| `verification_status` | TEXT | `unverified` \| `verified` \| `flagged` |
| `confidence_score` | FLOAT | Evidence confidence (0–1) |
| `tags` | JSONB | `{cancer, drugs, biomarkers, treatment}` |
| `keywords` | JSONB | Extracted keywords |

### `chat_sessions`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | TEXT | Auto-generated session title |
| `messages` | JSONB | Array of `{role, content}` objects |
| `created_at` | TIMESTAMP | Session creation time |
| `updated_at` | TIMESTAMP | Last message time |

### `ingestion_jobs`
| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `job_name` | TEXT | Human-readable job name |
| `source` | TEXT | Data source used |
| `query` | TEXT | Search query used |
| `status` | TEXT | `running` \| `done` \| `failed` |
| `fetched` | INT | Papers fetched |
| `processed` | INT | Papers indexed |
| `failed` | INT | Failed papers |
| `error_message` | TEXT | Error detail if failed |

---

## 🚢 Deployment

### Vercel (Frontend + API Routes)

The `nextjs-fullstack` branch contains a pure Next.js version with all backend logic migrated to API Routes (no Python required).

```bash
# Deploy to Vercel
git checkout nextjs-fullstack
vercel --prod
```

Set these environment variables in your Vercel dashboard:
- `DATABASE_URL` — A cloud PostgreSQL URL (Neon, Supabase, or Railway)
- `GEMINI_API_KEY` or `GROQ_API_KEY`
- `NCBI_EMAIL`

### Traditional Server / VPS

```bash
# Build and run with Docker Compose
docker compose -f docker-compose.yml up -d --build

# Or run manually
cd backend && uvicorn api.main:app --host 0.0.0.0 --port 8000
cd frontend && npm run build && npm start
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © [Satyam Pandey](https://github.com/SatyamPandey-07)
