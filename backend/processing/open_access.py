"""
MEDICA Open Access Paper Ingestion & Processing
Crawls, parses, extracts, indexes, and stores full-text Open Access clinical publications.
"""
from __future__ import annotations

import json
import re
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
from uuid import uuid4
from datetime import datetime

import httpx
from bs4 import BeautifulSoup

from core.config import settings, DataSource
from core.logging import get_logger
from core.llm import LLMFactory
from core.types import (
    PaperMetadata,
    PaperTags,
    EvidenceLevel,
    StudyType,
    VerificationStatus,
)
from indexing.metadata import MetadataIndex
from indexing.vector import VectorIndex
from shared.models import ClaimRecord
from shared.database import get_session

logger = get_logger(__name__)


def clean_html_body(html_content: str) -> str:
    """Strips advertising scripts, navbars, and compiles main text content."""
    soup = BeautifulSoup(html_content, "html.parser")
    # Decompose non-body segments
    for script_or_style in soup(["script", "style", "nav", "header", "footer", "aside", "noscript", "iframe"]):
        script_or_style.decompose()
    
    # Extract clean paragraph text
    text_blocks = []
    for p in soup.find_all(["p", "h1", "h2", "h3", "h4", "div"]):
        txt = p.get_text().strip()
        if txt and len(txt) > 20:  # ignore small labels
            text_blocks.append(txt)
            
    return "\n\n".join(text_blocks[:200])  # limit to top blocks for context safety


