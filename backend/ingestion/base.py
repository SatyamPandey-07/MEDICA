"""
MEDICA Ingestion — Base Adapter Interface
All data source adapters implement this interface.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncGenerator

from core.types import DataSource, RawPaper


class SourceAdapter(ABC):
    """
    Abstract base class for all ingestion source adapters.

    Every adapter must implement:
      - fetch_papers(): async generator yielding RawPaper objects
      - source: DataSource identifier

    Adapters should handle:
      - rate limiting (use asyncio.sleep between requests)
      - pagination
      - retries (use tenacity or manual retry logic)
      - normalization of source-specific formats to RawPaper
    """

    source: DataSource

    @abstractmethod
    async def fetch_papers(
        self,
        query: str,
        max_results: int = 100,
        offset: int = 0,
    ) -> AsyncGenerator[RawPaper, None]:
        """
        Fetch papers matching the query from this source.

        Args:
            query: Search query string
            max_results: Maximum number of papers to yield
            offset: Pagination offset (for resumable fetching)

        Yields:
            RawPaper objects
        """
        ...

    @abstractmethod
    async def fetch_by_id(self, external_id: str) -> RawPaper | None:
        """Fetch a single paper by its external ID (PMID, DOI, etc.)."""
        ...

    @abstractmethod
    async def fetch_citations(self, external_id: str) -> list[str]:
        """Fetch citation IDs for a given paper."""
        ...

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} source={self.source}>"
