"""
MEDICA openFDA Adapter
Fetches oncology drug approvals and labels from openFDA APIs.
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

FDA_LABEL_API = "https://api.fda.gov/drug/label.json"


class FDAAdapter(SourceAdapter):
    """
    Adapter for openFDA.
    Harvests official drug label indications, warnings, and molecular targets.
    """

    source = DataSource.FDA

    def __init__(self) -> None:
        self._rate_limit = 1.0 / settings.crossref_rate_limit
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def _rate_wait(self) -> None:
        await asyncio.sleep(self._rate_limit)

    def _parse_label(self, result: dict) -> RawPaper | None:
        """Parses an openFDA drug label result into a RawPaper representation."""
        id_str = result.get("id", "")
        openfda = result.get("openfda", {})
        
        # Determine chemical or brand name
        brand_names = openfda.get("brand_name", [])
        generic_names = openfda.get("generic_name", [])
        
        title = f"FDA Drug Label: {brand_names[0]}" if brand_names else None
        if not title:
            title = f"FDA Drug Label: {generic_names[0]}" if generic_names else f"FDA Drug Label Record {id_str}"

        # Construct sections as the abstract body
        indications = result.get("indications_and_usage", [""])[0]
        warnings = result.get("warnings", [""])[0]
        description = result.get("description", [""])[0]
        dosage = result.get("dosage_and_administration", [""])[0]

        abstract_parts = []
        if indications:
            abstract_parts.append(f"**Indications and Usage**:\n{indications}")
        if dosage:
            abstract_parts.append(f"**Dosage and Administration**:\n{dosage}")
        if warnings:
            abstract_parts.append(f"**Warnings and Precautions**:\n{warnings}")
        if description:
            abstract_parts.append(f"**Drug Description**:\n{description}")

        abstract = "\n\n".join(abstract_parts) if abstract_parts else "No label sections available."

        manufacturers = openfda.get("manufacturer_name", ["U.S. FDA"])
        effective_time = result.get("effective_time", "")

        return RawPaper(
            source=DataSource.FDA,
            external_id=id_str or title,
            title=title,
            abstract=abstract,
            authors=manufacturers,
            journal="openFDA Regulatory Database",
            published_date=effective_time[:4] if len(effective_time) >= 4 else None,
            doi=None,
            pmid=None,
            keywords=generic_names + openfda.get("route", []) + openfda.get("substance_name", []),
            citation_count=0,
            raw_data={
                "fda_id": id_str,
                "generic_names": generic_names,
                "brand_names": brand_names,
                "substances": openfda.get("substance_name", []),
                "manufacturer": manufacturers[0] if manufacturers else None,
            },
        )

    async def fetch_papers(
        self,
        query: str,
        max_results: int = 100,
        offset: int = 0,
    ) -> AsyncGenerator[RawPaper, None]:
        """Queries the openFDA drug label endpoint and yields drug labels."""
        client = await self._get_client()
        fetched = 0
        limit_per_call = min(20, max_results)

        # openFDA uses standard Lucene queries
        search_query = f'openfda.brand_name:"{query}" OR openfda.generic_name:"{query}" OR indications_and_usage:"{query}"'
        
        while fetched < max_results:
            params = {
                "search": search_query,
                "limit": str(limit_per_call),
                "skip": str(offset + fetched),
            }

            try:
                resp = await client.get(FDA_LABEL_API, params=params)
                if resp.status_code == 404:
                    break  # No results
                resp.raise_for_status()
                data = resp.json()
                results = data.get("results", [])

                if not results:
                    break

                for item in results:
                    paper = self._parse_label(item)
                    if paper:
                        yield paper
                        fetched += 1
                        if fetched >= max_results:
                            break

                if len(results) < limit_per_call:
                    break

            except Exception as e:
                logger.error("fda_fetch_error", query=query, error=str(e))
                break
            finally:
                await self._rate_wait()

    async def fetch_by_id(self, fda_id: str) -> RawPaper | None:
        """Fetch a single drug label by its FDA UUID or ID."""
        client = await self._get_client()
        params = {
            "search": f"id:{fda_id}",
        }
        try:
            resp = await client.get(FDA_LABEL_API, params=params)
            resp.raise_for_status()
            results = resp.json().get("results", [])
            if results:
                return self._parse_label(results[0])
        except Exception as e:
            logger.error("fda_fetch_by_id_error", fda_id=fda_id, error=str(e))
        return None

    async def fetch_citations(self, fda_id: str) -> list[str]:
        """Regulatory labels do not have citation networks; return empty."""
        return []

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
