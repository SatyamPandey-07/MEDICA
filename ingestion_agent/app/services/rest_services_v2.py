import httpx
import asyncio
import json
import urllib.parse
from typing import List, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
import random
from ingestion_agent.app.utils.logger import logger
from ingestion_agent.app.utils.text_utils import TextUtils
from ingestion_agent.app.utils.rate_limiter import rate_governor

IST = timezone(timedelta(hours=5, minutes=30))

class DOAJService:
    BASE_URL = "https://doaj.org/api/v2/search/articles"

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
        cached = await rate_governor.cache.get("doaj", query)
        if cached is not None:
            logger.info(f"[DOAJ] Cache hit for '{query}'. Returning cached results.")
            return cached

        # Acquire pacing
        allowed = await rate_governor.acquire("doaj", query)
        if not allowed:
            return []

        import urllib.parse
        encoded_query = urllib.parse.quote(query)
        url = f"{self.BASE_URL}/{encoded_query}"
        params = {"pageSize": max_results, "sort": "created_date:desc"}
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
                        logger.warning(f"DOAJ Retry attempt {attempt} for '{query}' after {wait_time:.2f}s delay")
                        await asyncio.sleep(wait_time)

                    logger.debug(f"Searching DOAJ: {query}")
                    response = await self.client.get(url, params=params, headers=headers, timeout=30.0)
                    
                    if response.status_code in [429, 403]:
                        logger.warning(f"DOAJ rate limit/Forbidden ({response.status_code}) for '{query}'")
                        if attempt == max_retries - 1:
                            logger.warning(f"DOAJ rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("doaj")
                            return []
                        continue
                        
                    response.raise_for_status()
                    data = response.json()
                    papers = self._map(data.get("results", []))
                    
                    await rate_governor.record_success("doaj")
                    await rate_governor.cache.set("doaj", query, papers)
                    return papers

                except httpx.HTTPStatusError as e:
                    if e.response.status_code in [429, 403]:
                        if attempt == max_retries - 1:
                            logger.warning(f"DOAJ rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("doaj")
                            return []
                        continue
                    logger.error(f"DOAJ failed ({type(e).__name__}): {e}")
                    await rate_governor.record_failure("doaj")
                    return []
                except Exception as e:
                    if attempt == max_retries - 1:
                        logger.error(f"DOAJ failed ({type(e).__name__}): {e}")
                        await rate_governor.record_failure("doaj")
                        return []
                    logger.debug(f"DOAJ attempt {attempt+1} failed ({type(e).__name__}): {e}")
                    continue
            return []
        finally:
            rate_governor.release_semaphore("doaj")

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                bib = r.get("bibjson", {})
                title = bib.get("title")
                abstract = bib.get("abstract", "")
                papers.append({
                    "external_id": r["id"],
                    "source": "doaj",
                    "content_hash": TextUtils.generate_content_hash(title, abstract),
                    "title": title,
                    "abstract": abstract,
                    "journal": bib.get("journal", {}).get("title", "Unknown"),
                    "authors": ", ".join([a.get("name") for a in bib.get("author", [])]),
                    "published_at": datetime.strptime(r["created_date"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=IST),
                    "paper_url": bib.get("link", [{}])[0].get("url"),
                    "doi": next((i.get("id") for i in bib.get("identifier", []) if i.get("type") == "doi"), None)
                })
            except: continue
        return papers


class ClinicalTrialsService:
    BASE_URL = "https://clinicaltrials.gov/api/v2/studies"

    def __init__(self, client: httpx.AsyncClient = None):
        self.client = client
        self._own_client = False
        if client is None:
            self.client = httpx.AsyncClient()
            self._own_client = True

    async def close(self):
        if self._own_client and self.client:
            await self.client.aclose()

    async def search_trials(self, query: str, max_results: int = 20) -> List[Dict[str, Any]]:
        # 1. Check Cache
        cached = await rate_governor.cache.get("clinicaltrials", query)
        if cached is not None:
            logger.info(f"[CLINICAL TRIALS] Cache hit for '{query}'. Returning cached results.")
            return cached

        # 2. Acquire pacing and lock
        allowed = await rate_governor.acquire("clinicaltrials", query)
        if not allowed:
            return []

        params = {"query.term": query, "pageSize": max_results, "sort": "LastUpdatePostDate:desc"}
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json"
        }
        
        max_retries = 3
        retry_delay = 5.0

        try:
            for attempt in range(max_retries):
                if attempt > 0:
                    wait_time = retry_delay * (2 ** (attempt - 1)) * random.uniform(0.8, 1.2)
                    logger.warning(f"ClinicalTrials Retry attempt {attempt} for '{query}' after {wait_time:.2f}s delay")
                    await asyncio.sleep(wait_time)

                logger.debug(f"Searching ClinicalTrials via HTTPX: {query}")
                try:
                    response = await self.client.get(self.BASE_URL, params=params, headers=headers, timeout=30.0)
                    
                    # 3. Log Complete Telemetry for Diagnostic Monitoring
                    self._log_httpx_diagnostics("HTTPX", response)

                    if response.status_code in [403, 429]:
                        logger.debug(f"ClinicalTrials HTTPX returned {response.status_code}. Initiating Resilient Curl Fallback.")
                        # Fallback to subprocess curl
                        status, resp_headers, body, http_ver = await self._fetch_with_curl_diagnostics(self.BASE_URL, params)
                        self._log_curl_diagnostics("CURL FALLBACK", self.BASE_URL, params, status, resp_headers, body, http_ver)
                        
                        if status == 200:
                            data = json.loads(body)
                            papers = self._map(data.get("studies", []))
                            await rate_governor.record_success("clinicaltrials")
                            await rate_governor.cache.set("clinicaltrials", query, papers)
                            return papers
                        else:
                            if attempt == max_retries - 1:
                                raise httpx.HTTPStatusError(f"ClinicalTrials failed via Curl: {status}", request=response.request, response=response)
                            continue

                    response.raise_for_status()
                    data = response.json()
                    papers = self._map(data.get("studies", []))
                    
                    await rate_governor.record_success("clinicaltrials")
                    await rate_governor.cache.set("clinicaltrials", query, papers)
                    return papers

                except (httpx.HTTPStatusError, httpx.RequestError, Exception) as e:
                    logger.debug(f"ClinicalTrials HTTPX failed: {e}. Attempting Resilient Curl Fallback...")
                    
                    try:
                        status, resp_headers, body, http_ver = await self._fetch_with_curl_diagnostics(self.BASE_URL, params)
                        self._log_curl_diagnostics("CURL FALLBACK", self.BASE_URL, params, status, resp_headers, body, http_ver)
                        
                        if status == 200:
                            data = json.loads(body)
                            papers = self._map(data.get("studies", []))
                            await rate_governor.record_success("clinicaltrials")
                            await rate_governor.cache.set("clinicaltrials", query, papers)
                            return papers
                    except Exception as curl_err:
                        logger.error(f"ClinicalTrials Curl fallback failed: {curl_err}")
                    
                    if attempt == max_retries - 1:
                        await rate_governor.record_failure("clinicaltrials")
                        if isinstance(e, httpx.HTTPStatusError):
                            raise e
                        logger.error(f"ClinicalTrials service failed completely: {e}")
                        return []
                    continue
            
            return []
        finally:
            rate_governor.release_semaphore("clinicaltrials")

    def _log_httpx_diagnostics(self, prefix: str, response: httpx.Response):
        history = [f"{r.status_code} {r.url}" for r in response.history]
        logger.debug(
            f"=== {prefix} DIAGNOSTIC LOG ===\n"
            f"Request URL: {response.request.url}\n"
            f"HTTP Version: {response.extensions.get('http_version', b'HTTP/1.1').decode()}\n"
            f"Request Headers: {json.dumps(dict(response.request.headers), indent=2)}\n"
            f"Response Status: {response.status_code}\n"
            f"Response Headers: {json.dumps(dict(response.headers), indent=2)}\n"
            f"Redirect Chain: {history}\n"
            f"Response Body (truncated): {response.text[:500]}\n"
            f"================================="
        )

    async def _fetch_with_curl_diagnostics(self, url: str, params: dict) -> Tuple[int, dict, str, str]:
        """Runs curl in a subprocess with -i to gather full headers and body."""
        full_url = f"{url}?{urllib.parse.urlencode(params)}"
        process = await asyncio.create_subprocess_exec(
            "curl", "-i", "-sL", "-H", "Accept: application/json", full_url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout_bytes, stderr_bytes = await process.communicate()
        
        if process.returncode != 0:
            raise Exception(f"curl process failed: {stderr_bytes.decode()}")
            
        stdout = stdout_bytes.decode("utf-8", errors="ignore")
        
        # Split headers from body (separated by double newline)
        parts = stdout.split("\r\n\r\n")
        if len(parts) < 2:
            parts = stdout.split("\n\n")
            
        body = parts[-1]
        
        # Parse final response headers from redirect history
        header_lines = []
        http_version = "HTTP/1.1"
        status_code = 200
        
        for part in reversed(parts[:-1]):
            lines = [line.strip() for line in part.split("\n") if line.strip()]
            if lines and (lines[0].startswith("HTTP/") or lines[0].startswith("HTTP/2") or lines[0].startswith("HTTP/3")):
                header_lines = lines
                break
                
        resp_headers = {}
        if header_lines:
            status_line = header_lines[0]
            status_parts = status_line.split(" ", 2)
            http_version = status_parts[0]
            try:
                status_code = int(status_parts[1])
            except:
                pass
            for line in header_lines[1:]:
                if ":" in line:
                    k, v = line.split(":", 1)
                    resp_headers[k.strip().lower()] = v.strip()
                    
        return status_code, resp_headers, body, http_version

    def _log_curl_diagnostics(self, prefix: str, url: str, params: dict, status: int, headers: dict, body: str, http_ver: str):
        full_url = f"{url}?{urllib.parse.urlencode(params)}"
        logger.debug(
            f"=== {prefix} DIAGNOSTIC LOG ===\n"
            f"Request URL: {full_url}\n"
            f"HTTP Version: {http_ver}\n"
            f"Request Headers (Assumed): Accept: application/json, Default curl UA\n"
            f"Response Status: {status}\n"
            f"Response Headers: {json.dumps(headers, indent=2)}\n"
            f"Redirect Chain: [Redirects followed automatically via curl -L]\n"
            f"Response Body (truncated): {body[:500]}\n"
            f"================================="
        )

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                protocol = r.get("protocolSection", {})
                ident = protocol.get("identificationModule", {})
                desc = protocol.get("descriptionModule", {})
                title = ident.get("officialTitle") or ident.get("briefTitle")
                abstract = desc.get("briefSummary", "")
                papers.append({
                    "external_id": ident.get("nctId"),
                    "source": "clinicaltrials",
                    "content_hash": TextUtils.generate_content_hash(title, abstract),
                    "title": title,
                    "abstract": abstract,
                    "journal": "Clinical Trial Registry",
                    "authors": protocol.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name"),
                    "published_at": datetime.now(IST),
                    "paper_url": f"https://clinicaltrials.gov/study/{ident.get('nctId')}",
                    "doi": None
                })
            except: continue
        return papers


class CoreService:
    BASE_URL = "https://api.core.ac.uk/v3/search/works"

    def __init__(self, api_key: str, client: httpx.AsyncClient = None):
        self.api_key = api_key
        self.client = client
        self._own_client = False
        if client is None:
            self.client = httpx.AsyncClient()
            self._own_client = True
        self.headers = {
            "Authorization": f"Bearer {api_key}" if api_key else "",
            "User-Agent": "OncologyAgent/1.0 (mailto:kushagra.saxena@example.com)",
            "Content-Type": "application/json"
        }

    async def close(self):
        if self._own_client and self.client:
            await self.client.aclose()

    async def search_papers(self, query: str, max_results: int = 20) -> List[Dict[str, Any]]:
        if not self.api_key: return []
        
        # Check Cache
        cached = await rate_governor.cache.get("core", query)
        if cached is not None:
            logger.info(f"[CORE] Cache hit for '{query}'. Returning cached results.")
            return cached

        # Acquire pacing
        allowed = await rate_governor.acquire("core", query)
        if not allowed:
            return []

        payload = {
            "q": query,
            "limit": max_results,
            "scroll": False
        }
        
        max_retries = 3
        retry_delay = 5.0

        try:
            for attempt in range(max_retries):
                try:
                    if attempt > 0:
                        wait_time = retry_delay * (2 ** (attempt - 1)) * random.uniform(0.8, 1.2)
                        logger.warning(f"CORE Retry attempt {attempt} for '{query}' after {wait_time:.2f}s delay")
                        await asyncio.sleep(wait_time)

                    logger.debug(f"Searching CORE: {query}")
                    response = await self.client.post(self.BASE_URL, json=payload, headers=self.headers, timeout=30.0)
                    
                    if response.status_code == 429:
                        logger.warning(f"CORE rate limit hit (429) for '{query}'")
                        if attempt == max_retries - 1:
                            logger.warning(f"CORE rate limit exhausted. Slowing down.")
                            await rate_governor.slow_down("core")
                            return []
                        continue

                    response.raise_for_status()
                    data = response.json()
                    papers = self._map(data.get("results", []))
                    
                    await rate_governor.record_success("core")
                    await rate_governor.cache.set("core", query, papers)
                    return papers

                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        if attempt < max_retries - 1:
                            continue
                        logger.warning(f"CORE rate limit exhausted. Slowing down.")
                        await rate_governor.slow_down("core")
                        return []
                    logger.error(f"CORE failed ({type(e).__name__}): {e}")
                    await rate_governor.record_failure("core")
                    return []
                except Exception as e:
                    if attempt == max_retries - 1:
                        logger.error(f"CORE failed ({type(e).__name__}): {e}")
                        await rate_governor.record_failure("core")
                        return []
                    logger.debug(f"CORE attempt {attempt+1} failed ({type(e).__name__}): {e}")
                    continue
            return []
        finally:
            rate_governor.release_semaphore("core")

    def _map(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        papers = []
        for r in results:
            try:
                title = r.get("title")
                abstract = r.get("abstract", "")
                papers.append({
                    "external_id": str(r["id"]),
                    "source": "core",
                    "content_hash": TextUtils.generate_content_hash(title, abstract),
                    "title": title,
                    "abstract": abstract,
                    "journal": r.get("publisher") or "Unknown",
                    "authors": ", ".join([a.get("name") for a in r.get("authors", [])]),
                    "published_at": datetime.strptime(r.get("publishedDate") or "2024-01-01T00:00:00", "%Y-%m-%dT%H:%M:%S").replace(tzinfo=IST),
                    "paper_url": r.get("downloadUrl") or r.get("doi"),
                    "doi": r.get("doi")
                })
            except: continue
        return papers
