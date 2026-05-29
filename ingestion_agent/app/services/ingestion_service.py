import asyncio
from datetime import datetime
from ingestion_agent.app.services.pubmed_service import PubMedService
from ingestion_agent.app.services.arxiv_service import ArXivService
from ingestion_agent.app.services.biorxiv_service import BioRxivService
from ingestion_agent.app.services.rest_services import OpenAlexService, SemanticScholarService, EuropePMCService, CrossrefService
from ingestion_agent.app.services.rest_services_v2 import DOAJService, ClinicalTrialsService, CoreService
from ingestion_agent.app.services.rest_services_v3 import GDCService, CBioPortalService, PubTatorService
from ingestion_agent.app.repositories.paper_repository import PaperRepository
from ingestion_agent.app.db.session import async_session_factory
from ingestion_agent.app.config.settings import settings
from ingestion_agent.app.utils.logger import logger
from ingestion_agent.app.utils.rate_limiter import rate_governor

class IngestionService:
    """
    Ultra-High-Volume Multi-Source Oncology Research Harvester.
    Coordinates across 16 research sources with robust rate limiting,
    query caching, and stateful circuit breaking.
    """

    # Expanded Buzzwords
    BUZZWORDS = [
        "oncology", "immunotherapy", "precision oncology", "liquid biopsy", 
        "CRISPR cancer", "CAR-T Cell Therapy", "checkpoint inhibitors", 
        "metastasis", "tumor microenvironment", "neoantigens", "targeted therapy", 
        "cancer genomics", "radiotherapy", "chemotherapy", "personalized medicine",
        "biopsy", "cancer screening", "early detection", "surgical oncology", "palliative care"
    ]

    def __init__(self):
        # Initialize all 16 services sharing default clients, which will hold connection pools
        self.pubmed = PubMedService()
        self.arxiv = ArXivService()
        self.biorxiv = BioRxivService()
        self.openalex = OpenAlexService(email=settings.NCBI_EMAIL)
        self.sem_scholar = SemanticScholarService(api_key=settings.SEMANTIC_SCHOLAR_API_KEY.get_secret_value() if settings.SEMANTIC_SCHOLAR_API_KEY else None)
        self.europe_pmc = EuropePMCService()
        self.crossref = CrossrefService(email=settings.NCBI_EMAIL)
        self.doaj = DOAJService()
        self.trials = ClinicalTrialsService()
        self.core = CoreService(api_key=settings.CORE_API_KEY.get_secret_value() if settings.CORE_API_KEY else None)
        self.gdc = GDCService()
        self.cbioportal = CBioPortalService()
        self.pubtator = PubTatorService()

    async def close(self):
        """Closes all persistent HTTPX client connection pools gracefully."""
        logger.info("Closing all persistent HTTPX connection pools...")
        for attr in ["arxiv", "openalex", "sem_scholar", "europe_pmc", "crossref", "doaj", "trials", "core"]:
            service = getattr(self, attr, None)
            if service and hasattr(service, "close"):
                try:
                    await service.close()
                except Exception as e:
                    logger.error(f"Failed to close connection pool for {attr}: {e}")

    async def run_ingestion(self):
        logger.info("Starting RESILIENT global harvester cycle (Concurrent Sources)...")
        
        source_names = [
            "pubmed", "openalex", "europepmc", "crossref", 
            "doaj", "core", "arxiv", "clinicaltrials", "gdc", "cbioportal", "pubtator"
        ]
        
        tasks = [self.ingest_source_all_keywords(source) for source in source_names]
        
        # Run all sources concurrently. They pace themselves independently via RateGovernor.
        await asyncio.gather(*tasks, return_exceptions=True)
            
        logger.info("Global harvester cycle complete.")

    async def ingest_source_all_keywords(self, source_name: str):
        """Runs a single source through all keywords sequentially, governed by its TokenBucket."""
        for word in self.BUZZWORDS:
            # Check Circuit Breaker state before attempting the keyword
            breaker = rate_governor._get_breaker(source_name)
            if not await breaker.allow_request():
                logger.warning(f"Source '{source_name}' is currently OPEN (blocked). Skipping remaining keywords.")
                break
                
            async with async_session_factory() as session:
                repo = PaperRepository(session)
                last_sync = await repo.get_last_sync(source_name, word)
                
                search_coro = self._get_search_coro(source_name, word, last_sync)
                if search_coro:
                    success = await self.ingest_generic(search_coro, source_name, word, last_sync)
                    if success:
                        await repo.update_sync_checkpoint(source_name, word)

    def _get_search_coro(self, source_name: str, word: str, last_sync: datetime):
        if source_name == "pubmed": return self.pubmed.search_pmids(word, max_results=10)
        elif source_name == "openalex": return self.openalex.search_papers(word, max_results=10)
        elif source_name == "semanticscholar": return self.sem_scholar.search_papers(word, max_results=10)
        elif source_name == "europepmc": return self.europe_pmc.search_papers(word, max_results=10)
        elif source_name == "crossref": return self.crossref.search_papers(word, max_results=10)
        elif source_name == "doaj": return self.doaj.search_papers(word, max_results=10)
        elif source_name == "core": return self.core.search_papers(word, max_results=10)
        elif source_name == "arxiv": return self.arxiv.search_papers(word, max_results=10)
        elif source_name == "clinicaltrials": return self.trials.search_trials(word, max_results=10)
        elif source_name == "gdc": return self.gdc.search_projects(word, max_results=5)
        elif source_name == "cbioportal": return self.cbioportal.search_studies(word, max_results=5)
        elif source_name == "pubtator": return self.pubtator.search_entities(word, max_results=10)
        return None

    async def ingest_generic(self, search_coro, source_name: str, topic: str, since: datetime = None) -> bool:
        """Helper to process results with rate-limit detection and circuit tripping."""
        try:
            logger.info(f"[{source_name.upper()}] Fetching papers for '{topic}'...")
            results = await search_coro
            
            # Record a success if search_coro successfully returns (even if empty results)
            # Services that raise exceptions will bypass this and record failures
            await rate_governor.record_success(source_name)
            
            if not results: 
                logger.info(f"[{source_name.upper()}] Found 0 papers for '{topic}'")
                return True

            if source_name == "pubmed":
                papers = await self.pubmed.fetch_metadata(results)
            else:
                papers = results

            from ingestion_agent.app.models.paper import IST
            from datetime import datetime
            MIN_DATETIME = datetime(1970, 1, 1, tzinfo=IST)
            
            # Normalize and localize dates to IST
            for p in papers:
                p_date = p.get("published_at")
                if p_date:
                    if p_date.tzinfo is None:
                        p["published_at"] = p_date.replace(tzinfo=IST)
            
            # Sort papers by published date in descending order (newest first)
            papers = sorted(papers, key=lambda x: x.get("published_at") or MIN_DATETIME, reverse=True)
            papers = papers[:10]

            async with async_session_factory() as session:
                repo = PaperRepository(session)
                for p in papers: 
                    p["topic"] = topic
                inserted = await repo.bulk_upsert(papers)
                if inserted > 0:
                    logger.info(f"[{source_name.upper()}] Added {inserted} new papers for '{topic}'")
                else:
                    logger.info(f"[{source_name.upper()}] Found {len(papers)} papers for '{topic}' (all duplicates, skipped)")
            
            return True
            
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "403" in err_str or "503" in err_str:
                logger.warning(f"Ingestion for source '{source_name}' returned retriable/blocking error: {e}. Recording failure.")
                await rate_governor.record_failure(source_name)
            else:
                logger.error(f"Error in generic ingestion ({source_name}): {e}")
                # Treat unexpected status/failures as circuit breaker signals as well
                await rate_governor.record_failure(source_name)
            return False
