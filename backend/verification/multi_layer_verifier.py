"""
MEDICA Multi-Layer Verification Agent
Replaces single-shot adversarial LLM review with the multi-layer pipeline
notebook's 5-layer paper-vs-corpus comparison (keyword / embedding / topic /
entity / claim), run against related papers already in the knowledge base.

This is what actually populates VerificationResult.contradictions — previously
always an empty list under AdversarialVerifier — from real claim-relation
classification (Supports / Contradicts / Extends / Similar / Neutral) instead
of a placeholder.
"""
from __future__ import annotations

from uuid import UUID

from analysis.pipeline import AnalysisSubject, MultiLayerPipeline
from analysis.types import ComparisonCandidateResult
from core.logging import get_logger
from core.types import PaperMetadata, VerificationResult, VerificationStatus
from indexing.metadata import MetadataIndex
from verification.scorer import EvidenceScorer

logger = get_logger(__name__)

_CANDIDATE_LIMIT = 10
_CONTRADICTION_PENALTY = 0.25


class MultiLayerVerifier:
    """
    Verifies a newly ingested paper by running it through the 5-layer
    analysis pipeline against related papers already in the knowledge base
    (matched by shared cancer tags).

    confidence_score is the best-matching candidate's weighted overall
    similarity score (claim 35% / topic 25% / embedding 20% / keyword 10% /
    entity 10%), penalized when that candidate's claims are predominantly
    contradicted rather than supported/extended/similar. If no comparable
    literature exists yet in this paper's category, it's marked pending with
    a neutral score rather than forcing a judgement from an empty set.
    """

    def __init__(self) -> None:
        self.pipeline = MultiLayerPipeline()
        self.scorer = EvidenceScorer()
        self.metadata_index = MetadataIndex()

    async def _fetch_candidates(self, paper: PaperMetadata) -> list[AnalysisSubject]:
        """Related existing papers to compare against, matched by shared cancer tags (OR semantics)."""
        if not paper.tags.cancer:
            return []

        seen_ids: set[UUID] = set()
        records = []
        for tag in paper.tags.cancer:
            tag_records = await self.metadata_index.filter_papers(cancer_tags=[tag], limit=_CANDIDATE_LIMIT)
            for record in tag_records:
                if record.id not in seen_ids:
                    seen_ids.add(record.id)
                    records.append(record)
            if len(records) >= _CANDIDATE_LIMIT:
                break
        records = records[:_CANDIDATE_LIMIT]

        subjects: list[AnalysisSubject] = []
        for record in records:
            if paper.pmid and record.pmid == paper.pmid:
                continue
            if paper.doi and record.doi == paper.doi:
                continue
            if not record.abstract:
                continue
            subjects.append(AnalysisSubject(
                id=str(record.id),
                title=record.title,
                text=f"{record.title}\n\n{record.abstract}",
                provided_keywords=record.keywords or [],
                provided_claims=await self._fetch_claims(record.id),
            ))
        return subjects

    async def _fetch_claims(self, paper_id: UUID) -> list[str]:
        """Reuse already-extracted claims for an existing paper instead of re-extracting via LLM."""
        from sqlalchemy import select
        from shared.database import get_session
        from shared.models import ClaimRecord

        async with get_session() as session:
            result = await session.execute(
                select(ClaimRecord.claim_text).where(ClaimRecord.paper_id == paper_id)
            )
            return [row[0] for row in result.all()]

    def _synthesize_review(self, paper: PaperMetadata, candidates: list[ComparisonCandidateResult]) -> str:
        """Human-readable summary of the multi-layer comparison, replacing the old single LLM paragraph."""
        if not candidates:
            indication = ", ".join(paper.tags.cancer) or "this indication"
            return (
                f"No comparable literature was found in the knowledge base for {indication}. "
                f"This paper is the first indexed entry in its category — treat findings as "
                f"provisional until corroborating studies are ingested."
            )

        lines = [
            f"Compared against {len(candidates)} related paper(s) in the knowledge base using "
            f"keyword, embedding, topic, entity, and claim-relation analysis "
            f"(weights: claim 35%, topic 25%, embedding 20%, keyword 10%, entity 10%)."
        ]
        for c in candidates[:5]:
            rel = c.relation_counts
            lines.append(
                f'- "{c.title}" — overall similarity {c.overall_score:.0%} '
                f"(claims: {rel.supports} supports / {rel.contradicts} contradicts / "
                f"{rel.extends} extends / {rel.similar} similar / {rel.neutral} neutral; "
                f"topic {c.scores.topic_similarity:.0%}, embedding {c.scores.embedding_similarity:.0%})"
            )
        return "\n".join(lines)

    def _determine_status(self, score: float, contradictions: list[str]) -> VerificationStatus:
        if contradictions:
            return VerificationStatus.DISPUTED
        if score >= 0.75:
            return VerificationStatus.VERIFIED
        if score >= 0.40:
            return VerificationStatus.UNVERIFIED
        return VerificationStatus.PENDING

    async def verify(self, paper: PaperMetadata) -> VerificationResult:
        """Run full multi-layer verification on a paper."""
        flags = self.scorer.classify_flags(paper)
        candidates_input = await self._fetch_candidates(paper)

        if not candidates_input:
            flags.append("novel_no_comparable_literature")
            result = VerificationResult(
                paper_id=paper.id,
                status=VerificationStatus.PENDING,
                confidence_score=0.5,
                evidence_level=paper.evidence_level,
                flags=flags,
                contradictions=[],
                adversarial_review=self._synthesize_review(paper, []),
            )
            logger.info("paper_verified_novel", pmid=paper.pmid, title=paper.title[:60])
            return result

        new_subject = AnalysisSubject(
            id=str(paper.id),
            title=paper.title,
            text=f"{paper.title}\n\n{paper.abstract or ''}",
            provided_keywords=paper.keywords,
        )

        analysis = await self.pipeline.compare(new_subject, candidates_input)
        top = analysis.candidates[0]

        confidence = top.overall_score
        if top.relation_counts.contradicts > 0 and top.relation_counts.contradicts >= top.relation_counts.supports:
            confidence = confidence - _CONTRADICTION_PENALTY
            flags.append("contradicts_top_match")
        confidence = round(min(1.0, max(0.0, confidence)), 4)

        contradictions = [
            c.candidate_id for c in analysis.candidates
            if c.relation_counts.contradicts > 0
            and c.relation_counts.contradicts >= max(
                c.relation_counts.supports, c.relation_counts.extends, c.relation_counts.similar
            )
        ]

        status = self._determine_status(confidence, contradictions)

        result = VerificationResult(
            paper_id=paper.id,
            status=status,
            confidence_score=confidence,
            evidence_level=paper.evidence_level,
            flags=flags,
            contradictions=contradictions,
            adversarial_review=self._synthesize_review(paper, analysis.candidates),
        )

        logger.info(
            "paper_verified",
            pmid=paper.pmid,
            status=status.value,
            confidence=confidence,
            top_match=top.title[:60],
            top_score=top.overall_score,
            contradictions=len(contradictions),
        )
        return result
