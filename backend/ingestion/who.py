"""
MEDICA WHO GHO Adapter
Queries global guidelines, epidemiological reports, and tumor statistics from WHO GHO APIs.
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

# WHO Global Health Observatory OData URL
WHO_GHO_BASE = "https://ghoapi.azureedge.net/api"


class WHOAdapter(SourceAdapter):
    """
    Adapter for the World Health Organization (WHO) Global Health Observatory API.
    Retrieves global health data, guideline milestones, and disease statistics.
    """

    source = DataSource.WHO

    def __init__(self) -> None:
        self._rate_limit = 1.0 / settings.crossref_rate_limit
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def _rate_wait(self) -> None:
        await asyncio.sleep(self._rate_limit)

    def _parse_indicator(self, ind: dict, val: dict) -> RawPaper | None:
        """Parses a WHO indicator dimension and observation value into a RawPaper representation."""
        code = ind.get("IndicatorCode", "")
        name = ind.get("IndicatorName", "WHO Health Indicator")
        if not code or not name:
            return None

        # Build clinical abstract from dimensions and observations
        spatial = val.get("SpatialDim", "Global")
        time_dim = val.get("TimeDim", "Recent")
        value_str = val.get("Value", "No Data")
        sex = val.get("Dim1", "")
        
        abstract = (
            f"**Indicator Name**: {name}\n"
            f"**Indicator Code**: {code}\n"
            f"**Geographical Region**: {spatial}\n"
            f"**Target Timeframe**: {time_dim}\n"
            f"**Measured Demographic**: {sex or 'General Population'}\n"
            f"**Quantitative Metric Value**: {value_str}\n\n"
            f"This epidemiological observation represents official regulatory data recorded under "
            f"WHO Global Health Observatory monitoring. Detailed metrics are available in the attached dimensions."
        )

        return RawPaper(
            source=DataSource.WHO,
            external_id=f"WHO_{code}_{spatial}_{time_dim}_{sex}",
            title=f"WHO Guideline/Metric: {name} ({spatial}, {time_dim})",
            abstract=abstract,
            authors=["World Health Organization"],
            journal="WHO Global Health Observatory",
            published_date=str(val.get("TimeDim")) if str(val.get("TimeDim")).isdigit() else None,
            doi=None,
            pmid=None,
            keywords=[code, spatial, "epidemiology", "who"],
            citation_count=0,
            raw_data={
                "indicator_code": code,
                "indicator_name": name,
                "spatial_dimension": spatial,
                "time_dimension": time_dim,
                "metric_value": value_str,
            },
        )

    async def fetch_papers(
        self,
        query: str,
        max_results: int = 100,
        offset: int = 0,
    ) -> AsyncGenerator[RawPaper, None]:
        """Fetch health guidelines and tumor metrics from WHO GHO endpoints."""
        client = await self._get_client()
        fetched = 0

        # We first query the available indicators list matching the oncology/disease keyword
        # Note: WHO exposes indicators list via: https://ghoapi.azureedge.net/api/Indicator
        try:
            resp = await client.get(f"{WHO_GHO_BASE}/Indicator")
            resp.raise_for_status()
            indicators = resp.json().get("value", [])
            
            # Filter indicators by keyword query (e.g. cancer, mortality)
            query_lower = query.lower()
            matched_indicators = [
                i for i in indicators 
                if query_lower in i.get("IndicatorName", "").lower() 
                or query_lower in i.get("IndicatorCode", "").lower()
            ][:5]  # limit to top 5 indicators to prevent HTTP flood

            if not matched_indicators:
                # If no indicators match directly, perform fallback query
                matched_indicators = [{"IndicatorCode": "CANCER", "IndicatorName": "Oncology Health Index"}]

            for ind in matched_indicators:
                code = ind["IndicatorCode"]
                # Query observations for this specific indicator
                val_url = f"{WHO_GHO_BASE}/{code}"
                val_resp = await client.get(val_url)
                if val_resp.status_code == 404:
                    continue
                val_resp.raise_for_status()
                
                observations = val_resp.json().get("value", [])
                # Apply paging offsets
                page_slice = observations[offset:] if len(observations) > offset else observations
                
                for val in page_slice:
                    paper = self._parse_indicator(ind, val)
                    if paper:
                        yield paper
                        fetched += 1
                        if fetched >= max_results:
                            break
                            
                if fetched >= max_results:
                    break

        except Exception as e:
            logger.error("who_fetch_error", query=query, error=str(e))
        finally:
            await self._rate_wait()

    async def fetch_by_id(self, external_id: str) -> RawPaper | None:
        """Fetch a single indicator record by composite ID."""
        # Split composite ID: WHO_{code}_{spatial}_{time_dim}_{sex}
        if not external_id.startswith("WHO_"):
            return None
        parts = external_id.split("_")
        if len(parts) < 5:
            return None
        
        code = parts[1]
        spatial = parts[2]
        time_dim = parts[3]
        
        client = await self._get_client()
        try:
            # Query the indicator name first
            ind_resp = await client.get(f"{WHO_GHO_BASE}/Indicator")
            ind_resp.raise_for_status()
            indicators = ind_resp.json().get("value", [])
            ind_match = next((i for i in indicators if i.get("IndicatorCode") == code), None)
            
            # Query values
            val_resp = await client.get(f"{WHO_GHO_BASE}/{code}")
            val_resp.raise_for_status()
            values = val_resp.json().get("value", [])
            val_match = next((v for v in values if v.get("SpatialDim") == spatial and str(v.get("TimeDim")) == time_dim), None)
            
            if val_match:
                return self._parse_indicator(
                    ind_match or {"IndicatorCode": code, "IndicatorName": code},
                    val_match
                )
        except Exception as e:
            logger.error("who_fetch_by_id_error", external_id=external_id, error=str(e))
        return None

    async def fetch_citations(self, external_id: str) -> list[str]:
        """Epidemiological datasets do not feature citation networks; return empty."""
        return []

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
