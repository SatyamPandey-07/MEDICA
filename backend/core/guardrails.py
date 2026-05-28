"""
MEDICA Clinical Safety & Factuality Guardrails
Implements the input and output validation layer to prevent clinical hallucinations, prompt injections, and off-topic queries.
"""
from __future__ import annotations

import re
from typing import Tuple, List, Dict, Any, Optional

from core.logging import get_logger
from core.llm import LLMFactory
from shared.database import get_session
from sqlalchemy import select
from shared.models import PaperRecord

logger = get_logger(__name__)

# Common medical relevance trigger keywords
_MEDICAL_KEYWORDS = {
    "cancer", "oncology", "trial", "study", "patient", "survival", "efficacy", "safety",
    "chemotherapy", "immunotherapy", "biomarker", "mutation", "egfr", "kras", "brca",
    "rct", "hazard ratio", "p-value", "dose", "therapy", "clinical", "tumor", "metastatic",
    "carcinoma", "inhibitor", "toxicity", "progression", "adverse", "resection", "remission"
}

# Prompt injection block patterns
_INJECTION_PATTERNS = [
    r"ignore previous instructions",
    r"you are now a",
    r"system prompt",
    r"bypass safety",
    r"forget what you were told",
    r"override rules"
]


class ClinicalGuardrails:
    """Double-ended safety middleware validating user prompts and clinical outputs."""

    @staticmethod
    def validate_input(user_query: str) -> Tuple[bool, str]:
        """
        Validates user input against prompt injections and medical relevance.
        Returns (is_safe, error_message).
        """
        query_lower = user_query.lower()

        # 1. Prompt Injection Filter
        for pattern in _INJECTION_PATTERNS:
            if re.search(pattern, query_lower):
                logger.warning("guardrail_input_injection_blocked", query=user_query)
                return False, "Prompt injection pattern detected. Request rejected for security compliance."

        # 2. Medical/Oncology Relevance Filter
        # Check if the query is relevant to medical context (must contain at least one medical keyword)
        has_medical = any(kw in query_lower for kw in _MEDICAL_KEYWORDS)
        if not has_medical:
            # Let's perform a lightweight check - if there are no medical keywords at all,
            # we block it to prevent off-topic chat abuse.
            logger.warning("guardrail_input_relevance_blocked", query=user_query)
            return False, "MEDICA is dedicated exclusively to Oncology and Scientific Medical research. Please rephrase your query to focus on clinical trials or molecular science."

        return True, ""

    @staticmethod
    async def validate_output(final_answer: str, user_query: str) -> Tuple[bool, str]:
        """
        Scans LLM output for statistical claims and cross-checks cited papers.
        If a contradiction is found, invokes an LLM self-healing cycle.
        """
        logger.info("guardrail_output_scanning")

        # Extract cited PMIDs/DOIs
        pmids = re.findall(r"PMID:\s*(\d+)", final_answer)
        dois = re.findall(r"DOI:\s*(10\.\d{4,9}/[-._;()/:A-Z0-9]+)", final_answer, re.IGNORECASE)

        if not pmids and not dois:
            # No citations found - warn but pass if it is general conversational context
            return True, final_answer

        # Fetch cited papers from DB
        cited_texts: List[str] = []
        async with get_session() as session:
            for pmid in pmids:
                res = await session.execute(select(PaperRecord).where(PaperRecord.pmid == pmid))
                paper = res.scalar_one_or_none()
                if paper:
                    cited_texts.append(f"[PMID: {pmid}] Abstract: {paper.abstract or ''}")
            for doi in dois:
                res = await session.execute(select(PaperRecord).where(PaperRecord.doi == doi))
                paper = res.scalar_one_or_none()
                if paper:
                    cited_texts.append(f"[DOI: {doi}] Abstract: {paper.abstract or ''}")

        if not cited_texts:
            # Cited sources are external/uncached, pass verification gracefully
            return True, final_answer

        # Extract clinical metrics (p-values, hazard ratios) from generated response
        metrics_found = re.findall(r"\b(p\s*[<>=]\s*\d+\.\d+|HR\s*=\s*\d+\.\d+|hazard ratio|median OS|PFS)\b", final_answer, re.IGNORECASE)
        if not metrics_found:
            return True, final_answer

        # 3. Groundedness validation using LLM Factory (Self-Healing Loop)
        verification_prompt = f"""You are MEDICA's clinical safety verifier.
Your task is to double-check that the generated scientific answer contains absolutely accurate statistics based ONLY on the source papers.

User Query: {user_query}
Generated Answer:
---
{final_answer}
---

Source Paper Abstract Contexts:
---
{" | ".join(cited_texts)}
---

Evaluate: Are any p-values, hazard ratios, survival statistics (OS/PFS), or drug dosages in the Generated Answer contradicted by or completely absent from the Source Paper Abstracts?
If there is a statistical hallucination or mismatch:
1. Rewrite the Generated Answer to perfectly align with the Source Abstracts. Remove or correct any hallucinated numbers. Enforce strict citations.
2. Return ONLY the rewritten, corrected text.

If the answer is 100% factually correct and fully grounded, return the original Generated Answer verbatim. Do not append any tags or explanation.
"""
        try:
            client = LLMFactory.get_client()
            corrected_text = await client.generate(
                messages=[{"role": "user", "content": verification_prompt}],
                temperature=0.0,
                max_tokens=2500
            )
            
            # Check if text was modified
            if corrected_text.strip() != final_answer.strip():
                logger.warning("guardrail_output_hallucination_healed")
                return False, corrected_text.strip()
                
        except Exception as err:
            logger.error("guardrail_validation_failed", error=str(err))
            
        return True, final_answer
