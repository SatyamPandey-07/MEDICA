"""
MEDICA Layer 4: Entity Analysis
Extracts scientific/clinical entities via Groq LLM, merged with spaCy NER,
scored by Jaccard overlap of unigrams. Ported from the multi-layer pipeline
notebook.
"""
from __future__ import annotations

import asyncio

from core.logging import get_logger

logger = get_logger(__name__)

_LLM_TRUNCATE_CHARS = 1000
_SPACY_TRUNCATE_CHARS = 1000
_SPACY_ENTITY_LABELS = {"ORG", "PRODUCT", "WORK_OF_ART"}

_ENTITY_PROMPT = (
    "Extract a comma-separated list of scientific/clinical entities "
    "(drugs, biomarkers, genes, trial endpoints, study designs, datasets) "
    "from this text. Only return the list.\n\n{text}"
)


async def extract_entities_llm(text: str) -> list[str]:
    from core.config import settings

    def _call() -> str:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)
        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": _ENTITY_PROMPT.format(text=text[:_LLM_TRUNCATE_CHARS])}],
            model=settings.groq_model,
            temperature=0.1,
        )
        return completion.choices[0].message.content or ""

    try:
        raw = await asyncio.to_thread(_call)
        return [e.strip().lower() for e in raw.split(",") if e.strip()]
    except Exception as e:
        logger.warning("entity_extraction_llm_failed", error=str(e))
        return []


def extract_entities_spacy(text: str) -> list[str]:
    try:
        from analysis.keyword_layer import get_spacy_nlp
        nlp = get_spacy_nlp()
        doc = nlp(text[:_SPACY_TRUNCATE_CHARS])
        return [ent.text.lower() for ent in doc.ents if ent.label_ in _SPACY_ENTITY_LABELS]
    except Exception as e:
        logger.debug("entity_extraction_spacy_failed", error=str(e))
        return []


async def extract_entities(text: str) -> list[str]:
    """Merge LLM-extracted and spaCy-NER entities for `text`."""
    llm_entities = await extract_entities_llm(text)
    spacy_entities = extract_entities_spacy(text)
    return sorted(set(llm_entities) | set(spacy_entities))
