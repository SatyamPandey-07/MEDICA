/**
 * MEDICA API Client
 * Coordinates requests to the FastAPI backend, including POST-based SSE streaming for the ReAct agent.
 */

import {
  PaperMetadata,
  RetrievalResult,
  ChatSession,
  ChatMessage,
  IngestionJob,
  VerificationStats,
  KnowledgePaper,
  VerificationPaper,
  GraphNetwork,
  GraphStats,
  GraphRebuildResult,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

const DEFAULT_TIMEOUT_MS = 10_000; // 10 seconds — prevents UI hanging on slow/dead backends

/**
 * Generic fetch wrapper with:
 * - Automatic 10-second timeout via AbortController
 * - Structured error messages including HTTP status
 */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`API Error [${response.status}]: ${errorText}`);
    }

    return response.json() as Promise<T>;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`API request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s: ${endpoint}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry wrapper with exponential backoff for transient failures.
 * Retries on network errors or 5xx responses, up to `maxRetries` additional attempts.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, baseDelayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err as Error)?.message ?? "";
      // Only retry on network / timeout / 5xx errors — not 4xx client errors
      const isRetryable =
        msg.includes("timed out") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        /API Error \[5\d\d\]/.test(msg);
      if (!isRetryable || attempt === maxRetries) break;
      await new Promise((res) => setTimeout(res, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr;
}

// ============================================================
// Chat API
// ============================================================

export async function listSessions(): Promise<ChatSession[]> {
  return withRetry(() => apiFetch<ChatSession[]>("/chat/sessions"));
}

export async function getSession(sessionId: string): Promise<{
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}> {
  return apiFetch<{
    id: string;
    title: string;
    messages: ChatMessage[];
    created_at: string;
    updated_at: string;
  }>(`/chat/sessions/${sessionId}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch<void>(`/chat/sessions/${sessionId}`, { method: "DELETE" });
}

/**
 * Modern SSE POST stream consumer using ReadableStream.
 * Handles partial chunks and splits natively without external libraries.
 */
export async function streamChat(
  message: string,
  sessionId: string | null,
  onEvent: (event: {
    type: "session_init" | "thought" | "call" | "observation" | "chunk" | "done";
    content?: string;
    session_id?: string;
  }) => void,
  onError?: (err: Error) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, session_id: sessionId }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Chat request failed [${response.status}]: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Server response body is not readable.");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      // Keep last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6).trim();
          try {
            const data = JSON.parse(jsonStr);
            onEvent(data);
          } catch (e) {
            console.error("Failed to parse SSE message JSON:", jsonStr, e);
          }
        }
      }
    }
  } catch (error: unknown) {
    if (onError) {
      onError(toError(error));
    } else {
      console.error("SSE stream error:", error);
    }
  }
}

// ============================================================
// Search & Paper API
// ============================================================

export async function search(
  query: string,
  limit: number = 10,
  strategy: string = "hybrid"
): Promise<RetrievalResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit), strategy });
  return withRetry(() => apiFetch<RetrievalResult[]>(`/search?${params}`));
}

export async function getPaper(paperId: string): Promise<PaperMetadata> {
  return apiFetch<PaperMetadata>(`/papers/${paperId}`);
}

// ============================================================
// Knowledge base & Filesystem API
// ============================================================

export async function listCancerTypes(): Promise<string[]> {
  return apiFetch<string[]>("/knowledge/cancer-types");
}

export async function listKnowledgePapers(cancerType?: string): Promise<KnowledgePaper[]> {
  const suffix = cancerType ? `?cancer_type=${encodeURIComponent(cancerType)}` : "";
  return apiFetch<KnowledgePaper[]>(`/knowledge/papers${suffix}`);
}

export async function getGraphStats(): Promise<GraphStats> {
  return apiFetch<GraphStats>("/knowledge/graph/stats");
}

export async function getGraphNetwork(): Promise<GraphNetwork> {
  return apiFetch<GraphNetwork>("/knowledge/graph");
}

// ============================================================
// Admin & Ingestion Jobs API
// ============================================================

export async function listIngestionJobs(): Promise<IngestionJob[]> {
  return apiFetch<IngestionJob[]>("/admin/jobs");
}

export async function triggerIngestionJob(
  query: string,
  limit: number = 10,
  source: string = "pubmed"
): Promise<{ status: string; job_id: string; message: string }> {
  return apiFetch<{ status: string; job_id: string; message: string }>("/admin/jobs/trigger", {
    method: "POST",
    body: JSON.stringify({ query, limit, source }),
  });
}

export async function getVerificationStats(): Promise<VerificationStats> {
  return apiFetch<VerificationStats>("/admin/verification/stats");
}

export async function listVerificationPapers(
  status: string = "all",
  sortBy: string = "confidence",
  limit: number = 100
): Promise<VerificationPaper[]> {
  return apiFetch<VerificationPaper[]>(`/admin/verification/papers?status=${status}&sort_by=${sortBy}&limit=${limit}`);
}

export async function triggerOptimization(): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>("/admin/optimize", {
    method: "POST",
  });
}

export async function rebuildKnowledgeGraph(): Promise<GraphRebuildResult> {
  return apiFetch<GraphRebuildResult>("/admin/graph/rebuild", { method: "POST" });
}

export async function getHealth(): Promise<{
  status: string;
  environment: string;
  database: string;
  llm_provider: string;
  embedding_provider: string;
  knowledge_graph: GraphStats;
}> {
  return withRetry(() =>
    apiFetch<{
      status: string;
      environment: string;
      database: string;
      llm_provider: string;
      embedding_provider: string;
      knowledge_graph: GraphStats;
    }>("/health")
  );
}
