import httpx
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
import asyncio
from ingestion_agent.app.utils.logger import logger
from ingestion_agent.app.utils.text_utils import TextUtils

# Define IST (UTC+5:30) for local data normalization
IST = timezone(timedelta(hours=5, minutes=30))

class BioRxivService:
    """
    Service for interacting with the bioRxiv / medRxiv API.
    Fetches preprints related to oncology and medicine.
    """

    BASE_URL = "https://api.biorxiv.org/details"

    async def search_papers(self, server: str = "biorxiv", days: int = 7) -> List[Dict[str, Any]]:
        """
        Fetches papers from bioRxiv or medRxiv published in the last X days.
        Note: bioRxiv API doesn't support full-text search directly via API, 
        it's more of a firehose. We fetch latest and filter for oncology keywords.
        """
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        url = f"{self.BASE_URL}/{server}/{start_date}/{end_date}/0"

        async with httpx.AsyncClient() as client:
            try:
                logger.debug(f"Fetching from {server}: {start_date} to {end_date}")
                response = await client.get(url, timeout=30.0)
                response.raise_for_status()
                data = response.json()
                return self._filter_and_map(data.get("collection", []), server)
            except Exception as e:
                logger.error(f"{server} retrieval failed: {e}")
                return []

    def _filter_and_map(self, raw_papers: List[Dict[str, Any]], server: str) -> List[Dict[str, Any]]:
        """
        Filters papers for oncology keywords and maps them to the internal schema.
        """
        keywords = ["cancer", "oncology", "tumor", "malignant", "leukemia", "lymphoma", "carcinoma", "sarcoma", "melanoma"]
        filtered = []
        now_ist = datetime.now(IST)

        for p in raw_papers:
            title = p.get("title", "").lower()
            abstract = p.get("abstract", "").lower()
            
            if any(k in title or k in abstract for k in keywords):
                try:
                    published_at = datetime.strptime(p["date"], "%Y-%m-%d").replace(tzinfo=IST)
                    if published_at > now_ist:
                        published_at = now_ist

                    filtered.append({
                        "external_id": p["doi"],
                        "source": server,
                        "content_hash": TextUtils.generate_content_hash(p["title"], p["abstract"]),
                        "title": p["title"],
                        "abstract": p["abstract"],
                        "journal": f"{server.capitalize()} Preprint",
                        "authors": p["authors"],
                        "published_at": published_at,
                        "paper_url": f"https://www.{server}.org/content/{p['doi']}",
                        "doi": p["doi"],
                        "metadata_json": {"category": p.get("category")}
                    })
                except Exception as e:
                    logger.error(f"Failed to map {server} paper: {e}")
                    continue
        
        return filtered
