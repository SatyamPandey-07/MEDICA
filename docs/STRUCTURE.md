# 📁 Project Structure & Integrated Sources

This document provides a comprehensive overview of the OncologyAgent project's file structure and the research sources it integrates.

## 🏗️ File Structure

The project is organized into a modular Python application designed for high-fidelity research discovery.

```text
OncologyAgent/
├── ingestion_agent/           # Root directory for the ingestion agent
│   ├── app/                   # Core application logic
│   │   ├── main.py            # Entry point for continuous polling service
│   │   ├── config/            # Configuration and environment settings
│   │   │   └── settings.py    # Pydantic-based settings management
│   │   ├── db/                # Database connection and session management
│   │   │   ├── base.py        # SQLAlchemy declarative base
│   │   │   └── session.py     # Async engine and session factory
│   │   ├── models/            # SQLAlchemy database models
│   │   │   ├── paper.py       # Paper metadata model (Title, Abstract, etc.)
│   │   │   └── sync_state.py  # Model for tracking synchronization state per source
│   │   ├── repositories/      # Data access layer (CRUD operations)
│   │   │   └── paper_repository.py # Repository for Paper-related database operations
│   │   ├── services/          # Business logic and external API integrations
│   │   │   ├── arxiv_service.py    # Integration for ArXiv preprints
│   │   │   ├── biorxiv_service.py  # Integration for bioRxiv/medRxiv preprints
│   │   │   ├── pubmed_service.py   # Integration for NCBI PubMed/PMC
│   │   │   ├── rest_services.py    # Integrations for Crossref, EuropePMC, etc.
│   │   │   ├── rest_services_v2.py # Integrations for OpenAlex, Semantic Scholar, etc.
│   │   │   ├── rest_services_v3.py # Integrations for CORE, DOAJ, BASE, etc.
│   │   │   └── ingestion_service.py # Orchestrates ingestion across all sources
│   │   └── utils/             # Shared utility functions
│   │       ├── logger.py      # Structured logging configuration
│   │       └── text_utils.py  # Text processing and hashing utilities
│   └── scripts/               # Utility scripts for manual maintenance
│       ├── clean_reset.py     # Resets the local SQLite database
│       └── fetch_once.py      # Performs a one-time manual synchronization
├── oncology.db                # SQLite database file (automatically created)
├── pyproject.toml             # Python project configuration (uv)
├── GEMINI.md                  # Project instructions for AI agents
├── SOURCES.md                 # Detailed API documentation for sources
└── README.md                  # Project quick-start and overview
```

---

## 🌐 Integrated Research Sources

OncologyAgent integrates with **16+ research platforms** to ensure comprehensive discovery of oncology-related literature.

### 🏥 Medical & Peer-Reviewed
- **PubMed**: The gold standard for biomedical literature (NCBI).
- **PubMed Central (PMC)**: Full-text open access archive of biomedical and life sciences journal literature.
- **Europe PMC**: European gateway to life science research.
- **DOAJ**: Directory of Open Access Journals.

### 🧪 Preprints & Biological Data
- **bioRxiv**: The preprint server for biology.
- **medRxiv**: The preprint server for health sciences.
- **arXiv (Biology)**: Quantitative Biology preprints.

### 🔍 Metadata & Search Engines
- **OpenAlex**: A massive, open index of the world's scholarly research system.
- **Semantic Scholar**: AI-powered search and discovery tool.
- **Crossref**: Official DOI registration agency for scholarly publishing.
- **CORE**: The world's largest collection of open access research papers.
- **BASE Search**: Bielefeld Academic Search Engine for academic web resources.

### 🧬 Specialized Oncology & Clinical Data
- **ClinicalTrials.gov**: Database of privately and publicly funded clinical studies.
- **NCBI PubTator 3.0**: AI-powered literature search and biocuration system.
- **cBioPortal**: Visualizing, analyzing and downloading cancer genomics data sets.
- **GDC Data Portal**: NCI's Genomic Data Commons.
- **TCGA**: The Cancer Genome Atlas (via GDC API).

---

## 🛠️ Technology Stack
- **Language:** Python 3.12+
- **Database:** SQLite with `aiosqlite` and `SQLAlchemy 2.0`
- **Networking:** `HTTPX` (Async HTTP Client)
- **Validation:** `Pydantic v2`
- **Environment:** `uv` for package management
