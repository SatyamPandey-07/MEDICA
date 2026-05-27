"""
MEDICA Entity Linker
Links papers to known oncology entities in the knowledge graph.
Populates linked_entities, related_papers, and contradictory_papers fields.
"""
from __future__ import annotations

from core.logging import get_logger
from core.types import PaperMetadata
from shared.utils import resolve_alias

logger = get_logger(__name__)


class EntityLinker:
    """
    Links paper entities to canonical knowledge graph entities.

    Extracts all tagged entities and produces:
      - linked_entities: canonical entity names referenced by this paper
      - related_papers: papers sharing cancer/drug/biomarker tags (populated async)

    Full graph linking (contradictions, semantic similarity) is performed
    by the scheduled relinker job after initial ingestion.
    """

    async def link(self, paper: PaperMetadata) -> PaperMetadata:
        """Link a paper's entities to the knowledge graph."""
        entities: list[str] = []

        # Collect all tagged entities
        for cancer in paper.tags.cancer:
            entities.append(f"cancer:{resolve_alias(cancer)}")
        for drug in paper.tags.drugs:
            entities.append(f"drug:{resolve_alias(drug)}")
        for biomarker in paper.tags.biomarkers:
            entities.append(f"biomarker:{resolve_alias(biomarker)}")
        for treatment in paper.tags.treatment:
            entities.append(f"treatment:{resolve_alias(treatment)}")
        for gene in paper.tags.genes if hasattr(paper.tags, 'genes') else []:
            entities.append(f"gene:{resolve_alias(gene)}")

        # Add PMID/DOI as self-reference
        if paper.pmid:
            entities.append(f"pmid:{paper.pmid}")
        if paper.doi:
            entities.append(f"doi:{paper.doi}")

        paper.linked_entities = list(set(entities))

        logger.debug(
            "paper_linked",
            pmid=paper.pmid,
            linked_count=len(paper.linked_entities),
        )

        return paper
