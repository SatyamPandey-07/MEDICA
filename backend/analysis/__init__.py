"""
MEDICA Multi-Layer Analysis Package
Ports the 5-layer paper-comparison pipeline (keyword / embedding / topic /
entity / claim analysis) into reusable, async, production services.

Heavy ML dependencies (spaCy, transformers, KeyBERT, YAKE, RAKE, PyMuPDF,
pytesseract, Groq) are imported lazily inside functions so that importing
this package never fails on deployments that don't install
`requirements-analysis.txt` (e.g. the Vercel serverless backend). Only
actually calling into a layer requires those packages to be installed.
"""
from __future__ import annotations

from analysis.pipeline import AnalysisSubject, MultiLayerPipeline, WEIGHTS

__all__ = ["AnalysisSubject", "MultiLayerPipeline", "WEIGHTS"]
