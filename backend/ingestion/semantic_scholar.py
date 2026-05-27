"""
MEDICA Semantic Scholar Adapter
Fetches papers, citations, and semantic relationships.
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

SS_BASE = "https://api.semanticscholar.org/graph/v1"
SS_FIELDS = "paperId,title,abstract,authors,year,journal,citationCount,externalIds,fieldsOfStudy,publicationTypes"


class SemanticScholarAdapter(SourceAdapter):
    """
    Adapter for Semantic Scholar API.
    Provides citation graphs and semantic paper recommendations.
    """

    source = DataSource.SEMANTIC_SCHOLAR

    def __init__(self) -> None:
        self._rate_limit = 1.0 / settings.semantic_scholar_rate_limit
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {}
            self._client = httpx.AsyncClient(timeout=30.0, headers=headers)
        return self._client

    async def _rate_wait(self) -> None:
        await asyncio.sleep(self._rate_limit)

    def _raw_to_paper(self, data: dict) -> RawPaper | None:
        title = data.get("title", "")
        if not title:
            return None

        authors = [a.get("name", "") for a in data.get("authors", []) if a.get("name")]
        external_ids = data.get("externalIds", {}) or {}
        pmid = external_ids.get("PubMed")
        doi = external_ids.get("DOI")

        year = data.get("year")
        pub_date = str(year) if year else None

        journal_data = data.get("journal") or {}
        journal = journal_data.get("name") if isinstance(journal_data, dict) else None

        return RawPaper(
            source=DataSource.SEMANTIC_SCHOLAR,
            external_id=data.get("paperId", ""),
            title=title,
            abstract=data.get("abstract"),
            authors=authors,
            journal=journal,
            published_date=pub_date,
            doi=normalize_doi(doi) if doi else None,
            pmid=pmid,
            citation_count=data.get("citationCount", 0),
            keywords=data.get("fieldsOfStudy", []) or [],
            raw_data=data,
        )

    async def fetch_papers(
        self,
        query: str,
        max_results: int = 100,
        offset: int = 0,
    ) -> AsyncGenerator[RawPaper, None]:
        """Search Semantic Scholar for oncology papers."""
        client = await self._get_client()
        limit = min(100, max_results)
        current_offset = offset

        while current_offset < offset + max_results:
            try:
                resp = await client.get(
                    f"{SS_BASE}/paper/search",
                    params={
                        "query": query,
                        "fields": SS_FIELDS,
                        "limit": limit,
                        "offset": current_offset,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                papers_data = data.get("data", [])

                if not papers_data:
                    break

                for item in papers_data:
                    paper = self._raw_to_paper(item)
                    if paper:
                        yield paper

                current_offset += len(papers_data)
                if len(papers_data) < limit:
                    break

            except Exception as e:
                logger.error("semantic_scholar_search_error", query=query, error=str(e))
                break
            finally:
                await self._rate_wait()

    async def fetch_by_id(self, paper_id: str) -> RawPaper | None:
        """Fetch a single paper by Semantic Scholar paper ID."""
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{SS_BASE}/paper/{paper_id}",
                params={"fields": SS_FIELDS},
            )
            resp.raise_for_status()
            return self._raw_to_paper(resp.json())
        except Exception as e:
            logger.error("semantic_scholar_fetch_error", paper_id=paper_id, error=str(e))
            return None
        finally:
            await self._rate_wait()

    async def fetch_citations(self, paper_id: str) -> list[str]:
        """Fetch paper IDs that cite this paper."""
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{SS_BASE}/paper/{paper_id}/citations",
                params={"fields": "paperId", "limit": 50},
            )
            resp.raise_for_status()
            data = resp.json()
            return [c["citingPaper"]["paperId"] for c in data.get("data", []) if c.get("citingPaper", {}).get("paperId")]
        except Exception as e:
            logger.error("semantic_scholar_citations_error", paper_id=paper_id, error=str(e))
            return []
        finally:
            await self._rate_wait()

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
