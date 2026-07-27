"""
MEDICA Multi-Layer Comparison Pipeline
Orchestrates the 5 analysis layers (keyword, embedding, topic, entity, claim)
to compare a new paper against a set of candidate existing papers, exactly
mirroring the multi-layer pipeline notebook's final weighted aggregation:
claim 35%, topic 25%, embedding 20%, keyword 10%, entity 10%.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from analysis import claim_layer, embedding_layer, entity_layer, keyword_layer, topic_layer
from analysis.types import ComparisonCandidateResult, LayerScores, MultiLayerAnalysisResult, RelationCounts
from core.logging import get_logger

logger = get_logger(__name__)

WEIGHTS: dict[str, float] = {
    "claim": 0.35,
    "topic": 0.25,
    "embedding": 0.20,
    "keyword": 0.10,
    "entity": 0.10,
}


@dataclass
class AnalysisSubject:
    """One paper (new or candidate) to run through the 5-layer pipeline."""
    id: str
    title: str
    text: str
    provided_keywords: list[str] = field(default_factory=list)
    provided_claims: list[str] = field(default_factory=list)


@dataclass
class _PreparedSubject:
    subject: AnalysisSubject
    keywords: dict[str, list[str]]
    embedding: list[float]
    topics: dict[str, float]
    entities: list[str]
    claims: list[str]


class MultiLayerPipeline:
    """
    Runs all 5 analysis layers for a new paper against a list of candidates
    and produces a weighted, ranked comparison result.
    """

    def __init__(self) -> None:
        self._embedding_cache: dict[str, list[float]] = {}
        self._topic_labels_cache: list[str] | None = None

    def _topic_labels(self) -> list[str]:
        if self._topic_labels_cache is None:
            self._topic_labels_cache = topic_layer.topic_labels()
        return self._topic_labels_cache

    async def _prepare(self, subject: AnalysisSubject) -> _PreparedSubject:
        labels = self._topic_labels()

        keywords_task = asyncio.to_thread(keyword_layer.extract_keywords, subject.text, subject.provided_keywords or None)
        embedding_task = embedding_layer.get_gemini_embedding(subject.text[:500], cache=self._embedding_cache)
        topics_task = asyncio.to_thread(topic_layer.classify_topics, subject.text, labels)
        entities_task = entity_layer.extract_entities(subject.text)
        claims_task = (
            _immediate(subject.provided_claims)
            if subject.provided_claims
            else claim_layer.extract_claims(subject.text)
        )

        keywords, embedding, topics, entities, claims = await asyncio.gather(
            keywords_task, embedding_task, topics_task, entities_task, claims_task
        )

        return _PreparedSubject(
            subject=subject, keywords=keywords, embedding=embedding,
            topics=topics, entities=entities, claims=claims,
        )

    async def compare(
        self,
        new_paper: AnalysisSubject,
        candidates: list[AnalysisSubject],
    ) -> MultiLayerAnalysisResult:
        """Compare `new_paper` against each of `candidates`, ranked by overall score."""
        new_prepared = await self._prepare(new_paper)
        labels = self._topic_labels()

        candidate_results: list[ComparisonCandidateResult] = []
        for candidate in candidates:
            cand_prepared = await self._prepare(candidate)
            candidate_results.append(await self._score_candidate(new_prepared, cand_prepared, labels))

        candidate_results.sort(key=lambda c: c.overall_score, reverse=True)

        return MultiLayerAnalysisResult(
            new_paper_title=new_paper.title,
            new_paper_keywords=sorted(keyword_layer.get_keyword_terms(new_prepared.keywords)),
            new_paper_entities=new_prepared.entities,
            new_paper_claims=new_prepared.claims,
            candidates=candidate_results,
            weights=WEIGHTS,
        )

    async def _score_candidate(
        self,
        new_prepared: _PreparedSubject,
        cand_prepared: _PreparedSubject,
        labels: list[str],
    ) -> ComparisonCandidateResult:
        new_kw_terms = keyword_layer.get_keyword_terms(new_prepared.keywords)
        cand_kw_terms = keyword_layer.get_keyword_terms(cand_prepared.keywords)
        shared_keywords = sorted(new_kw_terms & cand_kw_terms)
        keyword_score = keyword_layer.jaccard_similarity(new_kw_terms, cand_kw_terms)

        embedding_score = embedding_layer.cosine_similarity(new_prepared.embedding, cand_prepared.embedding)

        topic_score = topic_layer.topic_similarity(new_prepared.topics, cand_prepared.topics, labels)

        new_entity_terms = keyword_layer.get_unigrams(new_prepared.entities)
        cand_entity_terms = keyword_layer.get_unigrams(cand_prepared.entities)
        shared_entities = sorted(new_entity_terms & cand_entity_terms)
        entity_score = keyword_layer.jaccard_similarity(new_entity_terms, cand_entity_terms)

        relation_counts, claim_score = await claim_layer.compare_claims(new_prepared.claims, cand_prepared.claims)

        scores = LayerScores(
            keyword_jaccard=round(keyword_score, 4),
            embedding_similarity=round(embedding_score, 4),
            topic_similarity=round(topic_score, 4),
            entity_similarity=round(entity_score, 4),
            claim_similarity=round(claim_score, 4),
        )
        overall = (
            scores.claim_similarity * WEIGHTS["claim"]
            + scores.topic_similarity * WEIGHTS["topic"]
            + scores.embedding_similarity * WEIGHTS["embedding"]
            + scores.entity_similarity * WEIGHTS["entity"]
            + scores.keyword_jaccard * WEIGHTS["keyword"]
        )

        return ComparisonCandidateResult(
            candidate_id=cand_prepared.subject.id,
            title=cand_prepared.subject.title,
            scores=scores,
            overall_score=round(overall, 4),
            relation_counts=RelationCounts(
                supports=relation_counts.get("Supports", 0),
                contradicts=relation_counts.get("Contradicts", 0),
                extends=relation_counts.get("Extends", 0),
                similar=relation_counts.get("Similar", 0),
                neutral=relation_counts.get("Neutral", 0),
            ),
            shared_keywords=shared_keywords,
            shared_entities=shared_entities,
            new_paper_claims=new_prepared.claims,
            candidate_claims=cand_prepared.claims,
        )


async def _immediate(value: list[str]) -> list[str]:
    return value
