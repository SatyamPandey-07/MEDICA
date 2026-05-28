"""
MEDICA ClinicalTrials.gov Adapter
Fetches trial protocols and study records from ClinicalTrials.gov API v2.
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

CLINICAL_TRIALS_BASE = "https://clinicaltrials.gov/api/v2/studies"


class ClinicalTrialsAdapter(SourceAdapter):
    """
    Adapter for ClinicalTrials.gov API v2.
    Retrieves ongoing and completed trials, cohort definitions, and outcomes.
    """

    source = DataSource.CLINICAL_TRIALS

    def __init__(self) -> None:
        self._rate_limit = 1.0 / settings.crossref_rate_limit
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def _rate_wait(self) -> None:
        await asyncio.sleep(self._rate_limit)

    def _parse_study(self, study: dict) -> RawPaper | None:
        """Parses a study JSON record from ClinicalTrials.gov API v2 into a RawPaper."""
        protocol = study.get("protocolSection", {})
        nct_id = protocol.get("identificationModule", {}).get("nctId")
        title = protocol.get("identificationModule", {}).get("officialTitle") or protocol.get("identificationModule", {}).get("briefTitle")
        
        if not nct_id or not title:
            return None

        # Build "Abstract" from trial summary, conditions, and eligibility criteria
        brief_summary = protocol.get("descriptionModule", {}).get("briefSummary", "")
        eligibility = protocol.get("eligibilityModule", {}).get("eligibilityCriteria", "")
        conditions = protocol.get("conditionsModule", {}).get("conditions", [])
        
        abstract_parts = []
        if brief_summary:
            abstract_parts.append(f"**Brief Summary**:\n{brief_summary}")
        if conditions:
            abstract_parts.append(f"**Target Conditions**: {', '.join(conditions)}")
        if eligibility:
            abstract_parts.append(f"**Patient Eligibility Criteria**:\n{eligibility}")

        abstract = "\n\n".join(abstract_parts) if abstract_parts else "No description available."

        # Extract phase & sample size for downstream indexing
        phases = protocol.get("designModule", {}).get("phases", [])
        trial_phase = phases[0].lower() if phases else "unknown"
        
        enrollment_info = protocol.get("designModule", {}).get("enrollmentInfo", {})
        sample_size = enrollment_info.get("count", None)

        # Map phase identifiers to core schema
        phase_map = {
            "phase1": "phase_1",
            "phase2": "phase_2",
            "phase3": "phase_3",
            "phase4": "phase_4",
        }
        mapped_phase = phase_map.get(trial_phase.replace(" ", "").replace("_", ""), "not_applicable")

        sponsor = protocol.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name", "Unknown Sponsor")
        start_date = protocol.get("statusModule", {}).get("startDateStruct", {}).get("date", "")

        return RawPaper(
            source=DataSource.CLINICAL_TRIALS,
            external_id=nct_id,
            title=title,
            abstract=abstract,
            authors=[sponsor],
            journal="ClinicalTrials.gov",
            published_date=start_date[:4] if start_date else None,
            doi=None,
            pmid=None,
            keywords=conditions + protocol.get("designModule", {}).get("studyType", "").split(),
            citation_count=0,
            raw_data={
                "nct_id": nct_id,
                "trial_phase": mapped_phase,
                "sample_size": sample_size,
                "conditions": conditions,
                "sponsor": sponsor,
            },
        )

    async def fetch_papers(
        self,
        query: str,
        max_results: int = 100,
        offset: int = 0,
    ) -> AsyncGenerator[RawPaper, None]:
        """Query ClinicalTrials.gov REST endpoint and yield studies as RawPapers."""
        client = await self._get_client()
        fetched = 0
        page_size = min(50, max_results)
        next_page_token = None

        while fetched < max_results:
            params = {
                "query.term": query,
                "pageSize": str(page_size),
            }
            if next_page_token:
                params["pageToken"] = next_page_token

            try:
                resp = await client.get(CLINICAL_TRIALS_BASE, params=params)
                resp.raise_for_status()
                data = resp.json()
                studies = data.get("studies", [])

                if not studies:
                    break

                for study in studies:
                    paper = self._parse_study(study)
                    if paper:
                        yield paper
                        fetched += 1
                        if fetched >= max_results:
                            break

                next_page_token = data.get("nextPageToken", None)
                if not next_page_token or len(studies) < page_size:
                    break

            except Exception as e:
                logger.error("clinical_trials_fetch_error", query=query, error=str(e))
                break
            finally:
                await self._rate_wait()

    async def fetch_by_id(self, nct_id: str) -> RawPaper | None:
        """Fetch a single study by its NCT ID (e.g. NCT01234567)."""
        client = await self._get_client()
        url = f"{CLINICAL_TRIALS_BASE}/{nct_id}"
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return self._parse_study(resp.json())
        except Exception as e:
            logger.error("clinical_trials_fetch_by_id_error", nct_id=nct_id, error=str(e))
        return None

    async def fetch_citations(self, nct_id: str) -> list[str]:
        """ClinicalTrials does not map citations directly in standard networks; return empty."""
        return []

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