class OpenAccessProcessor:
    """Handles parsing, structured metadata extraction, and active pgvector indexing for Open Access articles."""

    def __init__(self) -> None:
        self.metadata_index = MetadataIndex()
        self.vector_index = VectorIndex()

    async def ingest_paper(self, url_or_doi: str) -> Dict[str, Any]:
        """
        Ingests a paper by DOI or web URL.
        Fetches full-text, extracts clinical details, updates DB, generates vectors,
        and saves clinical markdown file to the filesystem.
        """
        logger.info("oa_ingestion_start", target=url_or_doi)
        
        # 1. Resolve DOI/URL
        url = url_or_doi
        if url_or_doi.startswith("10.") or url_or_doi.startswith("doi:") or (not url_or_doi.startswith("http") and "/" in url_or_doi):
            # Looks like a direct DOI - resolve using standard DOI resolver proxy
            clean_doi = url_or_doi.replace("doi:", "").strip()
            url = f"https://doi.org/{clean_doi}"

        # 2. Fetch full-text HTML
        html_content = ""
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MEDICA/1.0"}
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            html_content = resp.text

        # 3. Clean raw text
        cleaned_text = clean_html_body(html_content)
        if not cleaned_text:
            raise ValueError("Could not extract legible body text from page.")

        # 4. Extract structured details using swappable LLM Factory
        extraction_prompt = f"""You are an expert Oncology clinical data extraction assistant.
Below is the parsed content of an Open Access clinical paper fetched from: {url}

{cleaned_text[:12000]}

Extract the clinical metadata, trial details, and active scientific claims as a JSON object matching this schema.
You MUST output a VALID JSON block ONLY. Do not write introductory or concluding text.

JSON Schema:
{{
  "title": "Official paper title",
  "pmid": "PubMed PMID string if found (otherwise null)",
  "doi": "DOI string if found (otherwise null)",
  "journal": "Full name of the medical journal",
  "authors": ["Author name 1", "Author name 2"],
  "abstract": "Consolidated summary or brief abstract of the study",
  "published_year": 2024,
  "sample_size": 150 (trial patient count as integer, or null if observational/general review),
  "biomarkers": ["EGFR", "HER2", "BRCA1"],
  "evidence_level": "randomized_controlled_trial" (rct | meta_analysis | cohort_study | case_series | preclinical | unknown),
  "study_type": "clinical_trial" (clinical_trial | meta_analysis | systematic_review | observational | preclinical | review | other),
  "claims": ["Extracted clinical outcome claim sentence 1", "Claim sentence 2"],
  "keywords": ["biomarker names", "cancer types", "treatment agents"]
}}
"""
        client = LLMFactory.get_client()
        raw_json_str = await client.generate(
            messages=[{"role": "user", "content": extraction_prompt}],
            temperature=0.0,
            max_tokens=2500,
        )

        # Sanitize JSON string from any markdown formatting
        cleaned_json = re.sub(r"^```json\s*|\s*```$", "", raw_json_str.strip(), flags=re.MULTILINE)
        extracted = json.loads(cleaned_json)

        # 5. Populate and normalize schemas
        paper_id = uuid4()
        pmid = extracted.get("pmid")
        doi = extracted.get("doi") or (clean_doi if "clean_doi" in locals() else None)
        
        # Translate evidence & study types
        raw_ev = extracted.get("evidence_level", "unknown").lower()
        ev_map = {
            "rct": EvidenceLevel.RCT,
            "randomized_controlled_trial": EvidenceLevel.RCT,
            "meta_analysis": EvidenceLevel.META_ANALYSIS,
            "systematic_review": EvidenceLevel.SYSTEMATIC_REVIEW,
            "cohort_study": EvidenceLevel.COHORT,
            "case_series": EvidenceLevel.CASE_SERIES,
            "preclinical": EvidenceLevel.PRECLINICAL,
        }
        evidence_level = ev_map.get(raw_ev, EvidenceLevel.UNKNOWN)

        raw_st = extracted.get("study_type", "other").lower()
        st_map = {
            "clinical_trial": StudyType.CLINICAL_TRIAL,
            "meta_analysis": StudyType.META_ANALYSIS,
            "systematic_review": StudyType.SYSTEMATIC_REVIEW,
            "observational": StudyType.OBSERVATIONAL,
            "preclinical": StudyType.PRECLINICAL,
            "review": StudyType.REVIEW,
        }
        study_type = st_map.get(raw_st, StudyType.OTHER)

        published_date = None
        if extracted.get("published_year"):
            try:
                published_date = datetime(int(extracted["published_year"]), 1, 1)
            except ValueError:
                pass

        tags = PaperTags(
            cancer=extracted.get("keywords", []),
            treatment=extracted.get("keywords", []),
            biomarkers=extracted.get("biomarkers", []),
            drugs=extracted.get("biomarkers", []),
            evidence=[evidence_level.value],
            study_type=[study_type.value],
        )

        knowledge_filename = f"oa_paper_{paper_id}.md"
        knowledge_relative_path = f"general/papers/{knowledge_filename}"
        
        # Resolve full knowledge save path
        knowledge_dir = settings.knowledge_base_path / "general" / "papers"
        os.makedirs(knowledge_dir, exist_ok=True)
        knowledge_path = knowledge_dir / knowledge_filename

        paper = PaperMetadata(
            id=paper_id,
            title=extracted.get("title", "Ingested Open Access Paper"),
            pmid=pmid,
            doi=doi,
            journal=extracted.get("journal"),
            published=published_date,
            authors=extracted.get("authors", []),
            source=DataSource.MANUAL,
            verification_status=VerificationStatus.VERIFIED,
            confidence_score=0.90,
            evidence_level=evidence_level,
            study_type=study_type,
            tags=tags,
            keywords=extracted.get("keywords", []),
            abstract=extracted.get("abstract"),
            knowledge_path=str(knowledge_relative_path),
        )

        # Attach extended properties added in Milestone 2
        setattr(paper, "sample_size", extracted.get("sample_size"))
        setattr(paper, "biomarkers", extracted.get("biomarkers", []))
        setattr(paper, "is_open_access", True)

        # 6. Save Markdown clinical profile to local knowledge directory
        md_content = f"""---
title: "{paper.title}"
authors: {json.dumps(paper.authors)}
journal: "{paper.journal}"
published: "{paper.published.isoformat() if paper.published else ''}"
pmid: "{paper.pmid or ''}"
doi: "{paper.doi or ''}"
source: "{paper.source.value}"
evidence_level: "{paper.evidence_level.value}"
study_type: "{paper.study_type.value}"
sample_size: {getattr(paper, 'sample_size', 'null')}
biomarkers: {json.dumps(getattr(paper, 'biomarkers', []))}
is_open_access: true
---

# {paper.title}

## Abstract
{paper.abstract or "No abstract details available."}

## Extracted Scientific Claims
"""
        for i, claim in enumerate(extracted.get("claims", []), 1):
            md_content += f"{i}. **Claim**: {claim}\n"

        with open(knowledge_path, "w", encoding="utf-8") as f:
            f.write(md_content)

        # 7. Write to PostgreSQL DB
        await self.metadata_index.upsert_paper(paper)

        # Populate structured claims in Database
        async with get_session() as session:
            for claim_text in extracted.get("claims", []):
                claim_rec = ClaimRecord(
                    paper_id=paper_id,
                    claim_text=claim_text,
                    evidence_level=evidence_level.value,
                    confidence=0.85,
                    verified=True,
                )
                session.add(claim_rec)
            await session.commit()

        # 8. Index paper in pgvector
        await self.vector_index.index_paper(paper)

        logger.info(
            "oa_ingestion_success",
            paper_id=str(paper_id),
            title=paper.title,
            claims_count=len(extracted.get("claims", []))
        )

        return {
            "status": "success",
            "paper_id": str(paper_id),
            "title": paper.title,
            "abstract": paper.abstract,
            "claims_count": len(extracted.get("claims", [])),
            "biomarkers": extracted.get("biomarkers", []),
            "sample_size": extracted.get("sample_size"),
            "knowledge_path": str(knowledge_relative_path),
        }
