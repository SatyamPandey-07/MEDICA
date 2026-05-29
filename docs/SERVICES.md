# 🛠️ OncologyAgent: Service Definitions

This document details the research sources integrated into the OncologyAgent and the specific strategies used to manage their APIs.

## 🔌 Integrated Services

The agent communicates with 16+ research platforms through a modular service layer.

| Service | Module | Logic | Strategy |
| :--- | :--- | :--- | :--- |
| **PubMed** | `pubmed_service.py` | E-Utilities API | 2-step fetch (Search -> Fetch Metadata) |
| **ArXiv** | `arxiv_service.py` | Atom Feed API | Strict rate-limiting + 5s initial delay |
| **bioRxiv** | `biorxiv_service.py` | bioRxiv/medRxiv REST | Volume-based endpoint selection |
| **Semantic Scholar** | `rest_services.py` | Graph API | Browser-mimicry + 10s backoff |
| **OpenAlex** | `rest_services.py` | REST API | Polite contact (email) + retry logic |
| **Europe PMC** | `rest_services.py` | Core Search API | Standardized browser signature |
| **ClinicalTrials** | `rest_services_v2.py` | V2 Search API | Protocol-specific mapping |
| **CORE** | `rest_services_v2.py` | V3 Search API | POST-based searching + auth headers |
| **Specialized** | `rest_services_v3.py` | GDC, cBioPortal | NCI-specific data retrieval |

## 🛡️ Resilience & Throttling Strategies

To ensure uninterrupted operation in a multi-agent environment, the following strategies are enforced:

### 1. Browser Signature Mimicry
Most APIs are sensitive to the default `User-Agent` used by Python libraries. We standardize on a Chrome/Mac signature for all outgoing requests.

### 2. Mandatory Patience Delays
Certain APIs (like Semantic Scholar) are extremely sensitive to burst traffic. We implement a mandatory initial delay *before* the first request of a cycle to "warm up" the connection and ensure we don't trip rate limits instantly.

### 3. Exponential Backoff
All services follow a unified retry pattern:
*   **Attempt 1**: Initial delay (5-10s).
*   **Attempt 2**: 2x delay.
*   **Attempt 3**: 4x delay.
*   **Failure**: Trips the circuit breaker for that source for the current cycle.

### 4. Global Jitter
The `IngestionService` applies a random jitter (0.5x to 1.5x) to all inter-source delays. This ensures that the agent's traffic pattern doesn't become predictable, which is a common trigger for firewall-level blocking.

## 📊 Normalization
All results are normalized into a standard schema before persistence, ensuring that different sources (XML vs JSON) appear identical to downstream agents consuming the data.
