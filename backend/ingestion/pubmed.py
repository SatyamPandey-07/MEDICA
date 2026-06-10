"""
MEDICA PubMed Adapter
Fetches papers from NCBI E-utilities API.
"""
from __future__ import annotations

import asyncio
import xml.etree.ElementTree as ET
from typing import AsyncGenerator

import json
import httpx

from core.config import settings
from core.logging import get_logger
from core.types import DataSource, RawPaper
from core.llm import LLMFactory
from ingestion.base import SourceAdapter
from shared.utils import normalize_pmid, parse_date

logger = get_logger(__name__)

PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
PUBMED_SEARCH = f"{PUBMED_BASE}/esearch.fcgi"
PUBMED_FETCH = f"{PUBMED_BASE}/efetch.fcgi"
PUBMED_SUMMARY = f"{PUBMED_BASE}/esummary.fcgi"


class PubMedAdapter(SourceAdapter):
    """
    Adapter for NCBI PubMed via E-utilities.
    Respects NCBI rate limits (3 req/s without key, 10 with).
    """

    source = DataSource.PUBMED

    def __init__(self) -> None:
        self._rate_limit = 1.0 / settings.pubmed_rate_limit  # seconds between requests
        self._client: httpx.AsyncClient | None = None

    def _base_params(self) -> dict[str, str]:
        params: dict[str, str] = {
            "db": "pubmed",
            "retmode": "xml",
            "tool": "MEDICA",
            "email": settings.ncbi_email,
        }
        if settings.ncbi_api_key:
            params["api_key"] = settings.ncbi_api_key
        return params

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def _rate_wait(self) -> None:
        await asyncio.sleep(self._rate_limit)

    async def _search_pmids(
        self, query: str, max_results: int, offset: int
    ) -> list[str]:
        """Search PubMed and return list of PMIDs."""
        client = await self._get_client()
        params = {
            **self._base_params(),
            "term": f"{query}[MeSH Terms] OR {query}[Title/Abstract]",
            "retmax": str(min(max_results, 200)),
            "retstart": str(offset),
            "sort": "relevance",
            "usehistory": "n",
        }
        try:
            resp = await client.get(PUBMED_SEARCH, params=params)
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
            pmids = [el.text for el in root.findall(".//Id") if el.text]
            logger.info("pubmed_search", query=query, found=len(pmids), offset=offset)
            return pmids
        except Exception as e:
            logger.error("pubmed_search_error", query=query, error=str(e))
            return []
        finally:
            await self._rate_wait()

    async def _fetch_details(self, pmids: list[str]) -> list[RawPaper]:
        """Fetch full paper details for a list of PMIDs."""
        if not pmids:
            return []
        client = await self._get_client()
        params = {
            **self._base_params(),
            "id": ",".join(pmids),
            "rettype": "abstract",
        }
        try:
            resp = await client.get(PUBMED_FETCH, params=params)
            resp.raise_for_status()
            return self._parse_fetch_xml(resp.text)
        except Exception as e:
            logger.error("pubmed_fetch_error", pmids=pmids[:5], error=str(e))
            return []
        finally:
            await self._rate_wait()

    def _parse_fetch_xml(self, xml_text: str) -> list[RawPaper]:
        """Parse PubMed efetch XML response into RawPaper objects."""
        papers = []
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            logger.error("pubmed_xml_parse_error")
            return []

        for article in root.findall(".//PubmedArticle"):
            try:
                paper = self._parse_article(article)
                if paper:
                    papers.append(paper)
            except Exception as e:
                logger.warning("pubmed_article_parse_error", error=str(e))
                continue

        return papers

    def _parse_article(self, article: ET.Element) -> RawPaper | None:
        """Parse a single PubmedArticle XML element."""
        medline = article.find("MedlineCitation")
        if medline is None:
            return None

        pmid_el = medline.find("PMID")
        pmid = pmid_el.text if pmid_el is not None else None

        art = medline.find("Article")
        if art is None:
            return None

        # Title
        title_el = art.find("ArticleTitle")
        title = "".join(title_el.itertext()).strip() if title_el is not None else ""
        if not title:
            return None

        # Abstract
        abstract_parts = []
        for ab in art.findall(".//AbstractText"):
            label = ab.get("Label", "")
            text = "".join(ab.itertext()).strip()
            if label:
                abstract_parts.append(f"**{label}**: {text}")
            elif text:
                abstract_parts.append(text)
        abstract = "\n\n".join(abstract_parts) if abstract_parts else None

        # Authors
        authors = []
        for author in art.findall(".//Author"):
            last = author.findtext("LastName", "")
            fore = author.findtext("ForeName", "")
            name = f"{last}, {fore}".strip(", ")
            if name:
                authors.append(name)

        # Journal
        journal_el = art.find(".//Journal/Title")
        journal = journal_el.text if journal_el is not None else None

        # Publication date
        pub_date_el = art.find(".//Journal/JournalIssue/PubDate")
        pub_date_str = None
        if pub_date_el is not None:
            year = pub_date_el.findtext("Year", "")
            month = pub_date_el.findtext("Month", "")
            day = pub_date_el.findtext("Day", "")
            parts_list = [p for p in [year, month, day] if p]
            pub_date_str = " ".join(parts_list) if parts_list else None

        # DOI
        doi = None
        for id_el in article.findall(".//ArticleIdList/ArticleId"):
            if id_el.get("IdType") == "doi":
                doi = id_el.text
                break

        # Keywords / MeSH
        keywords = []
        for kw in medline.findall(".//KeywordList/Keyword"):
            if kw.text:
                keywords.append(kw.text.strip())
        for mesh in medline.findall(".//MeshHeadingList/MeshHeading/DescriptorName"):
            if mesh.text:
                keywords.append(mesh.text.strip())

        return RawPaper(
            source=DataSource.PUBMED,
            external_id=normalize_pmid(pmid) if pmid else title,
            title=title,
            abstract=abstract,
            authors=authors,
            journal=journal,
            published_date=pub_date_str,
            doi=doi,
            pmid=normalize_pmid(pmid) if pmid else None,
            keywords=list(set(keywords)),
            raw_data={"pmid": pmid},
        )

    async def _expand_query(self, query: str) -> list[str]:
        """Expand the query into similar medical/oncology keywords and phrases using LLM."""
        if not settings.active_llm_key:
            logger.info("pubmed_query_expansion_skipped", reason="no_llm_key")
            return [query]

        try: 
            client = LLMFactory.get_client()
            
            system_prompt = (
                "You are a medical search optimizer. Expand the given oncology/medical keyword "
                "or phrase into a list of 3 to 5 highly relevant alternative search terms, synonyms, "
                "drug names (brand/generic), or clinical phrases to improve PubMed search coverage. "
                "Respond ONLY with a valid JSON array of strings. Do not include markdown code block formatting or explanations."
            )
            
            messages = [{"role": "user", "content": f"Expand this query: {query}"}]
            
            resp_text = await client.generate(
                messages=messages,
                temperature=0.1,
                max_tokens=500,
                system_prompt=system_prompt,
            )
            
            # Remove possible markdown formatting (like ```json ... ```)
            resp_text = resp_text.strip()
            if resp_text.startswith("```"):
                lines = resp_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                resp_text = "\n".join(lines).strip()
            
            expanded = json.loads(resp_text)
            if isinstance(expanded, list):
                expanded_terms = [str(t).strip() for t in expanded if t]
                if query not in expanded_terms:
                    expanded_terms.insert(0, query)
                logger.info("pubmed_query_expansion_success", query=query, expanded=expanded_terms)
                return expanded_terms
            else:
                logger.warning("pubmed_query_expansion_invalid_type", response=resp_text)
                return [query]
        except Exception as e:
            logger.warning("pubmed_query_expansion_failed", query=query, error=str(e))
            return [query]

    async def fetch_papers(
        self,
        query: str,
        max_results: int = 100,
        offset: int = 0,
    ) -> AsyncGenerator[RawPaper, None]:
        """Fetch papers from PubMed matching the query, with LLM query expansion."""
        expanded_terms = await self._expand_query(query)
        # Store on instance so callers (e.g. admin pipeline) can read them
        self.last_expanded_terms = expanded_terms
        logger.info("pubmed_fetch_expanded_terms", original=query, expanded=expanded_terms)

        seen_pmids = set()
        deduped_pmids = []
        for term in expanded_terms:
            search_limit = max(max_results + offset, 100)
            pmids = await self._search_pmids(term, max_results=search_limit, offset=0)
            for pmid in pmids:
                if pmid not in seen_pmids:
                    seen_pmids.add(pmid)
                    deduped_pmids.append(pmid)

        paginated_pmids = deduped_pmids[offset : offset + max_results]
        logger.info("pubmed_fetch_pmids_sliced", total_deduped=len(deduped_pmids), offset=offset, limit=max_results, to_fetch=len(paginated_pmids))

        batch_size = 50
        for i in range(0, len(paginated_pmids), batch_size):
            batch = paginated_pmids[i : i + batch_size]
            papers = await self._fetch_details(batch)
            for paper in papers:
                yield paper

    async def fetch_by_id(self, pmid: str) -> RawPaper | None:
        """Fetch a single paper by PMID."""
        papers = await self._fetch_details([normalize_pmid(pmid)])
        return papers[0] if papers else None

    async def fetch_citations(self, pmid: str) -> list[str]:
        """Fetch citation PMIDs for a given paper using elink."""
        client = await self._get_client()
        params = {
            **self._base_params(),
            "id": normalize_pmid(pmid),
            "linkname": "pubmed_pubmed_citedin",
            "cmd": "neighbor_score",
        }
        try:
            resp = await client.get(f"{PUBMED_BASE}/elink.fcgi", params=params)
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
            pmids = [el.text for el in root.findall(".//Id") if el.text]
            return pmids[:50]  # Limit citations
        except Exception as e:
            logger.error("pubmed_citations_error", pmid=pmid, error=str(e))
            return []
        finally:
            await self._rate_wait()

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
