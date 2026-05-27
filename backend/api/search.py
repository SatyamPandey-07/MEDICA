"""
MEDICA Search and Knowledge API Endpoints
Exposes hybrid searches, paper records, and structured markdown knowledge data.
"""
from __future__ import annotations

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import get_logger
from core.types import SearchQuery, PaperMetadata
from retrieval.engine import RetrievalEngine
from knowledge.store import KnowledgeStore
from knowledge.graph import graph as kg_graph
from shared.database import get_db

logger = get_logger(__name__)
router = APIRouter(tags=["search_knowledge"])

# Singletons
_retrieval_engine = RetrievalEngine()
_knowledge_store = KnowledgeStore()


@router.get("/search")
async def search_endpoint(
    q: str = Query(..., description="Search query terms"),
    limit: int = Query(10, ge=1, le=50, description="Max results"),
    strategy: str = Query("hybrid", description="Strategy: hybrid, semantic, keyword, tag, temporal"),
):
    """Hybrid search across semantic vector, keyword, and tag databases."""
    logger.info("api_search", query=q, strategy=strategy, limit=limit)
    try:
        search_q = SearchQuery(
            query=q,
            limit=limit,
            strategy=strategy,
        )
        results = await _retrieval_engine.search(search_q)

        return [
            {
                "score": r.score,
                "strategy": r.strategy,
                "paper": r.paper.model_dump(),
            }
            for r in results
        ]
    except Exception as e:
        logger.error("api_search_error", query=q, error=str(e))
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/papers/{paper_id}")
async def get_paper_detail(paper_id: str):
    """Retrieve full details of a specific paper record by UUID or PMID."""
    paper = None
    
    # Try parsing as UUID
    try:
        uuid_val = UUID(paper_id)
        logger.info("api_get_paper_by_uuid", paper_id=paper_id)
        paper = await _retrieval_engine.get_paper(uuid_val)
    except ValueError:
        # Not a UUID, try lookup by PMID or DOI slug
        pmid = paper_id
        if pmid.startswith("pmid_"):
            pmid = pmid[5:]
        elif pmid.startswith("doi_"):
            pmid = pmid[4:]
            
        logger.info("api_get_paper_by_pmid_or_doi_fallback", paper_id=paper_id, slug=pmid)
        record = await _retrieval_engine.metadata_index.get_by_pmid(pmid)
        if record:
            from retrieval.engine import _record_to_metadata
            paper = _record_to_metadata(record)

    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    return paper.model_dump()


@router.get("/knowledge/cancer-types")
async def list_cancer_types():
    """List all registered oncology cancer categories."""
    return _knowledge_store.list_cancer_types()


@router.get("/knowledge/papers")
async def list_knowledge_papers(
    cancer_type: Optional[str] = Query(None, description="Filter by cancer type")
):
    """List all papers stored in the markdown knowledge directory, parsing frontmatter."""
    logger.info("api_list_knowledge_papers", cancer_type=cancer_type)
    paper_files = _knowledge_store.list_papers(cancer_type)

    # Get UUID mappings from DB to enrich missing IDs
    try:
        pmid_to_id, doi_to_id = await _retrieval_engine.metadata_index.get_id_mappings()
    except Exception as e:
        logger.warning("api_failed_getting_id_mappings_from_db", error=str(e))
        pmid_to_id, doi_to_id = {}, {}

    from uuid import uuid5, NAMESPACE_DNS

    results = []
    for file_path in paper_files:
        try:
            res = await _knowledge_store.read(file_path)
            if res:
                frontmatter, _ = res
                # Return path relative to base directory
                rel_path = file_path.relative_to(_knowledge_store.base)
                frontmatter["relative_path"] = str(rel_path).replace("\\", "/")
                
                # Enrich id if missing
                if "id" not in frontmatter or not frontmatter["id"]:
                    pmid = frontmatter.get("pmid")
                    doi = frontmatter.get("doi")
                    
                    if pmid and str(pmid) in pmid_to_id:
                        frontmatter["id"] = pmid_to_id[str(pmid)]
                    elif doi and str(doi) in doi_to_id:
                        frontmatter["id"] = doi_to_id[str(doi)]
                    else:
                        # Fallback to a stable deterministic UUID
                        stable_key = f"medica:{pmid or doi or frontmatter.get('title') or rel_path.name}"
                        frontmatter["id"] = str(uuid5(NAMESPACE_DNS, stable_key))
                
                results.append(frontmatter)
        except Exception as e:
            logger.warning("api_failed_reading_knowledge_file", path=str(file_path), error=str(e))

    # Sort by ingested/published date
    results.sort(key=lambda x: x.get("updated_at") or x.get("ingested_at") or "", reverse=True)
    return results


@router.get("/knowledge/graph/stats")
async def get_graph_stats():
    """Retrieve oncology knowledge graph node and edge counts."""
    return kg_graph.stats()


@router.get("/knowledge/graph")
async def get_graph_network():
    """Retrieve the complete network graph nodes and edges for visualization."""
    nodes = []
    for key, node in kg_graph.nodes.items():
        nodes.append({
            "id": key,
            "label": node.name,
            "type": node.entity_type,
            "papers_count": len(node.paper_ids),
        })

    edges = []
    seen_edges = set()
    for source, targets in kg_graph.edges.items():
        for target in targets:
            # Avoid repeating undirected edges
            pair = tuple(sorted([source, target]))
            if pair not in seen_edges:
                seen_edges.add(pair)
                edges.append({
                    "source": source,
                    "target": target,
                })

    return {
        "nodes": nodes,
        "edges": edges,
    }
