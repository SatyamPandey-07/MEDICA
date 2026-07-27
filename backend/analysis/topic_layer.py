"""
MEDICA Layer 3: Topic Analysis
Zero-shot topic classification (BART) over MEDICA's own oncology taxonomy,
scored by cosine similarity between topic-probability distributions. Ported
from the multi-layer pipeline notebook — the notebook's own candidate labels
were specific to its NLP-conference demo domain, so here they're sourced from
MEDICA's real cancer/treatment taxonomy (processing.tagger) instead.
"""
from __future__ import annotations

from core.logging import get_logger

logger = get_logger(__name__)

_ZERO_SHOT_MODEL = "facebook/bart-large-mnli"
_TRUNCATE_CHARS = 500

_classifier = None
_labels_cache: list[str] | None = None


def _get_classifier():
    global _classifier
    if _classifier is None:
        from transformers import pipeline
        _classifier = pipeline("zero-shot-classification", model=_ZERO_SHOT_MODEL)
    return _classifier


def topic_labels() -> list[str]:
    """Candidate topic labels drawn from MEDICA's cancer + treatment tag taxonomy."""
    global _labels_cache
    if _labels_cache is not None:
        return _labels_cache

    from processing.tagger import CANCER_PATTERNS, TREATMENT_PATTERNS

    labels = {p.canonical.replace("_", " ").title() for p in CANCER_PATTERNS}
    labels |= {p.canonical.replace("_", " ").title() for p in TREATMENT_PATTERNS}
    _labels_cache = sorted(labels)
    return _labels_cache


def classify_topics(text: str, labels: list[str] | None = None) -> dict[str, float]:
    """Return {label: probability} for `text` against the candidate label set."""
    labels = labels or topic_labels()
    try:
        classifier = _get_classifier()
        result = classifier(text[:_TRUNCATE_CHARS], candidate_labels=labels)
        return dict(zip(result["labels"], result["scores"]))
    except Exception as e:
        logger.warning("topic_classification_failed", error=str(e))
        return {label: 0.0 for label in labels}


def topic_similarity(
    dist1: dict[str, float],
    dist2: dict[str, float],
    labels: list[str] | None = None,
) -> float:
    """Cosine similarity between two topic-probability distributions."""
    from analysis.embedding_layer import cosine_similarity

    labels = labels or sorted(set(dist1) | set(dist2))
    vec1 = [dist1.get(label, 0.0) for label in labels]
    vec2 = [dist2.get(label, 0.0) for label in labels]
    return cosine_similarity(vec1, vec2)
