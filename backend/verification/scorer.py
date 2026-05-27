"""
MEDICA Evidence Quality Scorer
Assigns confidence scores based on study type, citation count, and evidence signals.
This is the rule-based component of verification — LLM-based adversarial review is separate.
"""
from __future__ import annotations

from core.logging import get_logger
from core.types import EvidenceLevel, PaperMetadata, StudyType

logger = get_logger(__name__)

# Base confidence scores by evidence level
_EVIDENCE_BASE_SCORES: dict[EvidenceLevel, float] = {
    EvidenceLevel.META_ANALYSIS: 0.90,
    EvidenceLevel.SYSTEMATIC_REVIEW: 0.85,
    EvidenceLevel.RCT: 0.80,
    EvidenceLevel.COHORT: 0.65,
    EvidenceLevel.CASE_CONTROL: 0.60,
    EvidenceLevel.CASE_SERIES: 0.45,
    EvidenceLevel.EXPERT_OPINION: 0.35,
    EvidenceLevel.PRECLINICAL: 0.30,
    EvidenceLevel.UNKNOWN: 0.25,
}

# Bonus/penalty modifiers
_CITATION_BONUS_TIERS = [
    (500, 0.10),
    (200, 0.07),
    (100, 0.05),
    (50,  0.03),
    (10,  0.01),
]

_PHASE_BONUSES = {
    "phase_3": 0.08,
    "phase_2": 0.04,
    "phase_1": 0.01,
}

_EVIDENCE_TAG_BONUSES = {
    "fda_approved": 0.10,
    "guideline_backed": 0.08,
    "replicated": 0.05,
    "high_confidence": 0.03,
}

_EVIDENCE_TAG_PENALTIES = {
    "disputed": -0.15,
    "preclinical_only": -0.10,
    "small_sample": -0.08,
}


class EvidenceScorer:
    """
    Rule-based evidence quality scorer.

    Computes a confidence score (0.0–1.0) based on:
      1. Base score from evidence level (study type hierarchy)
      2. Citation count bonus (more citations = more validated)
      3. Trial phase bonus
      4. Tag-based bonuses/penalties (FDA approved, disputed, etc.)

    This is deterministic and fast — LLM adversarial review adds
    qualitative judgment on top.
    """

    def score(self, paper: PaperMetadata) -> float:
        """Compute confidence score for a paper."""
        # Start with base score
        base = _EVIDENCE_BASE_SCORES.get(paper.evidence_level, 0.25)

        # Citation bonus
        citation_bonus = 0.0
        for threshold, bonus in _CITATION_BONUS_TIERS:
            if paper.citation_count >= threshold:
                citation_bonus = bonus
                break

        # Phase bonus
        phase_bonus = 0.0
        if paper.trial_phase:
            phase_bonus = _PHASE_BONUSES.get(paper.trial_phase.value, 0.0)

        # Tag-based adjustments
        all_tags = paper.tags.evidence + paper.tags.study_type
        tag_adjustment = 0.0
        for tag in all_tags:
            tag_adjustment += _EVIDENCE_TAG_BONUSES.get(tag, 0.0)
            tag_adjustment += _EVIDENCE_TAG_PENALTIES.get(tag, 0.0)

        # Sum and clamp
        raw_score = base + citation_bonus + phase_bonus + tag_adjustment
        final_score = max(0.0, min(1.0, raw_score))

        logger.debug(
            "evidence_scored",
            pmid=paper.pmid,
            base=base,
            citation_bonus=citation_bonus,
            phase_bonus=phase_bonus,
            tag_adjustment=tag_adjustment,
            final=final_score,
        )

        return round(final_score, 4)

    def classify_flags(self, paper: PaperMetadata) -> list[str]:
        """Return a list of quality flags for this paper."""
        flags = []
        all_tags = paper.tags.evidence + paper.tags.study_type

        if "disputed" in all_tags:
            flags.append("⚠️ Disputed findings")
        if "preclinical_only" in all_tags:
            flags.append("🧪 Preclinical evidence only")
        if "small_sample" in all_tags:
            flags.append("📉 Small sample size")
        if paper.citation_count == 0:
            flags.append("📋 No citations recorded")
        if paper.abstract is None:
            flags.append("📄 No abstract available")
        if "fda_approved" in all_tags:
            flags.append("✅ FDA approved")
        if "guideline_backed" in all_tags:
            flags.append("📌 Guideline-backed")
        if "phase_3" in all_tags:
            flags.append("🔬 Phase III evidence")

        return flags
