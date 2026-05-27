"""
MEDICA Knowledge Graph
Maintains semantic relationships between oncology entities.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
import json

from core.logging import get_logger
from core.types import PaperMetadata

logger = get_logger(__name__)

GRAPH_PATH = Path("./data/knowledge_graph.json")


@dataclass
class EntityNode:
    """A node in the oncology knowledge graph."""
    name: str
    entity_type: str  # cancer | drug | biomarker | gene | treatment
    paper_ids: list[str] = field(default_factory=list)
    related: list[str] = field(default_factory=list)


class KnowledgeGraph:
    """
    In-memory oncology knowledge graph with persistence.

    Maintains edges between:
      - drug ↔ biomarker (targeted therapies)
      - biomarker ↔ cancer (precision oncology)
      - paper ↔ paper (citation/contradiction)
      - treatment ↔ cancer (evidence mapping)

    Persists to JSON for fast reload.
    """

    def __init__(self) -> None:
        self.nodes: dict[str, EntityNode] = {}
        self.edges: dict[str, set[str]] = defaultdict(set)
        self._load()

    def _load(self) -> None:
        if GRAPH_PATH.exists():
            try:
                data = json.loads(GRAPH_PATH.read_text())
                for key, node_data in data.get("nodes", {}).items():
                    self.nodes[key] = EntityNode(**node_data)
                for key, neighbors in data.get("edges", {}).items():
                    self.edges[key] = set(neighbors)
                logger.info("knowledge_graph_loaded", nodes=len(self.nodes), edges=len(self.edges))
            except Exception as e:
                logger.warning("knowledge_graph_load_error", error=str(e))

    def save(self) -> None:
        GRAPH_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "nodes": {k: {"name": v.name, "entity_type": v.entity_type, "paper_ids": v.paper_ids, "related": v.related} for k, v in self.nodes.items()},
            "edges": {k: list(v) for k, v in self.edges.items()},
        }
        GRAPH_PATH.write_text(json.dumps(data, indent=2))

    def add_paper(self, paper: PaperMetadata) -> None:
        """Register a paper's entities in the graph."""
        paper_ref = f"paper:{paper.pmid or paper.doi or str(paper.id)}"

        # Register cancer nodes
        for cancer in paper.tags.cancer:
            node_key = f"cancer:{cancer}"
            if node_key not in self.nodes:
                self.nodes[node_key] = EntityNode(name=cancer, entity_type="cancer")
            self.nodes[node_key].paper_ids.append(paper_ref)

        # Register drug nodes and link to cancers
        for drug in paper.tags.drugs:
            drug_key = f"drug:{drug}"
            if drug_key not in self.nodes:
                self.nodes[drug_key] = EntityNode(name=drug, entity_type="drug")
            self.nodes[drug_key].paper_ids.append(paper_ref)
            # Link drug ↔ cancer
            for cancer in paper.tags.cancer:
                cancer_key = f"cancer:{cancer}"
                self.edges[drug_key].add(cancer_key)
                self.edges[cancer_key].add(drug_key)

        # Register biomarker nodes and link
        for biomarker in paper.tags.biomarkers:
            bio_key = f"biomarker:{biomarker}"
            if bio_key not in self.nodes:
                self.nodes[bio_key] = EntityNode(name=biomarker, entity_type="biomarker")
            self.nodes[bio_key].paper_ids.append(paper_ref)
            # Link biomarker ↔ cancer and biomarker ↔ drug
            for cancer in paper.tags.cancer:
                cancer_key = f"cancer:{cancer}"
                self.edges[bio_key].add(cancer_key)
                self.edges[cancer_key].add(bio_key)
            for drug in paper.tags.drugs:
                drug_key = f"drug:{drug}"
                self.edges[bio_key].add(drug_key)
                self.edges[drug_key].add(bio_key)

    def get_related(self, entity_key: str, max_depth: int = 2) -> list[str]:
        """BFS traversal to get related entities up to max_depth."""
        visited: set[str] = {entity_key}
        frontier = {entity_key}
        for _ in range(max_depth):
            next_frontier: set[str] = set()
            for node in frontier:
                for neighbor in self.edges.get(node, set()):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        next_frontier.add(neighbor)
            frontier = next_frontier
        visited.discard(entity_key)
        return list(visited)

    def get_node(self, entity_key: str) -> EntityNode | None:
        return self.nodes.get(entity_key)

    def stats(self) -> dict:
        return {
            "total_nodes": len(self.nodes),
            "total_edges": sum(len(v) for v in self.edges.values()),
            "cancer_nodes": sum(1 for k in self.nodes if k.startswith("cancer:")),
            "drug_nodes": sum(1 for k in self.nodes if k.startswith("drug:")),
            "biomarker_nodes": sum(1 for k in self.nodes if k.startswith("biomarker:")),
        }


# Global singleton graph
graph = KnowledgeGraph()
