"""
MEDICA Direct Ingestion & RAG Agent Verification Script
Runs end-to-end verification of the PubMed Ingestion agent (with query expansion)
and the Oncology Research RAG agent (with the ReAct reasoning loop).
"""
import sys
import os
import asyncio

# Add backend directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from core.config import settings
from core.llm import LLMFactory
from ingestion.pubmed import PubMedAdapter
from ingestion.pipeline import IngestionPipeline
from processing.normalizer import Normalizer
from processing.tagger import Tagger
from processing.linker import EntityLinker
from verification.adversarial import AdversarialVerifier
from knowledge.store import KnowledgeStore
from indexing.vector import VectorIndex
from indexing.metadata import MetadataIndex
from agents.research_agent import OncologyResearchAgent
from shared.database import init_db

async def run_verification():
    print("=== MEDICA Direct Verification Starting ===")
    
    # Ensure database schema is initialized
    print("\n1. Initializing database schema...")
    await init_db()
    print("✔ Database schema initialized.")

    # Test Query Expansion on PubMed Adapter
    print("\n2. Testing PubMed Adapter query expansion...")
    adapter = PubMedAdapter()
    
    # Force settings check
    print(f"Active LLM Provider: {settings.llm_provider.value}")
    print(f"Active LLM Model: {settings.active_llm_model}")
    print(f"Has LLM Key: {bool(settings.active_llm_key)}")
    
    expanded = await adapter._expand_query("osimertinib")
    print(f"Expanded keywords for 'osimertinib': {expanded}")
    assert len(expanded) > 1, "Expected query expansion to yield multiple terms"
    assert "osimertinib" in expanded, "Expected original query to be included in expanded list"
    print("✔ Query expansion verification: PASS")

    # Run Ingestion Pipeline end-to-end
    print("\n3. Running end-to-end Ingestion Pipeline (limit 2 papers)...")
    normalizer = Normalizer()
    tagger = Tagger()
    linker = EntityLinker()
    verifier = AdversarialVerifier()
    store = KnowledgeStore()
    vector = VectorIndex()
    metadata = MetadataIndex()

    pipeline = IngestionPipeline(
        adapter=adapter,
        normalizer=normalizer,
        tagger=tagger,
        linker=linker,
        verifier=verifier,
        knowledge_store=store,
        vector_index=vector,
        metadata_index=metadata,
    )

    stats = await pipeline.run("osimertinib", max_results=2, resume=False)
    print(f"Pipeline run completed. Stats: {stats.model_dump()}")
    assert stats.fetched > 0, "Expected to fetch at least 1 paper"
    assert stats.indexed > 0, "Expected to index at least 1 paper"
    print("✔ Ingestion pipeline verification: PASS")

    # Run Oncology Research RAG Agent ReAct loop
    print("\n4. Testing Oncology Research Agent ReAct loop...")
    agent = OncologyResearchAgent(max_steps=5)
    
    query = "Is osimertinib effective for EGFR-mutated lung cancer?"
    print(f"Query: '{query}'")
    print("--- ReAct Loop Output ---")
    
    async for chunk in agent.run(query):
        # Print tokens or reasoning segments as they stream
        sys.stdout.write(chunk)
        sys.stdout.flush()
    print("\n-------------------------")
    print("✔ RAG Agent ReAct loop verification: PASS")
    
    # Close resources
    await adapter.close()
    print("\n=== ALL DIRECT VERIFICATIONS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(run_verification())
