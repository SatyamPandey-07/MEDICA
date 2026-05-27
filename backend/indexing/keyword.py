"""
MEDICA Keyword Index
Full-text search using ripgrep (filesystem) and PostgreSQL FTS.
"""
from __future__ import annotations

import asyncio
import subprocess
from pathlib import Path

from core.config import settings
from core.logging import get_logger

logger = get_logger(__name__)


class KeywordIndex:
    """
    Keyword search against the markdown knowledge base using ripgrep.

    ripgrep (rg) provides extremely fast regex/literal search across
    the filesystem knowledge base — faster than any DB for raw text search.
    """

    def __init__(self) -> None:
        self.knowledge_path = Path(settings.knowledge_base_path)

    async def search(
        self,
        query: str,
        max_results: int = 20,
        file_pattern: str = "*.md",
    ) -> list[dict]:
        """
        Search the knowledge filesystem using ripgrep.

        Returns list of dicts with:
          - path: file path
          - line_number: matching line
          - line_content: the matching text
          - context: surrounding lines
        """
        if not self.knowledge_path.exists():
            return []

        cmd = [
            "rg",
            "--json",
            "--max-count", "3",     # Max 3 matches per file
            "--max-filesize", "10M",
            "--glob", file_pattern,
            "--ignore-case",
            "--context", "2",       # 2 lines of context
            query,
            str(self.knowledge_path),
        ]

        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=10,
                ),
            )

            if result.returncode not in (0, 1):  # 1 = no matches
                logger.warning("ripgrep_error", stderr=result.stderr[:200])
                return []

            import json
            results = []
            file_hits: dict[str, dict] = {}

            for line in result.stdout.strip().split("\n"):
                if not line:
                    continue
                try:
                    item = json.loads(line)
                    if item.get("type") == "match":
                        data = item["data"]
                        path = data["path"]["text"]
                        if path not in file_hits:
                            file_hits[path] = {
                                "path": path,
                                "matches": [],
                            }
                        file_hits[path]["matches"].append({
                            "line_number": data["line_number"],
                            "line_content": data["lines"]["text"].strip(),
                        })
                except (json.JSONDecodeError, KeyError):
                    continue

            results = list(file_hits.values())[:max_results]
            logger.debug("ripgrep_search", query=query, hits=len(results))
            return results

        except FileNotFoundError:
            # ripgrep not installed — graceful degradation
            logger.warning("ripgrep_not_found", msg="Install ripgrep for filesystem search")
            return []
        except subprocess.TimeoutExpired:
            logger.warning("ripgrep_timeout", query=query)
            return []

    async def search_by_pmid(self, pmid: str) -> list[dict]:
        """Find all knowledge files mentioning a specific PMID."""
        return await self.search(f"pmid_{pmid}", file_pattern="*.md")

    async def search_by_tag(self, tag: str) -> list[dict]:
        """Find all knowledge files with a specific tag in frontmatter."""
        return await self.search(f"- {tag}", file_pattern="*.md")
