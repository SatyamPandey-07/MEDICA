import httpx
import xml.etree.ElementTree as ET
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
import asyncio
import random
from ingestion_agent.app.utils.logger import logger
from ingestion_agent.app.utils.text_utils import TextUtils
from ingestion_agent.app.utils.rate_limiter import rate_governor

# Define IST (UTC+5:30) for local data normalization
IST = timezone(timedelta(hours=5, minutes=30))

class ArXivService:
    """
    Service for interacting with the ArXiv API.
    Fetches oncology-related preprints and papers.
    """

    BASE_URL = "https://export.arxiv.org/api/query"

    def __init__(self, client: httpx.AsyncClient = None):
        self.client = client
        self._own_client = False
        if client is None:
            self.client = httpx.AsyncClient()
            self._own_client = True

    async def close(self):
        if self._own_client and self.client:
            await self.client.aclose()

    async def search_papers(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """
        Searches ArXiv for papers matching the query with robust retry logic.
        ArXiv policy: 1 request per 3 seconds, serialized execution.
        """
        # 1. Check Query Cache
        cached = await rate_governor.cache.get("arxiv", query)
        if cached is not None:
            logger.info(f"[ARXIV] Cache hit for '{query}'. Returning cached results.")
            return cached

        # 2. Acquire Pacing and Concurrency Lock
        allowed = await rate_governor.acquire("arxiv", query)
        if not allowed:
            logger.warning(f"[ARXIV] Request for '{query}' skipped due to open circuit breaker.")
            return []

        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": max_results,
            "sortBy": "submittedDate",
            "sortOrder": "descending"
        }

        # Polite, specific User-Agent for ArXiv compliance
        headers = {
            "User-Agent": "OncologyAgent/1.0 (mailto:kushagra.saxena@example.com; research-crawler)",
            "Accept": "application/atom+xml,application/xml"
        }
        
        max_retries = 3
        retry_delay = 10.0  # Initial retry delay

        try:
            for attempt in range(max_retries):
                try:
                    if attempt > 0:
                        # Exponential backoff with jitter for retries
                        jitter = random.uniform(0.8, 1.2)
                        wait_time = retry_delay * (2 ** (attempt - 1)) * jitter
                        logger.warning(f"ArXiv Retry attempt {attempt} for '{query}' after {wait_time:.2f}s delay")
                        await asyncio.sleep(wait_time)
                    
                    logger.debug(f"Searching ArXiv: {query}")
                    # 60s timeout since ArXiv is heavily loaded
                    response = await self.client.get(self.BASE_URL, params=params, headers=headers, timeout=60.0)
                    
                    if response.status_code in [429, 503]:
                        logger.warning(f"ArXiv returned status {response.status_code} (Rate Limit/Unavailable) for '{query}'")
                        if attempt == max_retries - 1:
                            logger.warning(f"ArXiv rate limit exhausted for '{query}'. Slowing down and skipping.")
                            await rate_governor.slow_down("arxiv")
                            return []
                        continue
                        
                    response.raise_for_status()
                    papers = self._parse_arxiv_xml(response.text)
                    
                    # Record success and cache result
                    await rate_governor.record_success("arxiv")
                    await rate_governor.cache.set("arxiv", query, papers)
                    return papers

                except httpx.HTTPStatusError as e:
                    if e.response.status_code in [429, 503]:
                        if attempt == max_retries - 1:
                            logger.warning(f"ArXiv rate limit exhausted for '{query}'. Slowing down and skipping.")
                            await rate_governor.slow_down("arxiv")
                            return []
                        continue
                    logger.error(f"ArXiv HTTP error {e.response.status_code}: {e}")
                    await rate_governor.record_failure("arxiv")
                    break
                except (httpx.TimeoutException, httpx.RequestError) as e:
                    logger.warning(f"ArXiv request failed/timed out for '{query}' (attempt {attempt+1}): {e}")
                    if attempt == max_retries - 1:
                        await rate_governor.record_failure("arxiv")
                        return []
                    continue
                except Exception as e:
                    logger.error(f"ArXiv search failed unexpectedly ({type(e).__name__}): {e}")
                    await rate_governor.record_failure("arxiv")
                    break
            
            return []
        finally:
            # Always release serialization semaphore
            rate_governor.release_semaphore("arxiv")

    def _parse_arxiv_xml(self, xml_content: str) -> List[Dict[str, Any]]:
        """
        Parses the Atom feed from ArXiv.
        """
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(xml_content)
        papers = []
        now_ist = datetime.now(IST)

        for entry in root.findall("atom:entry", ns):
            try:
                arxiv_url = entry.findtext("atom:id", namespaces=ns)
                external_id = arxiv_url.split('/')[-1]
                
                title = entry.findtext("atom:title", namespaces=ns).replace('\n', ' ').strip()
                abstract = entry.findtext("atom:summary", namespaces=ns).replace('\n', ' ').strip()
                
                published_str = entry.findtext("atom:published", namespaces=ns)
                published_at = datetime.fromisoformat(published_str.replace('Z', '+00:00')).astimezone(IST)
                if published_at > now_ist:
                    published_at = now_ist

                authors = ", ".join([a.findtext("atom:name", namespaces=ns) for a in entry.findall("atom:author", ns)])
                doi = entry.findtext("{http://arxiv.org/schemas/atom}doi", namespaces=ns)

                papers.append({
                    "external_id": external_id,
                    "source": "arxiv",
                    "content_hash": TextUtils.generate_content_hash(title, abstract),
                    "title": title,
                    "abstract": abstract,
                    "journal": "ArXiv Preprint",
                    "authors": authors,
                    "published_at": published_at,
                    "paper_url": arxiv_url,
                    "doi": doi,
                    "metadata_json": {"arxiv_url": arxiv_url}
                })
            except Exception as e:
                logger.error(f"Failed to parse ArXiv entry: {e}")
                continue
        
        return papers
