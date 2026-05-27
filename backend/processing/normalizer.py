"""
MEDICA Paper Normalizer
Converts RawPaper → PaperMetadata with cleaned, structured fields.
Handles alias resolution, date parsing, author normalization.
"""
from __future__ import annotations

import re
from uuid import uuid4

from core.logging import get_logger
from core.types import DataSource, EvidenceLevel, PaperMetadata, RawPaper, StudyType, VerificationStatus
from shared.utils import normalize_doi, normalize_pmid, parse_date, resolve_alias, truncate

logger = get_logger(__name__)

# Study type detection patterns
_STUDY_TYPE_PATTERNS: list[tuple[StudyType, list[str]]] = [
    (StudyType.META_ANALYSIS, ["meta-analysis", "meta analysis", "metaanalysis"]),
    (StudyType.SYSTEMATIC_REVIEW, ["systematic review", "systematic literature review"]),
    (StudyType.CLINICAL_TRIAL, ["randomized controlled trial", "rct", "clinical trial", "phase 1", "phase 2", "phase 3", "phase i", "phase ii", "phase iii"]),
    (StudyType.OBSERVATIONAL, ["cohort study", "cohort", "case-control", "case control", "prospective study", "retrospective study"]),
    (StudyType.CASE_STUDY, ["case report", "case series"]),
    (StudyType.REVIEW, ["review", "literature review", "narrative review"]),
    (StudyType.PRECLINICAL, ["in vitro", "in vivo", "mouse model", "murine", "xenograft", "cell line"]),
]

# Evidence level map from study type
_STUDY_TO_EVIDENCE: dict[StudyType, EvidenceLevel] = {
    StudyType.META_ANALYSIS: EvidenceLevel.META_ANALYSIS,
    StudyType.SYSTEMATIC_REVIEW: EvidenceLevel.SYSTEMATIC_REVIEW,
    StudyType.CLINICAL_TRIAL: EvidenceLevel.RCT,
    StudyType.OBSERVATIONAL: EvidenceLevel.COHORT,
    StudyType.CASE_STUDY: EvidenceLevel.CASE_SERIES,
    StudyType.REVIEW: EvidenceLevel.EXPERT_OPINION,
    StudyType.PRECLINICAL: EvidenceLevel.PRECLINICAL,
    StudyType.EDITORIAL: EvidenceLevel.EXPERT_OPINION,
    StudyType.OTHER: EvidenceLevel.UNKNOWN,
}


class Normalizer:
    """
    Transforms RawPaper objects into structured PaperMetadata.

    Responsibilities:
      - Clean and validate all text fields
      - Parse dates into datetime objects
      - Normalize DOIs and PMIDs
      - Detect study type from title/abstract
      - Infer evidence level from study type
      - Resolve oncology term aliases
    """

    def _detect_study_type(self, title: str, abstract: str | None) -> StudyType:
        """Detect the study type from title and abstract text."""
        combined = f"{title} {abstract or ''}".lower()
        for study_type, patterns in _STUDY_TYPE_PATTERNS:
            if any(p in combined for p in patterns):
                return study_type
        return StudyType.OTHER

    def _clean_text(self, text: str | None) -> str | None:
        """Remove HTML tags and normalize whitespace."""
        if not text:
            return None
        # Remove HTML tags (common in CrossRef abstracts)
        text = re.sub(r"<[^>]+>", " ", text)
        # Normalize whitespace
        text = re.sub(r"\s+", " ", text).strip()
        return text if text else None

    def _normalize_keywords(self, keywords: list[str]) -> list[str]:
        """Deduplicate and normalize keyword list."""
        seen: set[str] = set()
        result: list[str] = []
        for kw in keywords:
            kw_clean = kw.strip().lower()
            resolved = resolve_alias(kw_clean)
            if resolved and resolved not in seen:
                seen.add(resolved)
                result.append(resolved)
        return result

    async def normalize(self, raw: RawPaper) -> PaperMetadata:
        """Normalize a RawPaper into a structured PaperMetadata."""
        title = self._clean_text(raw.title) or "Untitled"
        abstract = self._clean_text(raw.abstract)

        study_type = self._detect_study_type(title, abstract)
        evidence_level = _STUDY_TO_EVIDENCE.get(study_type, EvidenceLevel.UNKNOWN)

        published = parse_date(raw.published_date)
        doi = normalize_doi(raw.doi) if raw.doi else None
        pmid = normalize_pmid(raw.pmid) if raw.pmid else None
        keywords = self._normalize_keywords(raw.keywords)

        paper = PaperMetadata(
            id=uuid4(),
            title=title,
            pmid=pmid,
            doi=doi,
            journal=self._clean_text(raw.journal),
            published=published,
            authors=raw.authors,
            source=raw.source,
            verification_status=VerificationStatus.PENDING,
            confidence_score=0.0,
            evidence_level=evidence_level,
            study_type=study_type,
            abstract=abstract,
            keywords=keywords,
            citation_count=raw.citation_count,
        )

        logger.debug(
            "paper_normalized",
            pmid=pmid,
            doi=doi,
            study_type=study_type,
            evidence_level=evidence_level,
        )

        return paper
