"""
MEDICA PDF Text Extraction
Extracts text from PDF papers with OCR fallback for scanned/image-only pages.
Ported from the multi-layer pipeline notebook (PyMuPDF + pytesseract).
"""
from __future__ import annotations

from core.logging import get_logger

logger = get_logger(__name__)

# A page is considered "text-bearing" once it yields more than this many
# non-whitespace characters from the PDF's embedded text layer; otherwise
# it's treated as scanned and routed through OCR.
_MIN_TEXT_LAYER_CHARS = 50


def _ocr_page(page) -> str:
    """Rasterize a PDF page and run Tesseract OCR on it."""
    from io import BytesIO

    import pytesseract
    from PIL import Image

    pix = page.get_pixmap(dpi=150)
    img = Image.open(BytesIO(pix.tobytes("png")))
    try:
        return pytesseract.image_to_string(img)
    except Exception as e:
        logger.warning("pdf_ocr_page_failed", error=str(e))
        return f"[OCR failed: {e}]"


def _extract(doc) -> tuple[str, bool, int]:
    text = ""
    ocr_used = False
    for page in doc:
        page_text = page.get_text()
        if len(page_text.strip()) > _MIN_TEXT_LAYER_CHARS:
            text += page_text + "\n"
        else:
            ocr_used = True
            text += _ocr_page(page) + "\n"
    num_pages = len(doc)
    doc.close()
    return text.strip(), ocr_used, num_pages


def extract_text_from_pdf(path: str) -> tuple[str, bool, int]:
    """
    Extract text from a PDF file on disk.

    Returns (text, ocr_was_used, num_pages).
    """
    import fitz  # PyMuPDF

    doc = fitz.open(path)
    return _extract(doc)


def extract_text_from_bytes(data: bytes) -> tuple[str, bool, int]:
    """
    Extract text from in-memory PDF bytes (e.g. an uploaded file).

    Returns (text, ocr_was_used, num_pages).
    """
    import fitz  # PyMuPDF

    doc = fitz.open(stream=data, filetype="pdf")
    return _extract(doc)
