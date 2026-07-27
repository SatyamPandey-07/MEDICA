"""
MEDICA Paper Comparison API
Ad-hoc multi-layer comparison: submit a new paper (PDF upload or pasted
title/abstract) and rank it against related papers already in the knowledge
base, mirroring the multi-layer pipeline notebook's new-paper-vs-corpus
workflow directly (independent of the ingestion pipeline's verification step).
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import select

from analysis.pipeline import AnalysisSubject, MultiLayerPipeline
from core.logging import get_logger
from indexing.metadata import MetadataIndex
from shared.database import get_session
from shared.models import ClaimRecord

logger = get_logger(__name__)
router = APIRouter(prefix="/analysis", tags=["analysis"])

_MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25MB
_DEFAULT_CANDIDATE_LIMIT = 10


async def _fetch_claims(paper_id: UUID) -> list[str]:
    async with get_session() as session:
        result = await session.execute(
            select(ClaimRecord.claim_text).where(ClaimRecord.paper_id == paper_id)
        )
        return [row[0] for row in result.all()]


def _derive_title(text: str, fallback: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("title:"):
            return stripped.split(":", 1)[1].strip()
        if stripped:
            return stripped[:150]
    return fallback


@router.post("/compare")
async def compare_paper(
    file: UploadFile | None = File(None),
    title: str | None = Form(None),
    abstract: str | None = Form(None),
    cancer_type: str | None = Form(None),
    candidate_limit: int = Form(_DEFAULT_CANDIDATE_LIMIT, ge=1, le=25),
):
    """
    Compare a new paper (PDF upload, with OCR fallback for scanned pages, or
    pasted title/abstract) against related papers already in the knowledge
    base using the 5-layer multi-layer analysis pipeline (keyword, embedding,
    topic, entity, claim) — weighted claim 35% / topic 25% / embedding 20% /
    keyword 10% / entity 10%.
    """
    ocr_used = False
    num_pages: int | None = None

    if file is not None:
        data = await file.read()
        if len(data) > _MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="PDF exceeds the 25MB upload limit.")
        from analysis.pdf_extractor import extract_text_from_bytes
        try:
            extracted_text, ocr_used, num_pages = extract_text_from_bytes(data)
        except Exception as e:
            logger.error("compare_pdf_extraction_failed", error=str(e))
            raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}") from e
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="No extractable text found in the uploaded PDF.")
        paper_title = title or _derive_title(extracted_text, file.filename or "Uploaded paper")
        paper_text = f"{paper_title}\n\n{extracted_text}"
    elif title and abstract:
        paper_title = title
        paper_text = f"{title}\n\n{abstract}"
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either a PDF file, or both title and abstract.",
        )

    metadata_index = MetadataIndex()
    if cancer_type:
        records = await metadata_index.filter_papers(cancer_tags=[cancer_type], limit=candidate_limit)
    else:
        records = await metadata_index.filter_papers(limit=candidate_limit)

    candidates: list[AnalysisSubject] = []
    for record in records:
        if not record.abstract:
            continue
        candidates.append(AnalysisSubject(
            id=str(record.id),
            title=record.title,
            text=f"{record.title}\n\n{record.abstract}",
            provided_keywords=record.keywords or [],
            provided_claims=await _fetch_claims(record.id),
        ))

    if not candidates:
        raise HTTPException(
            status_code=404,
            detail="No comparable papers found in the knowledge base for the given filter.",
        )

    new_subject = AnalysisSubject(id="new_paper", title=paper_title, text=paper_text)

    pipeline = MultiLayerPipeline()
    result = await pipeline.compare(new_subject, candidates)

    logger.info(
        "paper_comparison_complete",
        title=paper_title[:60],
        candidates=len(candidates),
        top_score=result.candidates[0].overall_score if result.candidates else None,
    )

    return {
        "ocr_used": ocr_used,
        "num_pages": num_pages,
        "candidate_pool_size": len(candidates),
        "cancer_type_filter": cancer_type,
        **result.model_dump(),
    }
