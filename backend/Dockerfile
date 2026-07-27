# ── Build stage ──────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies for psycopg2 and other C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (base app + multi-layer analysis pipeline)
COPY requirements.txt requirements-analysis.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r requirements-analysis.txt

# Pre-download the spaCy model and NLTK corpora used by the analysis pipeline
# so the runtime image never needs network access to fetch them.
RUN python -m spacy download en_core_web_sm && \
    python -m nltk.downloader -d /usr/local/nltk_data stopwords punkt punkt_tab

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Install runtime system libraries, including Tesseract OCR for scanned PDFs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    tesseract-ocr \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages, spaCy model, and NLTK corpora from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /usr/local/nltk_data /usr/local/nltk_data
ENV NLTK_DATA=/usr/local/nltk_data

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose the API port
EXPOSE 8000

# Run migrations then start server
CMD ["sh", "-c", "python migrate_v2.py && uvicorn api.main:app --host 0.0.0.0 --port 8000"]
