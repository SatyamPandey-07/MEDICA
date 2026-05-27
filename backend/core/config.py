"""
MEDICA Core Configuration
Reads from environment variables / .env file.
"""
from __future__ import annotations

from enum import Enum
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMProvider(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"


class EmbeddingProvider(str, Enum):
    LOCAL = "local"
    GEMINI = "gemini"
    OPENAI = "openai"


class Environment(str, Enum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    environment: Environment = Environment.DEVELOPMENT
    secret_key: str = "change_this_in_production"
    log_level: str = "INFO"

    # --- Database ---
    database_url: str = "postgresql+asyncpg://medica:medica_secret@localhost:5432/medica"
    database_url_sync: str = "postgresql+psycopg2://medica:medica_secret@localhost:5432/medica"

    # --- LLM ---
    llm_provider: LLMProvider = LLMProvider.GEMINI
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-20241022"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # --- Embeddings ---
    embedding_provider: EmbeddingProvider = EmbeddingProvider.LOCAL
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimensions: int = 384

    # --- PubMed / NCBI ---
    ncbi_api_key: str = ""
    ncbi_email: str = "medica@research.local"

    # --- Knowledge Base ---
    knowledge_base_path: Path = Path("./knowledge")

    # --- Scheduler ---
    scheduler_enabled: bool = True
    daily_fetch_hour: int = 2
    weekly_optimize_day: str = "sun"

    # --- Rate Limiting (req/sec) ---
    pubmed_rate_limit: float = 3.0
    crossref_rate_limit: float = 5.0
    semantic_scholar_rate_limit: float = 5.0

    # --- Ingestion ---
    ingestion_batch_size: int = 50
    ingestion_max_retries: int = 3

    @property
    def is_production(self) -> bool:
        return self.environment == Environment.PRODUCTION

    @property
    def active_llm_key(self) -> str:
        if self.llm_provider == LLMProvider.GEMINI:
            return self.gemini_api_key
        elif self.llm_provider == LLMProvider.OPENAI:
            return self.openai_api_key
        elif self.llm_provider == LLMProvider.GROQ:
            return self.groq_api_key
        return self.anthropic_api_key

    @property
    def active_llm_model(self) -> str:
        if self.llm_provider == LLMProvider.GEMINI:
            return self.gemini_model
        elif self.llm_provider == LLMProvider.OPENAI:
            return self.openai_model
        elif self.llm_provider == LLMProvider.GROQ:
            return self.groq_model
        return self.anthropic_model


# Singleton instance
settings = Settings()
