import httpx
import xml.etree.ElementTree as ET
import subprocess
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
import asyncio
from ingestion_agent.app.config.settings import settings
from ingestion_agent.app.utils.logger import logger
from ingestion_agent.app.utils.text_utils import TextUtils

# Define IST (UTC+5:30) for local data normalization
IST = timezone(timedelta(hours=5, minutes=30))

class PubMedService:
    """
    Low-level service for interacting directly with NCBI PubMed E-Utilities.
    
    This service handles discovery (ESearch) and detailed retrieval (EFetch).
    It includes a robust fallback to 'curl' for cases where NCBI blocks 
    standard Python HTTP clients.
    """

    BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"

    def __init__(self):
        # Mandatory parameters for NCBI compliance
        self.params = {
            "tool": settings.NCBI_TOOL_NAME,
            "email": settings.NCBI_EMAIL,
        }
        # Include API key if provided to unlock higher rate limits (10 req/sec)
        if settings.NCBI_API_KEY:
            self.params["api_key"] = settings.NCBI_API_KEY.get_secret_value()

    async def search_pmids(self, query: str, max_results: int = 50) -> List[str]:
        """
        ESearch Flow:
        1. Submits oncology query to PubMed.
        2. Retrieves the latest PMIDs (PubMed IDs).
        3. Sorts by publication date to prioritize newest research.
        """
        url = f"{self.BASE_URL}esearch.fcgi"
        params = {
            **self.params,
            "db": "pubmed",
            "term": query,
            "retmax": max_results,
            "retmode": "json",
            "sort": "pub_date"
        }

        headers = {"User-Agent": f"OncologyAgent/1.0 (mailto:{settings.NCBI_EMAIL})"}

        async with httpx.AsyncClient() as client:
            try:
                # Small safety sleep to stay under 3 req/sec
                await asyncio.sleep(0.4)
                logger.debug(f"Searching PubMed: {query}")
                response = await client.get(url, params=params, headers=headers, timeout=30.0)
                
                # Check for blocking; NCBI sometimes blocks httpx but allows curl
                if response.status_code == 403:
                    logger.warning("ESearch 403 Forbidden. Discovery failed.")
                    return []

                response.raise_for_status()
                data = response.json()
                return data.get("esearchresult", {}).get("idlist", [])
            except Exception as e:
                logger.error(f"PubMed ESearch failed: {e}")
                return []

    async def fetch_metadata(self, pmids: List[str]) -> List[Dict[str, Any]]:
        """
        EFetch Flow with Batching:
        1. Takes a list of PMIDs.
        2. Splits into batches of 200 to prevent 'Request URI too long' errors.
        3. Requests XML metadata for each batch.
        4. Aggregates and returns the full list.
        """
        if not pmids:
            return []

        all_papers = []
        batch_size = 200
        
        for i in range(0, len(pmids), batch_size):
            batch = pmids[i : i + batch_size]
            logger.debug(f"Retrieving metadata for batch {i//batch_size + 1} ({len(batch)} PMIDs)")
            
            url = f"{self.BASE_URL}efetch.fcgi"
            params = {
                **self.params,
                "db": "pubmed",
                "id": ",".join(batch),
                "retmode": "xml"
            }
            
            headers = {"User-Agent": f"OncologyAgent/1.0 (mailto:{settings.NCBI_EMAIL})"}

            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(url, params=params, headers=headers, timeout=60.0)
                    
                    if response.status_code == 403:
                        logger.warning("EFetch 403 Forbidden. Executing curl fallback for batch...")
                        xml_content = await self._fetch_with_curl(f"{url}?{'&'.join([f'{k}={v}' for k, v in params.items()])}")
                    else:
                        response.raise_for_status()
                        xml_content = response.text
                    
                    batch_papers = self._parse_pubmed_xml(xml_content)
                    all_papers.extend(batch_papers)
                    
                    # Rate limiting safety: brief pause between batches if no API key
                    if not settings.NCBI_API_KEY:
                        await asyncio.sleep(0.4) 

                except Exception as e:
                    logger.error(f"PubMed EFetch batch failed: {e}")
                    continue
        
        return all_papers

    async def _fetch_with_curl(self, full_url: str) -> str:
        """Subprocess fallback for resilient data ingestion."""
        process = await asyncio.create_subprocess_exec(
            "curl", "-sL", full_url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await process.communicate()
        return stdout.decode()

    def _parse_pubmed_xml(self, xml_content: str) -> List[Dict[str, Any]]:
        """
        Metadata Extraction and Normalization:
        - Extracts Title, Abstract, DOI, and Authors.
        - Prioritizes Epub date (end of citation) for 'published_at'.
        - Localizes all dates to IST.
        - Clips future-dated research to the current moment.
        """
        root = ET.fromstring(xml_content)
        papers = []
        now_ist = datetime.now(IST)

        for article in root.findall(".//PubmedArticle"):
            try:
                medline = article.find("MedlineCitation")
                article_meta = medline.find("Article")
                pmid = medline.findtext("PMID")
                
                # --- Date Extraction Logic ---
                year, month, day = None, "Jan", "01"
                # 1. Try ArticleDate (Electronic/Epub date)
                art_date = article_meta.find("ArticleDate")
                if art_date is not None:
                    year = art_date.findtext("Year")
                    month = art_date.findtext("Month") or "01"
                    day = art_date.findtext("Day") or "01"
                # 2. Fallback to Journal Issue date
                if not year:
                    pub_date_elem = article_meta.find("Journal/JournalIssue/PubDate")
                    if pub_date_elem is not None:
                        year = pub_date_elem.findtext("Year")
                        month = pub_date_elem.findtext("Month") or "Jan"
                        day = pub_date_elem.findtext("Day") or "01"

                # Normalize to IST datetime object
                published_at = None
                try:
                    if year:
                        if month.isdigit():
                            published_at = datetime(int(year), int(month), int(day or 1), tzinfo=IST)
                        else:
                            published_at = datetime.strptime(f"{year}-{month}-{day or '01'}", "%Y-%b-%d").replace(tzinfo=IST)
                        # Future Date Clipping
                        if published_at > now_ist:
                            published_at = now_ist
                except:
                    published_at = datetime(int(year), 1, 1, tzinfo=IST) if year else None

                # --- Metadata Mapping ---
                abstract_parts = article_meta.findall(".//AbstractText")
                abstract = " ".join([part.text for part in abstract_parts if part.text])
                
                author_list = article_meta.findall(".//Author")
                authors = ", ".join([f"{a.findtext('LastName')} {a.findtext('ForeName')}" for a in author_list if a.findtext('LastName')])

                papers.append({
                    "external_id": pmid,
                    "source": "pubmed",
                    "content_hash": TextUtils.generate_content_hash(article_meta.findtext("ArticleTitle"), abstract),
                    "title": article_meta.findtext("ArticleTitle"),
                    "abstract": abstract,
                    "journal": article_meta.find("Journal").findtext("Title"),
                    "authors": authors,
                    "published_at": published_at,
                    "paper_url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    "doi": next((e.text for e in article_meta.findall("ELocationID") if e.get("EIdType") == "doi"), None)
                })
            except Exception as e:
                logger.error(f"Failed to parse paper: {e}")
                continue
        
        return papers
