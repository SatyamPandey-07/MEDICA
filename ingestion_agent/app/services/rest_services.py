import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import asyncio
import random
import email.utils
from ingestion_agent.app.utils.logger import logger
from ingestion_agent.app.utils.text_utils import TextUtils
from ingestion_agent.app.utils.rate_limiter import rate_governor

IST = timezone(timedelta(hours=5, minutes=30))

def parse_retry_after(header_val: Optional[str]) -> float:
    """Parses Retry-After header into fractional seconds to wait."""
    if not header_val:
        return 5.0
    try:
        # Try parsing as number of seconds
        return float(header_val)
    except ValueError:
        pass
    try:
        # Try parsing as HTTP date
        parsed_time = email.utils.parsedate_to_datetime(header_val)
        delta = (parsed_time - datetime.now(timezone.utc)).total_seconds()
        return max(1.0, delta)
    except Exception:
        return 10.0

class OpenAlexService:
    BASE_URL = "https://api.openalex.org/works"

    def __init__(self, email: str, client: httpx.AsyncClient = None):
        self.email = email
        self.client = client
        self._own_client = False
        if client is None:
            self.client = httpx.AsyncClient()
            self._own_client = True

    async def close(self):
        if self._own_client and self.client:
            await self.client.aclose()

    async def search_papers(self, query: str, max_results: int = 20) -> List[Dict[str, Any]]:
        # Check Cache
        cached = await rate_governor.cache.get("openalex", query)
        if cached is not None:
            logger.info(f"[OPENALEX] Cache hit for '{query}'. Returning cached results.")
            return cached

        # Acquire pacing
        allowed = await rate_governor.acquire("openalex", query)
        if not allowed:
            return []

        params = {
            "search": query,
            "mailto": self.email,
            "per_page": max_results,
            "sort": "publication_date:desc"
        }
        headers = {
            "User-Agent": "OncologyAgent/1.0 (mailto:kushagra.saxena@example.com)",
            "Accept": "application/json",
            "X-Polite-Contact": self.email
        }
        
        max_retries = 3
        retry_delay = 5.0

        try:
            for attempt in range(max_retries):
                try:
                    if attempt > 0:
                        wait_time = retry_delay * (2 ** (attempt - 1)) * random.uniform(0.8, 1.2)
                        logger.warning(f"OpenAlex Retry attempt {attempt} for '{query}' after {wait_time:.2f}s delay")
                        await asyncio.sleep(wait_time)

                    logger.debug(f"Searching OpenAlex: {query}")
                    response = await self.client.get(self.BASE_URL, params=params, headers=headers, timeout=30.0)
                    
                    if response.status_code == 429:
                        logger.warning(f"OpenAlex rate limit hit (429) for '{query}'")
                        if attempt == max_retries - 1:
                            logger.warning(f"OpenAlex rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("openalex")
                            return []
                        continue
                        
                    response.raise_for_status()
                    data = response.json()
                    papers = self._map(data.get("results", []))
                    
                    # Record success and cache
                    await rate_governor.record_success("openalex")
                    await rate_governor.cache.set("openalex", query, papers)
                    return papers

                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        if attempt == max_retries - 1:
                            logger.warning(f"OpenAlex rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("openalex")
                            return []
                        continue
                    logger.error(f"OpenAlex failed ({type(e).__name__}): {e}")
                    await rate_governor.record_failure("openalex")
                    return []
                except Exception as e:
                    if attempt == max_retries - 1:
                        logger.error(f"OpenAlex failed ({type(e).__name__}): {e}")
                        await rate_governor.record_failure("openalex")
                        return []
                    logger.debug(f"OpenAlex attempt {attempt+1} failed ({type(e).__name__}): {e}")
                    continue
            return []
        finally:
            rate_governor.release_semaphore("openalex")

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                title = r.get("title") or ""
                abstract = ""
                papers.append({
                    "external_id": r["id"].split("/")[-1],
                    "source": "openalex",
                    "content_hash": TextUtils.generate_content_hash(title, abstract),
                    "title": title,
                    "abstract": abstract,
                    "journal": r.get("host_venue", {}).get("display_name") or "Unknown",
                    "authors": ", ".join([a.get("author", {}).get("display_name") for a in r.get("authorships", [])]),
                    "published_at": datetime.strptime(r["publication_date"], "%Y-%m-%d").replace(tzinfo=IST),
                    "paper_url": r.get("doi") or r.get("ids", {}).get("mag"),
                    "doi": r.get("doi", "").replace("https://doi.org/", "")
                })
            except: continue
        return papers

class SemanticScholarService:
    BASE_URL = "https://api.semanticscholar.org/graph/v1/paper/search"

    def __init__(self, api_key: str = None, client: httpx.AsyncClient = None):
        self.api_key = api_key
        self.client = client
        self._own_client = False
        if client is None:
            self.client = httpx.AsyncClient()
            self._own_client = True
        
        self.headers = {
            "User-Agent": "OncologyAgent/1.0 (mailto:kushagra.saxena@example.com)",
            "Accept": "application/json"
        }
        if api_key:
            self.headers["x-api-key"] = api_key

    async def close(self):
        if self._own_client and self.client:
            await self.client.aclose()

    async def search_papers(self, query: str, max_results: int = 20) -> List[Dict[str, Any]]:
        # 1. Check Query Cache
        cached = await rate_governor.cache.get("semanticscholar", query)
        if cached is not None:
            logger.info(f"[SEMANTIC SCHOLAR] Cache hit for '{query}'. Returning cached results.")
            return cached

        # 2. Acquire Pacing and Concurrency Lock
        allowed = await rate_governor.acquire("semanticscholar", query, has_key=bool(self.api_key))
        if not allowed:
            logger.warning(f"[SEMANTIC SCHOLAR] Blocked due to open circuit breaker.")
            return []

        params = {
            "query": query,
            "limit": max_results,
            "fields": "title,abstract,authors,year,url,externalIds,venue,publicationDate"
        }
        
        max_retries = 3
        retry_delay = 10.0

        try:
            for attempt in range(max_retries):
                try:
                    if attempt > 0:
                        wait_time = retry_delay * (2 ** (attempt - 1)) * random.uniform(0.8, 1.2)
                        logger.debug(f"SemanticScholar Retry attempt {attempt} for '{query}' after {wait_time:.2f}s delay")
                        await asyncio.sleep(wait_time)
                    
                    logger.debug(f"Searching SemanticScholar: {query}")
                    response = await self.client.get(self.BASE_URL, params=params, headers=self.headers, timeout=30.0)
                    
                    if response.status_code == 429:
                        retry_after = response.headers.get("Retry-After")
                        sleep_time = parse_retry_after(retry_after)
                        logger.debug(f"SemanticScholar rate limit hit (429) for '{query}'. Retry-After: {retry_after}s. Sleeping {sleep_time:.2f}s.")
                        
                        if attempt == max_retries - 1:
                            logger.warning(f"SemanticScholar rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("semanticscholar", has_key=bool(self.api_key))
                            return []
                            
                        await asyncio.sleep(sleep_time)
                        continue
                        
                    response.raise_for_status()
                    data = response.json()
                    papers = self._map(data.get("data", []))
                    
                    # Success
                    await rate_governor.record_success("semanticscholar")
                    await rate_governor.cache.set("semanticscholar", query, papers)
                    return papers

                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        if attempt == max_retries - 1:
                            logger.warning(f"SemanticScholar rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("semanticscholar", has_key=bool(self.api_key))
                            return []
                        continue
                    logger.error(f"SemanticScholar failed ({type(e).__name__}): {e}")
                    await rate_governor.record_failure("semanticscholar")
                    break
                except (httpx.TimeoutException, httpx.RequestError) as e:
                    logger.warning(f"SemanticScholar timed out/failed for '{query}' (attempt {attempt+1}): {e}")
                    if attempt == max_retries - 1:
                        await rate_governor.record_failure("semanticscholar")
                        return []
                    continue
                except Exception as e:
                    logger.error(f"SemanticScholar failed unexpectedly ({type(e).__name__}): {e}")
                    await rate_governor.record_failure("semanticscholar")
                    break
            
            return []
        finally:
            rate_governor.release_semaphore("semanticscholar")

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                pub_date = r.get("publicationDate")
                if pub_date:
                    published_at = datetime.strptime(pub_date, "%Y-%m-%d").replace(tzinfo=IST)
                else:
                    published_at = datetime(r.get("year", 2024), 1, 1).replace(tzinfo=IST)

                papers.append({
                    "external_id": r["paperId"],
                    "source": "semanticscholar",
                    "content_hash": TextUtils.generate_content_hash(r["title"], r.get("abstract", "")),
                    "title": r["title"],
                    "abstract": r.get("abstract", ""),
                    "journal": r.get("venue") or "Unknown",
                    "authors": ", ".join([a.get("name") for a in r.get("authors", [])]),
                    "published_at": published_at,
                    "paper_url": r.get("url"),
                    "doi": r.get("externalIds", {}).get("DOI")
                })
            except: continue
        return papers

class EuropePMCService:
    BASE_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

    def __init__(self, client: httpx.AsyncClient = None):
        self.client = client
        self._own_client = False
        if client is None:
            self.client = httpx.AsyncClient()
            self._own_client = True

    async def close(self):
        if self._own_client and self.client:
            await self.client.aclose()

    async def search_papers(self, query: str, max_results: int = 20) -> List[Dict[str, Any]]:
        # Check Cache
        cached = await rate_governor.cache.get("europepmc", query)
        if cached is not None:
            logger.info(f"[EUROPE PMC] Cache hit for '{query}'. Returning cached results.")
            return cached

        # Acquire pacing
        allowed = await rate_governor.acquire("europepmc", query)
        if not allowed:
            return []

        params = {
            "query": query,
            "pageSize": max_results,
            "resultType": "core",
            "format": "json"
        }
        headers = {
            "User-Agent": "OncologyAgent/1.0 (mailto:kushagra.saxena@example.com)",
            "Accept": "application/json"
        }
        
        max_retries = 3
        retry_delay = 5.0

        try:
            for attempt in range(max_retries):
                try:
                    if attempt > 0:
                        wait_time = retry_delay * (2 ** (attempt - 1)) * random.uniform(0.8, 1.2)
                        logger.warning(f"EuropePMC Retry attempt {attempt} for '{query}' after {wait_time:.2f}s delay")
                        await asyncio.sleep(wait_time)

                    logger.debug(f"Searching EuropePMC: {query}")
                    response = await self.client.get(self.BASE_URL, params=params, headers=headers, timeout=30.0)
                    
                    if response.status_code == 429:
                        logger.warning(f"EuropePMC rate limit hit (429) for '{query}'")
                        if attempt == max_retries - 1:
                            logger.warning(f"EuropePMC rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("europepmc")
                            return []
                        continue
                        
                    response.raise_for_status()
                    data = response.json()
                    papers = self._map(data.get("resultList", {}).get("result", []))
                    
                    await rate_governor.record_success("europepmc")
                    await rate_governor.cache.set("europepmc", query, papers)
                    return papers

                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        if attempt == max_retries - 1:
                            logger.warning(f"EuropePMC rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("europepmc")
                            return []
                        continue
                    logger.error(f"EuropePMC failed ({type(e).__name__}): {e}")
                    await rate_governor.record_failure("europepmc")
                    return []
                except Exception as e:
                    if attempt == max_retries - 1:
                        logger.error(f"EuropePMC failed ({type(e).__name__}): {e}")
                        await rate_governor.record_failure("europepmc")
                        return []
                    logger.debug(f"EuropePMC attempt {attempt+1} failed ({type(e).__name__}): {e}")
                    continue
            return []
        finally:
            rate_governor.release_semaphore("europepmc")

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                papers.append({
                    "external_id": r.get("id"),
                    "source": "europepmc",
                    "content_hash": TextUtils.generate_content_hash(r["title"], r.get("abstractText", "")),
                    "title": r["title"],
                    "abstract": r.get("abstractText", ""),
                    "journal": r.get("journalTitle") or "Unknown",
                    "authors": r.get("authorString"),
                    "published_at": datetime.strptime(r.get("firstPublicationDate") or "2024-01-01", "%Y-%m-%d").replace(tzinfo=IST),
                    "paper_url": f"https://europepmc.org/article/{r.get('source')}/{r.get('id')}",
                    "doi": r.get("doi")
                })
            except: continue
        return papers

class CrossrefService:
    BASE_URL = "https://api.crossref.org/works"

    def __init__(self, email: str, client: httpx.AsyncClient = None):
        self.email = email
        self.client = client
        self._own_client = False
        if client is None:
            self.client = httpx.AsyncClient()
            self._own_client = True

    async def close(self):
        if self._own_client and self.client:
            await self.client.aclose()

    async def search_papers(self, query: str, max_results: int = 20) -> List[Dict[str, Any]]:
        # Check Cache
        cached = await rate_governor.cache.get("crossref", query)
        if cached is not None:
            logger.info(f"[CROSSREF] Cache hit for '{query}'. Returning cached results.")
            return cached

        # Acquire pacing
        allowed = await rate_governor.acquire("crossref", query)
        if not allowed:
            return []

        params = {
            "query": query,
            "rows": max_results,
            "sort": "published",
            "order": "desc",
            "mailto": self.email
        }
        headers = {
            "User-Agent": "OncologyAgent/1.0 (mailto:kushagra.saxena@example.com)",
            "X-User-Agent": f"OncologyAgent/1.0 (mailto:{self.email})"
        }
        
        max_retries = 3
        retry_delay = 5.0

        try:
            for attempt in range(max_retries):
                try:
                    if attempt > 0:
                        wait_time = retry_delay * (2 ** (attempt - 1)) * random.uniform(0.8, 1.2)
                        logger.warning(f"Crossref Retry attempt {attempt} for '{query}' after {wait_time:.2f}s delay")
                        await asyncio.sleep(wait_time)

                    logger.debug(f"Searching Crossref: {query}")
                    response = await self.client.get(self.BASE_URL, params=params, headers=headers, timeout=30.0)
                    
                    if response.status_code == 429:
                        logger.warning(f"Crossref rate limit hit (429) for '{query}'")
                        if attempt == max_retries - 1:
                            logger.warning(f"Crossref rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("crossref")
                            return []
                        continue
                        
                    response.raise_for_status()
                    data = response.json()
                    papers = self._map(data.get("message", {}).get("items", []))
                    
                    await rate_governor.record_success("crossref")
                    await rate_governor.cache.set("crossref", query, papers)
                    return papers

                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        if attempt == max_retries - 1:
                            logger.warning(f"Crossref rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("crossref")
                            return []
                        continue
                    logger.error(f"Crossref failed ({type(e).__name__}): {e}")
                    await rate_governor.record_failure("crossref")
                    return []
                except Exception as e:
                    if attempt == max_retries - 1:
                        logger.error(f"Crossref failed ({type(e).__name__}): {e}")
                        await rate_governor.record_failure("crossref")
                        return []
                    logger.debug(f"Crossref attempt {attempt+1} failed ({type(e).__name__}): {e}")
                    continue
            return []
        finally:
            rate_governor.release_semaphore("crossref")

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                title = r.get("title", [""])[0]
                abstract = r.get("abstract", "")
                p_parts = r.get("published", r.get("created", {})).get("date-parts", [[2024, 1, 1]])[0]
                pub_date = datetime(p_parts[0], p_parts[1] if len(p_parts) > 1 else 1, p_parts[2] if len(p_parts) > 2 else 1).replace(tzinfo=IST)

                papers.append({
                    "external_id": r["DOI"],
                    "source": "crossref",
                    "content_hash": TextUtils.generate_content_hash(title, abstract),
                    "title": title,
                    "abstract": abstract,
                    "journal": r.get("container-title", ["Unknown"])[0],
                    "authors": ", ".join([f"{a.get('given', '')} {a.get('family', '')}" for a in r.get("author", [])]),
                    "published_at": pub_date,
                    "paper_url": r.get("URL"),
                    "doi": r["DOI"]
                })
            except: continue
        return papers
