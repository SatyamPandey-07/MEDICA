"""
MEDICA Evidence-Weighted Reranker
Re-scores retrieval results by evidence quality, recency, and verification status.
"""
from __future__ import annotations

from datetime import datetime, timezone

from core.types import EvidenceLevel, RetrievalResult, SearchQuery, VerificationStatus

# Evidence level weights for reranking
_EVIDENCE_WEIGHTS: dict[EvidenceLevel, float] = {
    EvidenceLevel.META_ANALYSIS: 1.0,
    EvidenceLevel.SYSTEMATIC_REVIEW: 0.92,
    EvidenceLevel.RCT: 0.85,
    EvidenceLevel.COHORT: 0.70,
    EvidenceLevel.CASE_CONTROL: 0.65,
    EvidenceLevel.CASE_SERIES: 0.50,
    EvidenceLevel.EXPERT_OPINION: 0.40,
    EvidenceLevel.PRECLINICAL: 0.30,
    EvidenceLevel.UNKNOWN: 0.25,
}

# Verification status multipliers
_STATUS_MULTIPLIERS: dict[VerificationStatus, float] = {
    VerificationStatus.VERIFIED: 1.0,
    VerificationStatus.UNVERIFIED: 0.85,
    VerificationStatus.PENDING: 0.75,
    VerificationStatus.DISPUTED: 0.50,
    VerificationStatus.RETRACTED: 0.10,
}


class EvidenceReranker:
    """
    Evidence-weighted reranker.

    Adjusts retrieval scores based on:
      1. Evidence level (meta-analysis > RCT > cohort > ...)
      2. Verification status (verified > pending > disputed)
      3. Recency (papers within 3 years get a boost)
      4. Citation count (highly cited papers get a boost)
      5. Confidence score from the verifier

    Final score = (retrieval_score * 0.5) + (evidence_score * 0.3) + (recency_score * 0.1) + (confidence * 0.1)
    """

    def _recency_score(self, published: datetime | None) -> float:
        """Score recency: 1.0 for current year, decays to 0.3 over 10+ years."""
        if published is None:
            return 0.5
        now = datetime.now(timezone.utc)
        pub = published.replace(tzinfo=timezone.utc) if published.tzinfo is None else published
        years_old = (now - pub).days / 365.25
        if years_old <= 1:
            return 1.0
        elif years_old <= 3:
            return 0.90
        elif years_old <= 5:
            return 0.80
        elif years_old <= 10:
            return 0.65
        else:
            return 0.40

    def _citation_score(self, citation_count: int) -> float:
        """Normalize citation count to 0.0–1.0."""
        if citation_count >= 1000:
            return 1.0
        elif citation_count >= 500:
            return 0.90
        elif citation_count >= 100:
            return 0.75
        elif citation_count >= 50:
            return 0.60
        elif citation_count >= 10:
            return 0.45
        elif citation_count > 0:
            return 0.30
        return 0.10

    def rerank(
        self, results: list[RetrievalResult], query: SearchQuery
    ) -> list[RetrievalResult]:
        """Rerank results using evidence-weighted scoring."""
        if not results:
            return results

        # Normalize retrieval scores to 0–1
        max_score = max(r.score for r in results) if results else 1.0
        if max_score == 0:
            max_score = 1.0

        reranked = []
        for result in results:
            paper = result.paper

            # Component scores
            retrieval_score = result.score / max_score
            evidence_weight = _EVIDENCE_WEIGHTS.get(paper.evidence_level, 0.25)
            status_mult = _STATUS_MULTIPLIERS.get(paper.verification_status, 0.75)
            recency = self._recency_score(paper.published)
            citation = self._citation_score(paper.citation_count)
            confidence = paper.confidence_score

            # Weighted combination
            final_score = (
                retrieval_score * 0.40
                + evidence_weight * status_mult * 0.30
                + confidence * 0.15
                + recency * 0.10
                + citation * 0.05
            )

            reranked.append(RetrievalResult(
                paper=result.paper,
                score=round(final_score, 4),
                strategy=result.strategy,
                snippet=result.snippet,
                highlights=result.highlights,
            ))

        return sorted(reranked, key=lambda r: r.score, reverse=True)
