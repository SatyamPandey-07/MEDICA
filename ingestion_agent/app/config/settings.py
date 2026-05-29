from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr

class Settings(BaseSettings):
    """
    Centralized configuration management for the Ingestion Agent.
    Uses Pydantic Settings to validate environment variables at startup.
    """
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Database connection string (SQLite)
    # Format: sqlite+aiosqlite:///./oncology.db
    DATABASE_URL: str = Field("sqlite+aiosqlite:///./oncology.db", description="SQLite connection string")


    # NCBI E-Utilities credentials (for PubMed API compliance)
    NCBI_API_KEY: SecretStr | None = None
    NCBI_EMAIL: str = Field(..., description="Email for NCBI compliance")
    NCBI_TOOL_NAME: str = "oncology_agent"
    
    # New API Keys
    SEMANTIC_SCHOLAR_API_KEY: SecretStr | None = None
    CORE_API_KEY: SecretStr | None = None
    BASE_API_KEY: SecretStr | None = None
    DOAJ_API_KEY: SecretStr | None = None
    
    # Operational Settings
    POLLING_INTERVAL: int = 300  # Default frequency of ingestion cycles (seconds)
    ENVIRONMENT: Literal["development", "production", "test"] = "development"
    LOG_LEVEL: str = "INFO"

    @property
    def is_development(self) -> bool:
        """Helper to check if we are in development mode."""
        return self.ENVIRONMENT == "development"

# Global settings instance
settings = Settings()
