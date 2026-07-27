"""
MEDICA Layer 5: Claim Analysis
Extracts structured scientific claims via Groq LLM and classifies the
relationship of each new-paper claim to each candidate-paper claim as one of
Supports / Contradicts / Extends / Similar / Neutral. Ported from the
multi-layer pipeline notebook.
"""
from __future__ import annotations

import asyncio
import json

from core.logging import get_logger

logger = get_logger(__name__)

_CLAIM_TRUNCATE_CHARS = 2000
_MAX_CONCURRENT_RELATION_CALLS = 5

RELATIONS = ("Supports", "Contradicts", "Extends", "Similar", "Neutral")

_CLAIM_SCHEMA = """{
  "claims": [
    {
      "claim": "The main assertion",
      "evidence": "Supporting text",
      "methodology": "How it was done",
      "outcome": "The result",
      "confidence": 0.95
    }
  ]
}"""

_RELATION_PROMPT = (
    "Given Claim A: '{old_claim}' and Claim B: '{new_claim}'. "
    "Classify the relationship of B to A as exactly one of: "
    "Supports, Contradicts, Extends, Similar, Neutral. Return ONLY the single word."
)

_relation_semaphore = asyncio.Semaphore(_MAX_CONCURRENT_RELATION_CALLS)


async def extract_claims(text: str) -> list[str]:
    """Extract the top 2-3 scientific claims from `text` via Groq."""
    from core.config import settings

    def _call() -> str:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)
        prompt = (
            f"Extract the top 2-3 scientific claims from this paper. "
            f"Format EXACTLY as this JSON schema: {_CLAIM_SCHEMA}\n\n"
            f"Paper text: {text[:_CLAIM_TRUNCATE_CHARS]}"
        )
        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=settings.groq_model,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        return completion.choices[0].message.content or "{}"

    try:
        raw = await asyncio.to_thread(_call)
        parsed = json.loads(raw)
        return [c["claim"] for c in parsed.get("claims", []) if c.get("claim")]
    except Exception as e:
        logger.warning("claim_extraction_failed", error=str(e))
        return []


async def classify_claim_relation(new_claim: str, old_claim: str) -> str:
    """Classify claim B's (new) relation to claim A (existing)."""
    from core.config import settings

    def _call() -> str:
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)
        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": _RELATION_PROMPT.format(old_claim=old_claim, new_claim=new_claim)}],
            model=settings.groq_model,
            temperature=0.1,
        )
        return (completion.choices[0].message.content or "").strip()

    async with _relation_semaphore:
        try:
            raw = await asyncio.to_thread(_call)
        except Exception as e:
            logger.warning("claim_relation_classification_failed", error=str(e))
            return "Neutral"

    raw_lower = raw.lower()
    for relation in RELATIONS:
        if relation.lower() in raw_lower:
            return relation
    return "Neutral"


async def compare_claims(new_claims: list[str], old_claims: list[str]) -> tuple[dict[str, int], float]:
    """
    Classify every (new_claim, old_claim) pair and return (relation_counts, claim_similarity).

    claim_similarity = (Supports + Extends + Similar) / total_pairs, matching the
    notebook's weighting: agreement/extension/similarity count toward corroboration,
    Contradicts and Neutral do not.
    """
    counts = {relation: 0 for relation in RELATIONS}
    if not new_claims or not old_claims:
        return counts, 0.0

    pairs = [(new_claim, old_claim) for new_claim in new_claims for old_claim in old_claims]
    relations = await asyncio.gather(*(classify_claim_relation(nc, oc) for nc, oc in pairs))

    for relation in relations:
        counts[relation] = counts.get(relation, 0) + 1

    total = sum(counts.values())
    sim_score = (counts["Supports"] + counts["Extends"] + counts["Similar"]) / total if total else 0.0
    return counts, sim_score
