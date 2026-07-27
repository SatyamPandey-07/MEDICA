"""
MEDICA Layer 1: Keyword Analysis
Extracts keywords via TF-IDF, RAKE, YAKE, KeyBERT, and TextRank, then scores
similarity between papers by Jaccard overlap. Ported from the multi-layer
pipeline notebook.
"""
from __future__ import annotations

import re

from core.logging import get_logger

logger = get_logger(__name__)

_KEYWORD_LINE_RE = re.compile(r"(?im)^keywords?\s*:\s*(.+)$")

_keybert_model = None
_yake_extractor = None
_spacy_nlp = None


def _get_keybert():
    global _keybert_model
    if _keybert_model is None:
        from keybert import KeyBERT
        _keybert_model = KeyBERT()
    return _keybert_model


def _get_yake():
    global _yake_extractor
    if _yake_extractor is None:
        import yake
        _yake_extractor = yake.KeywordExtractor(lan="en", n=2, dedupLim=0.9, top=5)
    return _yake_extractor


def get_spacy_nlp():
    """Shared spaCy pipeline with TextRank attached (also used by entity_layer)."""
    global _spacy_nlp
    if _spacy_nlp is None:
        import pytextrank  # noqa: F401 -- registers the "textrank" pipe factory
        import spacy
        _spacy_nlp = spacy.load("en_core_web_sm")
        _spacy_nlp.add_pipe("textrank")
    return _spacy_nlp


def extract_keywords(text: str, provided: list[str] | None = None) -> dict[str, list[str]]:
    """
    Run all keyword-extraction methods against `text` and aggregate results.

    `provided` (e.g. a paper's existing `keywords` field) takes priority as
    the "provided" bucket, mirroring the notebook's behavior of preferring
    author-supplied keywords over extracted ones when scoring similarity.
    """
    results: dict[str, list[str]] = {}

    if provided:
        results["provided"] = list(provided)
    else:
        match = _KEYWORD_LINE_RE.search(text)
        results["provided"] = (
            [kw.strip() for kw in re.split(r",|;", match.group(1)) if kw.strip()] if match else []
        )

    # 1. TF-IDF (single-document top terms)
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        tfidf = TfidfVectorizer(stop_words="english", max_features=5)
        tfidf.fit_transform([text])
        results["tfidf"] = tfidf.get_feature_names_out().tolist()
    except Exception as e:
        logger.debug("keyword_tfidf_failed", error=str(e))
        results["tfidf"] = []

    # 2. RAKE
    try:
        from rake_nltk import Rake
        r = Rake()
        r.extract_keywords_from_text(text)
        results["rake"] = r.get_ranked_phrases()[:5]
    except Exception as e:
        logger.debug("keyword_rake_failed", error=str(e))
        results["rake"] = []

    # 3. YAKE
    try:
        extractor = _get_yake()
        results["yake"] = [kw for kw, _ in extractor.extract_keywords(text)]
    except Exception as e:
        logger.debug("keyword_yake_failed", error=str(e))
        results["yake"] = []

    # 4. KeyBERT
    try:
        model = _get_keybert()
        keybert_res = model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words="english", top_n=5)
        results["keybert"] = [kw for kw, _ in keybert_res]
    except Exception as e:
        logger.debug("keyword_keybert_failed", error=str(e))
        results["keybert"] = []

    # 5. TextRank
    try:
        nlp = get_spacy_nlp()
        doc = nlp(text)
        results["textrank"] = [phrase.text for phrase in doc._.phrases[:5]]
    except Exception as e:
        logger.debug("keyword_textrank_failed", error=str(e))
        results["textrank"] = []

    all_kws: set[str] = set()
    for source, values in results.items():
        if source == "provided":
            continue
        all_kws.update(kw.lower().strip() for kw in values if isinstance(kw, str) and kw.strip())
    results["aggregated"] = sorted(all_kws)

    return results


def get_keyword_terms(keyword_dict: dict[str, list[str]]) -> set[str]:
    """Prefer author-provided keywords; fall back to the aggregated extraction set."""
    keyword_list = keyword_dict.get("provided") or keyword_dict.get("aggregated") or []
    return {re.sub(r"\s+", " ", str(kw).strip().lower()) for kw in keyword_list if str(kw).strip()}


def get_unigrams(phrases: list[str]) -> set[str]:
    """Break a list of phrases into normalized unigrams (words longer than 2 chars)."""
    words: set[str] = set()
    for phrase in phrases:
        for w in re.findall(r"\b\w+\b", str(phrase)):
            if len(w) > 2:
                words.add(w.lower())
    return words


def jaccard_similarity(set1: set[str], set2: set[str]) -> float:
    if not set1 or not set2:
        return 0.0
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection / union if union else 0.0
