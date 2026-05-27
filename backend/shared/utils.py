"""
MEDICA Shared Utilities
Markdown parsing, frontmatter handling, date helpers, text utilities.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml


# ============================================================
# Markdown + Frontmatter
# ============================================================

def parse_markdown(content: str) -> tuple[dict[str, Any], str]:
    """
    Parse a markdown file with YAML frontmatter.
    Returns (frontmatter_dict, body_text).
    """
    if not content.startswith("---"):
        return {}, content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content

    try:
        frontmatter = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError:
        frontmatter = {}

    body = parts[2].strip()
    return frontmatter, body


def render_markdown(frontmatter: dict[str, Any], body: str) -> str:
    """Render frontmatter dict + body into a full markdown string."""
    fm_yaml = yaml.dump(frontmatter, allow_unicode=True, default_flow_style=False, sort_keys=False)
    return f"---\n{fm_yaml}---\n\n{body}"


def extract_section(markdown_body: str, section_name: str) -> str | None:
    """
    Extract a named section from markdown body.
    Looks for ## Section Name or ### Section Name headers.
    """
    pattern = rf"^#{2,3}\s+{re.escape(section_name)}\s*$"
    lines = markdown_body.split("\n")

    in_section = False
    section_lines = []

    for line in lines:
        if re.match(pattern, line, re.IGNORECASE):
            in_section = True
            continue
        if in_section:
            if re.match(r"^#{2,3}\s+", line):
                break
            section_lines.append(line)

    return "\n".join(section_lines).strip() if section_lines else None


# ============================================================
# Text Normalization
# ============================================================

def slugify(text: str) -> str:
    """Convert text to filesystem-safe slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "_", text)
    return text.strip("_")


def truncate(text: str, max_chars: int = 500, suffix: str = "...") -> str:
    """Truncate text to max_chars, appending suffix if truncated."""
    if len(text) <= max_chars:
        return text
    return text[: max_chars - len(suffix)] + suffix


def normalize_doi(doi: str) -> str:
    """Normalize a DOI to lowercase without URL prefix."""
    doi = doi.strip()
    doi = re.sub(r"^https?://doi\.org/", "", doi, flags=re.IGNORECASE)
    doi = re.sub(r"^doi:", "", doi, flags=re.IGNORECASE)
    return doi.lower().strip()


def normalize_pmid(pmid: str | int) -> str:
    """Normalize a PubMed ID to string without prefix."""
    pmid_str = str(pmid).strip()
    pmid_str = re.sub(r"^pmid:?", "", pmid_str, flags=re.IGNORECASE)
    return pmid_str.strip()


# ============================================================
# Deduplication
# ============================================================

def paper_fingerprint(title: str, pmid: str | None = None, doi: str | None = None) -> str:
    """Generate a stable fingerprint for deduplication."""
    if pmid:
        return f"pmid:{normalize_pmid(pmid)}"
    if doi:
        return f"doi:{normalize_doi(doi)}"
    # Fall back to title hash
    title_clean = re.sub(r"\W+", " ", title.lower()).strip()
    return f"title:{hashlib.md5(title_clean.encode()).hexdigest()[:16]}"


# ============================================================
# Date Parsing
# ============================================================

_DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y %b %d",
    "%Y %B %d",
    "%b %Y",
    "%B %Y",
    "%Y",
]


def parse_date(date_str: str | None) -> datetime | None:
    """Try to parse a date string in multiple formats."""
    if not date_str:
        return None
    date_str = date_str.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


# ============================================================
# File Utilities
# ============================================================

def ensure_dir(path: Path) -> Path:
    """Create directory if it doesn't exist, return path."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def safe_write(path: Path, content: str, encoding: str = "utf-8") -> None:
    """Write content to file, creating parent directories as needed."""
    ensure_dir(path.parent)
    path.write_text(content, encoding=encoding)


def safe_read(path: Path, encoding: str = "utf-8") -> str | None:
    """Read file content, return None if file doesn't exist."""
    if not path.exists():
        return None
    return path.read_text(encoding=encoding)


# ============================================================
# Oncology Alias Map
# ============================================================

ONCOLOGY_ALIASES: dict[str, str] = {
    # Cancer types
    "nsclc": "non_small_cell_lung_cancer",
    "sclc": "small_cell_lung_cancer",
    "gbm": "glioblastoma",
    "glioblastoma multiforme": "glioblastoma",
    "tnbc": "triple_negative_breast_cancer",
    "crc": "colorectal_cancer",
    "hcc": "hepatocellular_carcinoma",
    "rcc": "renal_cell_carcinoma",
    "pda": "pancreatic_ductal_adenocarcinoma",
    "pdac": "pancreatic_ductal_adenocarcinoma",
    "aml": "acute_myeloid_leukemia",
    "cll": "chronic_lymphocytic_leukemia",
    "dlbcl": "diffuse_large_b_cell_lymphoma",
    "mm": "multiple_myeloma",
    # Biomarkers / genes
    "pdl1": "pd-l1",
    "pd l1": "pd-l1",
    "pd-l 1": "pd-l1",
    "her-2": "her2",
    "her 2": "her2",
    "erbb2": "her2",
    "egfr": "egfr",
    "kras": "kras",
    "braf": "braf",
    "brca": "brca",
    "brca-1": "brca1",
    "brca-2": "brca2",
    "tp53": "tp53",
    "p53": "tp53",
    "alk": "alk",
    "ros1": "ros1",
    "met": "met",
    "msi": "microsatellite_instability",
    "msi-h": "msi_high",
    "tmb": "tumor_mutational_burden",
    "tmb-h": "tmb_high",
    "mmr": "mismatch_repair",
    "dmmr": "deficient_mismatch_repair",
    # Drugs / treatments
    "pembrolizumab": "pembrolizumab",
    "keytruda": "pembrolizumab",
    "nivolumab": "nivolumab",
    "opdivo": "nivolumab",
    "atezolizumab": "atezolizumab",
    "tecentriq": "atezolizumab",
    "durvalumab": "durvalumab",
    "imfinzi": "durvalumab",
    "ipilimumab": "ipilimumab",
    "yervoy": "ipilimumab",
    "trastuzumab": "trastuzumab",
    "herceptin": "trastuzumab",
    "bevacizumab": "bevacizumab",
    "avastin": "bevacizumab",
    "osimertinib": "osimertinib",
    "tagrisso": "osimertinib",
    "olaparib": "olaparib",
    "lynparza": "olaparib",
}


def resolve_alias(term: str) -> str:
    """Resolve an oncology alias to its canonical form."""
    key = term.lower().strip()
    return ONCOLOGY_ALIASES.get(key, key)
