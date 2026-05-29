import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import asyncio
from ingestion_agent.app.services.arxiv_service import ArXivService
from ingestion_agent.app.services.rest_services import SemanticScholarService
from ingestion_agent.app.services.rest_services_v2 import ClinicalTrialsService
from ingestion_agent.app.utils.rate_limiter import rate_governor
from ingestion_agent.app.utils.logger import logger

async def test_clinical_trials():
    logger.info("\n--- 1. Testing ClinicalTrials Resilient WAF Bypass & Diagnostics ---")
    service = ClinicalTrialsService()
    
    try:
        # First query should bypass 403 via curl fallback and populate cache
        logger.info("Executing first ClinicalTrials search for 'oncology'...")
        results = await service.search_trials("oncology", max_results=2)
        logger.info(f"ClinicalTrials Success! Found {len(results)} studies.")
        for r in results:
            logger.info(f" - [{r['external_id']}] {r['title'][:60]}...")
            
        # Second query should immediately hit cache (no network call)
        logger.info("\nExecuting second (cached) ClinicalTrials search...")
        cached_results = await service.search_trials("oncology", max_results=2)
        logger.info(f"ClinicalTrials Cache Success! Returned {len(cached_results)} cached studies.")
        
    except Exception as e:
        logger.error(f"ClinicalTrials test failed: {e}")
    finally:
        await service.close()

async def test_arxiv():
    logger.info("\n--- 2. Testing ArXiv Sequential Spacing & 503/429 Resiliency ---")
    service = ArXivService()
    
    try:
        # Run two rapid sequential queries. The second query must wait exactly 5.0 seconds
        # due to the RateGovernor pacing bucket before making the network request!
        start_time = asyncio.get_event_loop().time()
        
        logger.info("Executing first ArXiv search for 'oncology'...")
        res1 = await service.search_papers("oncology", max_results=2)
        logger.info(f"ArXiv Search 1 finished. Found {len(res1)} papers.")
        
        logger.info("Executing second ArXiv search for 'immunotherapy' (should delay to respect rate limit)...")
        res2 = await service.search_papers("immunotherapy", max_results=2)
        logger.info(f"ArXiv Search 2 finished. Found {len(res2)} papers.")
        
        elapsed = asyncio.get_event_loop().time() - start_time
        logger.info(f"Total time elapsed for two sequential queries: {elapsed:.2f}s (should be >= 5.0s pacing delay).")
        
    except Exception as e:
        logger.error(f"ArXiv test failed: {e}")
    finally:
        await service.close()

async def test_semantic_scholar():
    logger.info("\n--- 3. Testing Semantic Scholar Public Pacing ---")
    service = SemanticScholarService()
    
    try:
        logger.info("Executing SemanticScholar search for 'oncology'...")
        res = await service.search_papers("oncology", max_results=2)
        logger.info(f"SemanticScholar Success! Found {len(res)} papers.")
    except Exception as e:
        logger.error(f"Semantic Scholar test failed: {e}")
    finally:
        await service.close()

async def test_circuit_breaker():
    logger.info("\n--- 4. Testing Stateful Circuit Breaker Tripping & Cooldown ---")
    # Clean the breaker status
    breaker = rate_governor._get_breaker("mock_source")
    logger.info(f"Initial State: {breaker.state} (Consecutive failures: {breaker.failure_count})")
    
    # Record first failure
    await rate_governor.record_failure("mock_source")
    logger.info(f"After 1st failure: {breaker.state} (Consecutive failures: {breaker.failure_count})")
    
    # Record second failure -> should trip to OPEN
    await rate_governor.record_failure("mock_source")
    logger.info(f"After 2nd failure: {breaker.state} (Consecutive failures: {breaker.failure_count})")
    
    # Try requesting -> should be blocked by open circuit
    allowed = await rate_governor.acquire("mock_source", "query")
    logger.info(f"Request allowed? {allowed}")
    
    # Force state shift for half open check or clean up
    logger.info("Resetting mock circuit breaker to CLOSED...")
    await rate_governor.record_success("mock_source")
    logger.info(f"Final State: {breaker.state}")

async def main():
    logger.info("Starting Harvester Resilience Verification Suite...")
    await test_clinical_trials()
    await test_arxiv()
    await test_semantic_scholar()
    await test_circuit_breaker()
    logger.info("\nResilience Verification Suite Complete.")

if __name__ == "__main__":
    asyncio.run(main())
