"""
MEDICA Advanced Evidence-Weighted Reranker
Re-scores retrieval results using high-precision oncology and trial-focused math logic.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional

from core.types import EvidenceLevel, RetrievalResult, SearchQuery, VerificationStatus

# Target oncology molecular biomarkers to boost matching queries
_ONCOLOGY_BIOMARKERS = {
    "egfr", "kras", "brca", "brca1", "brca2", "alk", "her2", "ros1", "braf", 
    "pik3ca", "idh1", "idh2", "fgfr", "ret", "ntrk", "met", "tp53", "kras g12c", 
    "egfr t790m", "pd-l1", "pdl1", "msi-h", "msi", "dmmr", "tmb", "hrd"
}

# Evidence level weights for reranking
_EVIDENCE_WEIGHTS: dict[EvidenceLevel, float] = {
    EvidenceLevel.META_ANALYSIS: 1.0,
    EvidenceLevel.SYSTEMATIC_REVIEW: 0.95,
    EvidenceLevel.RCT: 0.88,
    EvidenceLevel.COHORT: 0.72,
    EvidenceLevel.CASE_CONTROL: 0.65,
    EvidenceLevel.CASE_SERIES: 0.50,
    EvidenceLevel.EXPERT_OPINION: 0.35,
    EvidenceLevel.PRECLINICAL: 0.25,
    EvidenceLevel.UNKNOWN: 0.20,
}

# Verification status multipliers - strict penalty for retracted and disputed work
_STATUS_MULTIPLIERS: dict[VerificationStatus, float] = {
    VerificationStatus.VERIFIED: 1.05,  # slight bonus for verified consensus
    VerificationStatus.UNVERIFIED: 0.85,
    VerificationStatus.PENDING: 0.75,
    VerificationStatus.DISPUTED: 0.40,
    VerificationStatus.RETRACTED: 0.02,  # massive penalty
}


class EvidenceReranker:
    """
    Advanced evidence-weighted reranker for precision oncology.

    Re-scores papers dynamically based on:
      1. RRF/Lexical score match base.
      2. Clinical Evidence level (meta-analysis > RCT > preclinical).
      3. Safety/Verification status (verified consensus vs retracted/disputed works).
      4. Trial Patient Cohort Sample Size (log scale boost up to n=1000).
      5. Logarithmic Citation Density (smooth citation scaling up to 500).
      6. Molecular Biomarker Alignment Boost (+0.15 if a query biomarker matches paper text).
      7. Recency Decays (papers within 3 years get a higher weight).
    """

    def _recency_score(self, published: Optional[datetime]) -> float:
        """Score recency: 1.0 for current year, decays smoothly over 10+ years."""
        if published is None:
            return 0.5
        now = datetime.now(timezone.utc)
        pub = published.replace(tzinfo=timezone.utc) if published.tzinfo is None else published
        years_old = (now - pub).days / 365.25
        if years_old <= 1:
            return 1.0
        elif years_old <= 3:
            return 0.92
        elif years_old <= 5:
            return 0.80
        elif years_old <= 10:
            return 0.65
        else:
            return 0.35

    def _citation_score(self, citation_count: int) -> float:
        """Normalize citation count using a smooth log scale."""
        # Max out citation boost normalization at 500
        return 0.08 * min(1.0, math.log1p(citation_count) / math.log1p(500))

    def _sample_size_boost(self, sample_size: Optional[int]) -> float:
        """Calculate cohort trial size boost using log scale (max at n=1000)."""
        if not sample_size:
            return 0.0
        # Boost up to 0.07 for large randomized phase 3 trials
        return 0.07 * min(1.0, math.log1p(sample_size) / math.log1p(1000))

    def _biomarker_boost(
        self,
        query_text: str,
        paper_title: str,
        paper_abstract: Optional[str],
        paper_tags_biomarkers: Optional[list[str]] = None,
    ) -> float:
        """Adds a +0.15 score boost if the query biomarker matches the paper keywords or text."""
        query_lower = query_text.lower()
        matched_biomarkers = [b for b in _ONCOLOGY_BIOMARKERS if b in query_lower]

        if not matched_biomarkers:
            return 0.0

        # Check explicit biomarker lists if present
        if paper_tags_biomarkers:
            for bm in paper_tags_biomarkers:
                if str(bm).lower() in query_lower:
                    return 0.15

        # Scan text fields
        paper_text = (paper_title + " " + (paper_abstract or "")).lower()
        for bm in matched_biomarkers:
            if bm in paper_text:
                return 0.15

        return 0.0

    def rerank(
        self, results: list[RetrievalResult], query: SearchQuery
    ) -> list[RetrievalResult]:
        """Reranks list using multi-factor evidence-based oncology scores."""
        if not results:
            return results

        # Normalize retrieval base scores to 0-1
        max_score = max(r.score for r in results) if results else 1.0
        if max_score == 0:
            max_score = 1.0

        reranked = []
        for result in results:
            paper = result.paper

            # Base lexical/semantic relevance
            base_score = result.score / max_score

            # Evidence level & verification parameters
            evidence_weight = _EVIDENCE_WEIGHTS.get(paper.evidence_level, 0.20)
            status_multiplier = _STATUS_MULTIPLIERS.get(paper.verification_status, 0.75)
            evidence_score = evidence_weight * status_multiplier

            # Log-scaled recency & citations
            recency = self._recency_score(paper.published)
            citation = self._citation_score(paper.citation_count)

            # Sample size boost
            sample_size = getattr(paper, "sample_size", None)
            sample_boost = self._sample_size_boost(sample_size)

            # Molecular biomarker boost
            # Try to grab biomarkers from paper.tags (handles both SQLAlchemy dict and Pydantic PaperTags)
            tags_biomarkers = None
            if paper.tags:
                if isinstance(paper.tags, dict):
                    tags_biomarkers = paper.tags.get("biomarkers")
                else:
                    tags_biomarkers = getattr(paper.tags, "biomarkers", None)

            biomarker_boost = self._biomarker_boost(
                query.query,
                paper.title,
                paper.abstract,
                tags_biomarkers
            )

            # Verification confidence weight
            confidence = paper.confidence_score

            # Multi-factor score formulation (maximum possible is ~1.4 - 1.5 with boosts)
            final_score = (
                base_score * 0.35                     # 35% base semantic relevance
                + evidence_score * 0.30              # 30% evidence quality
                + confidence * 0.10                  # 10% verifier confidence
                + recency * 0.05                     # 5% recency
                + citation                           # citation log boost (up to 0.08)
                + sample_boost                       # sample size boost (up to 0.07)
                + biomarker_boost                    # biomarker alignment boost (0.0 or 0.15)
            )

            reranked.append(RetrievalResult(
                paper=result.paper,
                score=round(final_score, 4),
                strategy=result.strategy,
                snippet=result.snippet,
                highlights=result.highlights,
            ))

        # Re-sort descending by the upgraded score
        return sorted(reranked, key=lambda r: r.score, reverse=True)
