"""
MEDICA Multi-Layer Analysis — Result Types
Pydantic models shared by the verification pipeline and the /analysis/compare API.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class RelationCounts(BaseModel):
    """Counts of claim-pair relationships classified between two papers."""
    supports: int = 0
    contradicts: int = 0
    extends: int = 0
    similar: int = 0
    neutral: int = 0

    @property
    def total(self) -> int:
        return self.supports + self.contradicts + self.extends + self.similar + self.neutral


class LayerScores(BaseModel):
    """Raw similarity score (0.0-1.0) produced by each of the 5 analysis layers."""
    keyword_jaccard: float = 0.0
    embedding_similarity: float = 0.0
    topic_similarity: float = 0.0
    entity_similarity: float = 0.0
    claim_similarity: float = 0.0


class ComparisonCandidateResult(BaseModel):
    """Result of comparing one candidate (existing) paper against the new paper."""
    candidate_id: str
    title: str
    scores: LayerScores
    overall_score: float
    relation_counts: RelationCounts
    shared_keywords: list[str] = Field(default_factory=list)
    shared_entities: list[str] = Field(default_factory=list)
    new_paper_claims: list[str] = Field(default_factory=list)
    candidate_claims: list[str] = Field(default_factory=list)


class MultiLayerAnalysisResult(BaseModel):
    """Full output of comparing one new paper against a set of candidate papers."""
    new_paper_title: str
    new_paper_keywords: list[str] = Field(default_factory=list)
    new_paper_entities: list[str] = Field(default_factory=list)
    new_paper_claims: list[str] = Field(default_factory=list)
    candidates: list[ComparisonCandidateResult] = Field(default_factory=list)
    weights: dict[str, float] = Field(default_factory=dict)
