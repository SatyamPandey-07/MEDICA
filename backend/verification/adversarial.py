"""
MEDICA Adversarial Verification Agent
Challenges incoming papers with LLM-assisted adversarial review.
Falls back to rule-based scoring if LLM is unavailable.
"""
from __future__ import annotations

from core.config import settings, LLMProvider
from core.logging import get_logger
from core.types import EvidenceLevel, PaperMetadata, VerificationResult, VerificationStatus
from verification.scorer import EvidenceScorer

logger = get_logger(__name__)

# Adversarial review prompt
_ADVERSARIAL_PROMPT = """You are a rigorous oncology research reviewer conducting an adversarial review.

Your role is to CHALLENGE this paper's claims, NOT to summarize it.

Paper:
Title: {title}
Journal: {journal}
Study Type: {study_type}
Evidence Level: {evidence_level}
Abstract: {abstract}

Your adversarial review MUST:
1. Identify weaknesses in methodology or study design
2. Flag any statistical concerns (p-values, sample size, power)
3. Note if findings are preliminary, preclinical, or not peer-reviewed
4. Identify any claims that may be overstated or sensationalized
5. Assess if the abstract contradicts known oncology evidence
6. Explicitly state what further evidence is needed before clinical relevance

Be concise, scientifically rigorous, and skeptical.
Output ONLY the adversarial review text (2-4 paragraphs).
"""


class AdversarialVerifier:
    """
    Adversarial verification agent.

    Combines:
      1. Rule-based evidence scoring (always runs)
      2. LLM adversarial review (runs if LLM is configured)

    The adversarial review challenges claims before they are accepted
    into the knowledge base with full confidence.
    """

    def __init__(self) -> None:
        self.scorer = EvidenceScorer()
        self._llm_available = bool(settings.active_llm_key)

    async def _llm_review(self, paper: PaperMetadata) -> str | None:
        """Run LLM adversarial review on a paper."""
        if not self._llm_available:
            return None

        prompt = _ADVERSARIAL_PROMPT.format(
            title=paper.title,
            journal=paper.journal or "Unknown",
            study_type=paper.study_type.value,
            evidence_level=paper.evidence_level.value,
            abstract=paper.abstract or "No abstract available.",
        )

        try:
            if settings.llm_provider == LLMProvider.GEMINI:
                return await self._gemini_review(prompt)
            elif settings.llm_provider == LLMProvider.OPENAI:
                return await self._openai_review(prompt)
            elif settings.llm_provider == LLMProvider.ANTHROPIC:
                return await self._anthropic_review(prompt)
        except Exception as e:
            logger.warning("llm_review_failed", error=str(e), pmid=paper.pmid)
            return None

    async def _gemini_review(self, prompt: str) -> str:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)
        response = await model.generate_content_async(prompt)
        return response.text.strip()

    async def _openai_review(self, prompt: str) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
        )
        return response.choices[0].message.content.strip()

    async def _anthropic_review(self, prompt: str) -> str:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()

    def _determine_status(self, score: float, flags: list[str]) -> VerificationStatus:
        """Determine verification status from score and flags."""
        if score >= 0.75:
            return VerificationStatus.VERIFIED
        elif score >= 0.40:
            return VerificationStatus.UNVERIFIED
        elif "⚠️ Disputed findings" in flags:
            return VerificationStatus.DISPUTED
        else:
            return VerificationStatus.PENDING

    async def verify(self, paper: PaperMetadata) -> VerificationResult:
        """
        Run full adversarial verification on a paper.

        Returns a VerificationResult with:
          - status (verified/unverified/disputed/pending)
          - confidence_score (0.0–1.0)
          - evidence_level
          - flags (quality warnings)
          - adversarial_review (LLM text, if available)
        """
        # 1. Rule-based scoring
        score = self.scorer.score(paper)
        flags = self.scorer.classify_flags(paper)

        # 2. LLM adversarial review (optional)
        adversarial_review = None
        if self._llm_available and paper.abstract:
            adversarial_review = await self._llm_review(paper)

        # 3. Determine final status
        status = self._determine_status(score, flags)

        result = VerificationResult(
            paper_id=paper.id,
            status=status,
            confidence_score=score,
            evidence_level=paper.evidence_level,
            flags=flags,
            contradictions=[],
            adversarial_review=adversarial_review,
        )

        logger.info(
            "paper_verified",
            pmid=paper.pmid,
            status=status,
            score=score,
            flags_count=len(flags),
            llm_review=adversarial_review is not None,
        )

        return result
