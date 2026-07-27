"""
MEDICA Agent Tools Registry
Exposes core platform capabilities as tools for the ReAct Research Agent.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select

from core.config import settings, LLMProvider
from core.logging import get_logger
from core.types import PaperMetadata, RawPaper, SearchQuery, DataSource
from ingestion.pubmed import PubMedAdapter
from ingestion.pipeline import IngestionPipeline
from processing.normalizer import Normalizer
from processing.tagger import Tagger
from processing.linker import EntityLinker
from verification.multi_layer_verifier import MultiLayerVerifier
from verification.scorer import EvidenceScorer
from knowledge.store import KnowledgeStore
from indexing.vector import VectorIndex
from indexing.metadata import MetadataIndex
from retrieval.engine import RetrievalEngine
from shared.database import get_session
from shared.models import PaperRecord, ClaimRecord

logger = get_logger(__name__)

# Initialize singletons for agent tools
_pubmed_adapter = PubMedAdapter()
_normalizer = Normalizer()
_tagger = Tagger()
_linker = EntityLinker()
_verifier = MultiLayerVerifier()
_knowledge_store = KnowledgeStore()
_vector_index = VectorIndex()
_metadata_index = MetadataIndex()
_retrieval_engine = RetrievalEngine()
_scorer = EvidenceScorer()


async def search_pubmed(query: str, limit: int = 5) -> str:
    """
    Search PubMed for active research papers matching the query and ingest them
    into MEDICA's knowledge base.

    Args:
        query: Scientific search query (e.g. "osimertinib EGFR resistance lung cancer")
        limit: Maximum number of papers to ingest and return (default: 5, max: 10)

    Returns:
        A formatted text summary of the ingested papers and pipeline execution statistics.
    """
    limit = min(max(1, limit), 10)
    logger.info("agent_tool_search_pubmed", query=query, limit=limit)

    pipeline = IngestionPipeline(
        adapter=_pubmed_adapter,
        normalizer=_normalizer,
        tagger=_tagger,
        linker=_linker,
        verifier=_verifier,
        knowledge_store=_knowledge_store,
        vector_index=_vector_index,
        metadata_index=_metadata_index,
    )

    try:
        # Run pipeline to actively ingest matching oncology research
        stats = await pipeline.run(query, max_results=limit, resume=False)

        # Retrieve the newly indexed papers from the database to present to the agent
        async with get_session() as session:
            result = await session.execute(
                select(PaperRecord)
                .where(PaperRecord.source == "pubmed")
                .order_by(PaperRecord.created_at.desc())
                .limit(limit)
            )
            records = result.scalars().all()

        if not records:
            return f"PubMed search complete. No new papers were ingested. (Pipeline Stats: {stats.fetched} fetched, {stats.indexed} indexed)"

        summary_parts = [
            f"### Ingested {len(records)} papers from PubMed for query: '{query}'\n",
            f"**Pipeline Statistics**: Fetched {stats.fetched}, Indexed {stats.indexed}, Duplicates skipped {stats.duplicates_skipped}, Failed {stats.failed}\n",
        ]

        for i, r in enumerate(records, 1):
            authors_str = ", ".join(r.authors[:3]) if r.authors else "Unknown"
            if len(r.authors) > 3:
                authors_str += " et al."
            published_str = r.published.strftime("%Y-%m-%d") if r.published else "Unknown"

            summary_parts.append(
                f"{i}. **{r.title}**\n"
                f"   - **PMID**: {r.pmid} | **Journal**: {r.journal} ({published_str})\n"
                f"   - **Authors**: {authors_str}\n"
                f"   - **Evidence Level**: {r.evidence_level} | **Status**: {r.verification_status.upper()}\n"
                f"   - **Confidence Score**: {r.confidence_score:.2f}\n"
                f"   - **Cancers**: {', '.join(r.tags.get('cancer', [])) if r.tags else 'None'}\n"
                f"   - **Drugs**: {', '.join(r.tags.get('drugs', [])) if r.tags else 'None'}\n"
                f"   - **Biomarkers**: {', '.join(r.tags.get('biomarkers', [])) if r.tags else 'None'}\n"
                f"   - **Abstract Snippet**: {r.abstract[:200] if r.abstract else 'No abstract available'}...\n"
            )

        return "\n".join(summary_parts)

    except Exception as e:
        logger.error("tool_search_pubmed_error", query=query, error=str(e))
        return f"Error executing PubMed search/ingestion pipeline: {str(e)}"


async def retrieve_papers(query: str, limit: int = 5, strategy: str = "hybrid") -> str:
    """
    Search the local MEDICA knowledge base using semantic, keyword, or tag-based retrieval.

    Args:
        query: Query string describing what clinical or molecular data to retrieve
        limit: Maximum number of papers to return (default: 5)
        strategy: Retrieval strategy - "hybrid" (default), "semantic", "keyword", "tag", "temporal"

    Returns:
        A structured string summarizing the most relevant local papers, evidence levels, and abstracts.
    """
    logger.info("agent_tool_retrieve_papers", query=query, limit=limit, strategy=strategy)
    try:
        search_q = SearchQuery(
            query=query,
            limit=limit,
            strategy=strategy,
        )
        results = await _retrieval_engine.search(search_q)

        if not results:
            return f"No papers found in local knowledge base matching: '{query}' (Strategy: {strategy})."

        summary_parts = [f"### Retrieved {len(results)} relevant papers matching: '{query}'\n"]

        for i, res in enumerate(results, 1):
            p = res.paper
            authors_str = ", ".join(p.authors[:3]) if p.authors else "Unknown"
            if len(p.authors) > 3:
                authors_str += " et al."
            published_str = p.published.strftime("%Y-%m-%d") if p.published else "Unknown"

            summary_parts.append(
                f"{i}. **{p.title}**\n"
                f"   - **Paper ID**: `{p.id}` | **PMID**: {p.pmid or 'N/A'}\n"
                f"   - **Journal**: {p.journal} ({published_str})\n"
                f"   - **Authors**: {authors_str}\n"
                f"   - **Evidence Level**: {p.evidence_level.value} | **Status**: {p.verification_status.value.upper()}\n"
                f"   - **Relevance / Rerank Score**: {res.score:.3f} | **Confidence**: {p.confidence_score:.2f}\n"
                f"   - **Cancer Tags**: {', '.join(p.tags.cancer) if p.tags else 'None'}\n"
                f"   - **Drug Tags**: {', '.join(p.tags.drugs) if p.tags else 'None'}\n"
                f"   - **Biomarker Tags**: {', '.join(p.tags.biomarkers) if p.tags else 'None'}\n"
                f"   - **Abstract**: {p.abstract or 'No abstract available.'}\n"
            )

        return "\n".join(summary_parts)

    except Exception as e:
        logger.error("tool_retrieve_papers_error", query=query, error=str(e))
        return f"Error querying local retrieval engine: {str(e)}"


async def read_knowledge_file(filepath: str) -> str:
    """
    Read the structured markdown content of a file in the cancers directory.

    Args:
        filepath: Relative path (e.g. "cancers/breast_cancer/papers/pmid_38291032.md")
                  or absolute path of the knowledge file.

    Returns:
        The markdown contents of the file, including extracted claims and adversarial reviews.
    """
    logger.info("agent_tool_read_knowledge_file", filepath=filepath)
    try:
        path = Path(filepath)
        if not path.is_absolute():
            path = Path(settings.knowledge_base_path) / path

        if not path.exists():
            return f"Error: Knowledge file not found at path: {filepath}"

        res = await _knowledge_store.read(path)
        if not res:
            return f"Error: Could not parse knowledge file at path: {filepath}"

        frontmatter, body = res

        # Format nicely for the agent
        yaml_lines = [f"{k}: {v}" for k, v in frontmatter.items() if k not in ["abstract"]]
        frontmatter_str = "\n".join(yaml_lines)

        return (
            f"### Knowledge File: {path.name}\n"
            f"```yaml\n"
            f"{frontmatter_str}\n"
            f"```\n\n"
            f"{body}"
        )

    except Exception as e:
        logger.error("tool_read_knowledge_file_error", filepath=filepath, error=str(e))
        return f"Error reading knowledge file: {str(e)}"


async def verify_claim(claim: str) -> str:
    """
    Evaluate a scientific oncology claim against the evidence in the local database.
    Performs vector lookup to fetch relevant papers and analyzes their alignment with the claim.

    Args:
        claim: Scientific claim to verify (e.g., "Osimertinib combined with chemotherapy improves PFS in EGFR-mutant NSCLC")

    Returns:
        A structured verification report showing confirming papers, contradicting papers,
        an aggregate confidence score, and qualitative alignment summary.
    """
    logger.info("agent_tool_verify_claim", claim=claim)
    try:
        # 1. Search semantic indexes for relevant evidence
        search_q = SearchQuery(
            query=claim,
            limit=4,
            strategy="semantic",
        )
        results = await _retrieval_engine.search(search_q)

        if not results:
            return f"### Verification Report for Claim:\n> \"{claim}\"\n\n**Status**: UNVERIFIED\n**Reason**: No relevant evidence found in the local knowledge base. Please run a `search_pubmed` first to ingest relevant trials."

        # 2. Analyze alignment using LLM or local rules
        alignment_report = []
        confirming = []
        contradicting = []
        neutral = []

        total_weight = 0.0
        weighted_score = 0.0

        llm_available = bool(settings.active_llm_key)

        for res in results:
            p = res.paper
            abstract = p.abstract or ""
            evidence_weight = _scorer.score(p)

            # Evaluate alignment
            alignment = "neutral"
            reason = "Mentions entities but abstract is inconclusive."

            if llm_available:
                # LLM Claim analysis
                prompt = (
                    f"You are a rigorous clinical oncology evaluator.\n"
                    f"Evaluate if the following scientific paper supports, contradicts, or is neutral to this claim:\n"
                    f"Claim: \"{claim}\"\n\n"
                    f"Paper:\n"
                    f"Title: {p.title}\n"
                    f"Abstract: {abstract[:1200]}\n\n"
                    f"Output EXACTLY in this format:\n"
                    f"ALIGNMENT: <SUPPORT | CONTRADICT | NEUTRAL>\n"
                    f"EXPLANATION: <1-2 sentences explaining why based on p-values, endpoints, or sample size>"
                )

                try:
                    analysis_text = ""
                    if settings.llm_provider == LLMProvider.GEMINI:
                        import google.generativeai as genai
                        genai.configure(api_key=settings.gemini_api_key)
                        model = genai.GenerativeModel(settings.gemini_model)
                        response = model.generate_content(prompt)
                        analysis_text = response.text.strip()
                    elif settings.llm_provider == LLMProvider.OPENAI:
                        from openai import AsyncOpenAI
                        client = AsyncOpenAI(api_key=settings.openai_api_key)
                        response = await client.chat.completions.create(
                            model=settings.openai_model,
                            messages=[{"role": "user", "content": prompt}],
                            max_tokens=150,
                        )
                        analysis_text = response.choices[0].message.content.strip()
                    elif settings.llm_provider == LLMProvider.ANTHROPIC:
                        import anthropic
                        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
                        response = client.messages.create(
                            model=settings.anthropic_model,
                            max_tokens=150,
                            messages=[{"role": "user", "content": prompt}],
                        )
                        analysis_text = response.content[0].text.strip()

                    # Parse output
                    if "ALIGNMENT: SUPPORT" in analysis_text:
                        alignment = "support"
                    elif "ALIGNMENT: CONTRADICT" in analysis_text:
                        alignment = "contradict"

                    exp_idx = analysis_text.find("EXPLANATION:")
                    if exp_idx != -1:
                        reason = analysis_text[exp_idx + len("EXPLANATION:"):].strip()
                    else:
                        reason = analysis_text.strip()
                except Exception as e:
                    logger.warning("tool_verify_claim_llm_failed", error=str(e))
                    # Fallback to simple rule
                    if p.evidence_level.value in ["meta_analysis", "systematic_review", "rct"]:
                        alignment = "support"
                        reason = f"Highly rated study (Evidence Level: {p.evidence_level.value}) matches query terms."
            else:
                # Rule-based simple fallback
                if p.evidence_level.value in ["meta_analysis", "systematic_review", "rct"]:
                    alignment = "support"
                    reason = f"Highly rated study (Evidence Level: {p.evidence_level.value}) matches query terms."

            # Categorize
            study_info = f"- **{p.title}** (PMID: {p.pmid or 'N/A'}, Level: {p.evidence_level.value})\n  *Analysis*: {reason}"
            if alignment == "support":
                confirming.append(study_info)
                weighted_score += 1.0 * evidence_weight
            elif alignment == "contradict":
                contradicting.append(study_info)
                weighted_score -= 1.0 * evidence_weight
            else:
                neutral.append(study_info)
                weighted_score += 0.0

            total_weight += evidence_weight

        # 3. Calculate Aggregate Confidence Status
        avg_alignment_score = (weighted_score / total_weight) if total_weight > 0 else 0.0

        if avg_alignment_score >= 0.40:
            status = "SUPPORTED BY EVIDENCE"
        elif avg_alignment_score <= -0.40:
            status = "CONTRADICTED BY EVIDENCE"
        elif len(contradicting) > 0 and len(confirming) > 0:
            status = "DISPUTED / CONFLICTING EVIDENCE"
        else:
            status = "NEUTRAL / INCONCLUSIVE EVIDENCE"

        report = [
            f"### Claim Verification Report\n",
            f"> **Claim**: \"{claim}\"\n",
            f"- **Status**: **{status}**",
            f"- **Aggregate Alignment Score**: `{avg_alignment_score:.2f}` (Range: -1.0 to +1.0)",
            f"- **Total Evidence Weight Evaluated**: `{total_weight:.2f}`\n",
            f"#### Confirming Evidence ({len(confirming)} studies):"
        ]

        if confirming:
            report.extend(confirming)
        else:
            report.append("  *No confirming studies found.*")

        report.append("\n#### Contradicting Evidence ({len(contradicting)} studies):")
        if contradicting:
            report.extend(contradicting)
        else:
            report.append("  *No contradicting studies found.*")

        report.append("\n#### Neutral / Secondary Mentions ({len(neutral)} studies):")
        if neutral:
            report.extend(neutral)
        else:
            report.append("  *No neutral studies found.*")

        return "\n".join(report)

    except Exception as e:
        logger.error("tool_verify_claim_error", claim=claim, error=str(e))
        return f"Error executing claim verification: {str(e)}"


async def get_citations(pmid: str) -> str:
    """
    Retrieve clinical papers that cite or are co-cited with a specific PMID.

    Args:
        pmid: The PubMed ID of the source paper (e.g. "38123456")

    Returns:
        A list of PMIDs and titles of citing papers or related papers in the network.
    """
    logger.info("agent_tool_get_citations", pmid=pmid)
    try:
        citing_pmids = await _pubmed_adapter.fetch_citations(pmid)

        if not citing_pmids:
            return f"No citation network findings for PMID: {pmid} on PubMed. ( एनसीबी Link returned no citing IDs)."

        # Try to look up any of these PMIDs in our local metadata index to get nice titles
        async with get_session() as session:
            result = await session.execute(
                select(PaperRecord).where(PaperRecord.pmid.in_(citing_pmids[:10]))
            )
            local_matches = result.scalars().all()

        local_dict = {r.pmid: r.title for r in local_matches}

        report = [
            f"### Citation Network for PMID: {pmid}\n",
            f"Found {len(citing_pmids)} citing articles on PubMed. Showing top references:\n"
        ]

        for i, c_pmid in enumerate(citing_pmids[:15], 1):
            title = local_dict.get(c_pmid, "Clinical study on PubMed (Title not locally indexed)")
            report.append(f"{i}. **PMID {c_pmid}**: {title} (https://pubmed.ncbi.nlm.nih.gov/{c_pmid}/)")

        return "\n".join(report)

    except Exception as e:
        logger.error("tool_get_citations_error", pmid=pmid, error=str(e))
        return f"Error fetching citation network: {str(e)}"
