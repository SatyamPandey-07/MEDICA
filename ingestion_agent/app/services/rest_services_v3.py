import httpx
import asyncio
import json
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
from ingestion_agent.app.utils.logger import logger
from ingestion_agent.app.utils.text_utils import TextUtils

IST = timezone(timedelta(hours=5, minutes=30))

class GDCService:
    BASE_URL = "https://api.gdc.cancer.gov/files"

    async def search_projects(self, query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        # GDC API is complex, focusing on fetching file/project metadata matching keywords
        params = {
            "filters": {
                "op": "in",
                "content": {
                    "field": "cases.project.project_id",
                    "value": [query.upper()]
                }
            },
            "fields": "file_name,file_id,cases.project.project_id,submitter_id,data_format,data_type",
            "size": max_results
        }
        async with httpx.AsyncClient() as client:
            try:
                # GDC expects filters as JSON string
                params["filters"] = json.dumps(params["filters"])
                response = await client.get(self.BASE_URL, params=params, timeout=30.0)
                if response.status_code in [429, 403]:
                    raise httpx.HTTPStatusError(f"Rate limited/Forbidden: {response.status_code}", request=response.request, response=response)
                response.raise_for_status()
                data = response.json()
                return self._map(data.get("data", {}).get("hits", []))
            except httpx.HTTPStatusError as e:
                if e.response.status_code in [429, 403]:
                    raise e
                logger.warning(f"GDC failed: {e}")
                return []
            except Exception as e:
                logger.warning(f"GDC failed: {e}")
                return []

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                title = f"GDC File: {r.get('file_name')} ({r.get('data_type')})"
                abstract = f"Project: {r.get('cases', [{}])[0].get('project', {}).get('project_id')}. Data format: {r.get('data_format')}."
                papers.append({
                    "external_id": r["file_id"],
                    "source": "gdc",
                    "content_hash": TextUtils.generate_content_hash(title, abstract),
                    "title": title,
                    "abstract": abstract,
                    "journal": "Genomic Data Commons",
                    "authors": "GDC Submitter",
                    "published_at": datetime.now(IST),
                    "paper_url": f"https://portal.gdc.cancer.gov/files/{r['file_id']}",
                    "doi": None
                })
            except: continue
        return papers

class CBioPortalService:
    BASE_URL = "https://www.cbioportal.org/api/studies"

    async def search_studies(self, query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(self.BASE_URL, timeout=30.0)
                if response.status_code in [429, 403]:
                    raise httpx.HTTPStatusError(f"Rate limited/Forbidden: {response.status_code}", request=response.request, response=response)
                response.raise_for_status()
                data = response.json()
                # Filter locally for query
                filtered = [s for s in data if query.lower() in s.get("name", "").lower()][:max_results]
                return self._map(filtered)
            except httpx.HTTPStatusError as e:
                if e.response.status_code in [429, 403]:
                    raise e
                logger.warning(f"cBioPortal failed: {e}")
                return []
            except Exception as e:
                logger.warning(f"cBioPortal failed: {e}")
                return []

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                title = f"cBioPortal Study: {r.get('name')}"
                abstract = r.get("description", "Cancer genomics study.")
                papers.append({
                    "external_id": r["studyId"],
                    "source": "cbioportal",
                    "content_hash": TextUtils.generate_content_hash(title, abstract),
                    "title": title,
                    "abstract": abstract,
                    "journal": "cBioPortal for Cancer Genomics",
                    "authors": r.get("citation", "Unknown"),
                    "published_at": datetime.now(IST),
                    "paper_url": f"https://www.cbioportal.org/study/summary?id={r['studyId']}",
                    "doi": None
                })
            except: continue
        return papers

class PubTatorService:
    BASE_URL = "https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/"

    async def search_entities(self, query: str, max_results: int = 10) -> List[Dict[str, Any]]:
        params = {"text": query, "size": max_results}
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(self.BASE_URL, params=params, timeout=30.0)
                if response.status_code in [429, 403]:
                    raise httpx.HTTPStatusError(f"Rate limited/Forbidden: {response.status_code}", request=response.request, response=response)
                response.raise_for_status()
                data = response.json()
                return self._map(data.get("results", []))
            except httpx.HTTPStatusError as e:
                if e.response.status_code in [429, 403]:
                    raise e
                logger.warning(f"PubTator failed: {e}")
                return []
            except Exception as e:
                logger.warning(f"PubTator failed: {e}")
                return []

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                title = r.get("title", "Unknown Title")
                abstract = r.get("abstract", "")
                pmid = r.get("pmid")
                papers.append({
                    "external_id": str(pmid),
                    "source": "pubtator",
                    "content_hash": TextUtils.generate_content_hash(title, abstract),
                    "title": title,
                    "abstract": abstract,
                    "journal": "PubMed (via PubTator)",
                    "authors": "Unknown",
                    "published_at": datetime.now(IST),
                    "paper_url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    "doi": None
                })
            except: continue
        return papers
