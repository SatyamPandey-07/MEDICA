"""
MEDICA Europe PMC Adapter
Fetches papers from the Europe PMC REST API.
"""
from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import httpx

from core.config import settings
from core.logging import get_logger
from core.types import DataSource, RawPaper
from ingestion.base import SourceAdapter

logger = get_logger(__name__)

EUROPE_PMC_SEARCH = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"


class EuropePMCAdapter(SourceAdapter):
    """
    Adapter for Europe PMC API.
    Provides deep access to open access literature and citation data.
    """

    source = DataSource.EUROPE_PMC

    def __init__(self) -> None:
        self._rate_limit = 1.0 / settings.semantic_scholar_rate_limit  # standard rate limiting pacing
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def _rate_wait(self) -> None:
        await asyncio.sleep(self._rate_limit)

    def _parse_paper(self, item: dict) -> RawPaper | None:
        """Parses a single JSON result from Europe PMC into RawPaper."""
        title = item.get("title", "").strip()
        if not title:
            return None

        # Authors
        authors = []
        author_string = item.get("authorString", "")
        if author_string:
            authors = [a.strip() for a in author_string.split(",")]
        
        # Abstract (sometimes not present in list results, must fetch if possible)
        abstract = item.get("abstractText", None)

        pmid = item.get("pmid", None)
        doi = item.get("doi", None)
        ext_id = pmid or doi or item.get("id", title)

        return RawPaper(
            source=DataSource.EUROPE_PMC,
            external_id=str(ext_id),
            title=title,
            abstract=abstract,
            authors=authors,
            journal=item.get("journalTitle"),
            published_date=item.get("pubYear"),
            doi=doi,
            pmid=pmid,
            keywords=[k.strip() for k in item.get("keywordList", {}).get("keyword", []) if k],
            citation_count=item.get("citedByCount", 0),
            raw_data=item,
        )

    async def fetch_papers(
        self,
        query: str,
        max_results: int = 100,
        offset: int = 0,
    ) -> AsyncGenerator[RawPaper, None]:
        """Query Europe PMC search endpoint and yield RawPapers."""
        client = await self._get_client()
        fetched = 0
        page_size = min(50, max_results)

        while fetched < max_results:
            params = {
                "query": query,
                "format": "json",
                "pageSize": str(page_size),
                "cursorMark": "*",  # Uses Europe PMC cursor paginating for deeper searches
                "resultType": "lite",  # Lite returns primary metadata, full text can be queried later
            }
            # Adjust offset by running search paging if cursor isn't used
            if offset + fetched > 0:
                # If we have an offset, page using mathematical pagination
                page = (offset + fetched) // page_size + 1
                params["page"] = str(page)
                params.pop("cursorMark", None)

            try:
                resp = await client.get(EUROPE_PMC_SEARCH, params=params)
                resp.raise_for_status()
                data = resp.json()
                results = data.get("resultList", {}).get("result", [])

                if not results:
                    break

                for item in results:
                    paper = self._parse_paper(item)
                    if paper:
                        yield paper
                        fetched += 1
                        if fetched >= max_results:
                            break

                if len(results) < page_size:
                    break  # Last page

            except Exception as e:
                logger.error("europe_pmc_fetch_error", query=query, error=str(e))
                break
            finally:
                await self._rate_wait()

    async def fetch_by_id(self, external_id: str) -> RawPaper | None:
        """Fetch a single paper by its DOI or PMID."""
        client = await self._get_client()
        query = f"ext_id:{external_id}" if external_id.isdigit() else f'doi:"{external_id}"'
        params = {
            "query": query,
            "format": "json",
            "resultType": "core",  # Core retrieves abstracts and full details
        }
        try:
            resp = await client.get(EUROPE_PMC_SEARCH, params=params)
            resp.raise_for_status()
            results = resp.json().get("resultList", {}).get("result", [])
            if results:
                return self._parse_paper(results[0])
        except Exception as e:
            logger.error("europe_pmc_fetch_by_id_error", external_id=external_id, error=str(e))
        return None

    async def fetch_citations(self, external_id: str) -> list[str]:
        """Fetch papers citing this item."""
        # Europe PMC exposes citations through search links
        client = await self._get_client()
        query = f"citations:{external_id}"
        params = {
            "query": query,
            "format": "json",
            "pageSize": "30",
        }
        try:
            resp = await client.get(EUROPE_PMC_SEARCH, params=params)
            resp.raise_for_status()
            results = resp.json().get("resultList", {}).get("result", [])
            return [r.get("pmid") or r.get("doi") or r.get("id") for r in results if r]
        except Exception as e:
            logger.error("europe_pmc_citations_error", external_id=external_id, error=str(e))
            return []

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
