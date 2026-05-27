"""
MEDICA CrossRef Adapter
DOI resolution and metadata enrichment via CrossRef API.
"""
from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import httpx

from core.config import settings
from core.logging import get_logger
from core.types import DataSource, RawPaper
from ingestion.base import SourceAdapter
from shared.utils import normalize_doi

logger = get_logger(__name__)

CROSSREF_BASE = "https://api.crossref.org/works"


class CrossRefAdapter(SourceAdapter):
    """
    Adapter for CrossRef API.
    Primary use: DOI resolution and metadata enrichment.
    Also supports journal search for recent oncology publications.
    """

    source = DataSource.CROSSREF

    def __init__(self) -> None:
        self._rate_limit = 1.0 / settings.crossref_rate_limit
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={"User-Agent": f"MEDICA/1.0 (mailto:{settings.ncbi_email})"},
            )
        return self._client

    async def _rate_wait(self) -> None:
        await asyncio.sleep(self._rate_limit)

    def _raw_to_paper(self, item: dict) -> RawPaper | None:
        title_list = item.get("title", [])
        title = title_list[0] if title_list else ""
        if not title:
            return None

        authors = []
        for author in item.get("author", []):
            family = author.get("family", "")
            given = author.get("given", "")
            name = f"{family}, {given}".strip(", ")
            if name:
                authors.append(name)

        # Journal
        container = item.get("container-title", [])
        journal = container[0] if container else None

        # Date
        pub_date_str = None
        date_parts = item.get("published", {}).get("date-parts", [[]])
        if date_parts and date_parts[0]:
            parts = date_parts[0]
            pub_date_str = "-".join(str(p).zfill(2) for p in parts)

        doi = item.get("DOI")

        return RawPaper(
            source=DataSource.CROSSREF,
            external_id=normalize_doi(doi) if doi else title,
            title=title,
            abstract=item.get("abstract"),
            authors=authors,
            journal=journal,
            published_date=pub_date_str,
            doi=normalize_doi(doi) if doi else None,
            citation_count=item.get("is-referenced-by-count", 0),
            keywords=item.get("subject", []),
            raw_data=item,
        )

    async def fetch_papers(
        self,
        query: str,
        max_results: int = 100,
        offset: int = 0,
    ) -> AsyncGenerator[RawPaper, None]:
        """Search CrossRef for papers matching query."""
        client = await self._get_client()
        rows = min(100, max_results)
        current_offset = offset

        while current_offset < offset + max_results:
            try:
                resp = await client.get(
                    CROSSREF_BASE,
                    params={
                        "query": query,
                        "rows": rows,
                        "offset": current_offset,
                        "filter": "type:journal-article",
                        "select": "DOI,title,author,container-title,published,abstract,is-referenced-by-count,subject",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                items = data.get("message", {}).get("items", [])

                if not items:
                    break

                for item in items:
                    paper = self._raw_to_paper(item)
                    if paper:
                        yield paper

                current_offset += len(items)
                if len(items) < rows:
                    break

            except Exception as e:
                logger.error("crossref_search_error", query=query, error=str(e))
                break
            finally:
                await self._rate_wait()

    async def fetch_by_id(self, doi: str) -> RawPaper | None:
        """Fetch a single paper by DOI."""
        client = await self._get_client()
        try:
            resp = await client.get(f"{CROSSREF_BASE}/{normalize_doi(doi)}")
            resp.raise_for_status()
            data = resp.json()
            return self._raw_to_paper(data.get("message", {}))
        except Exception as e:
            logger.error("crossref_fetch_error", doi=doi, error=str(e))
            return None
        finally:
            await self._rate_wait()

    async def fetch_citations(self, doi: str) -> list[str]:
        """CrossRef doesn't expose citation lists directly; return empty."""
        return []

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
