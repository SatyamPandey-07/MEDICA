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
} from "./types";

const API_BASE = "/api";

// Generic fetch wrapper
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
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
}

// ============================================================
// Chat API
// ============================================================

export async function listSessions(): Promise<ChatSession[]> {
  return apiFetch<ChatSession[]>("/chat/sessions");
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
  } catch (error: any) {
    if (onError) {
      onError(error);
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
  return apiFetch<RetrievalResult[]>(`/search?${params}`);
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

export async function listKnowledgePapers(cancerType?: string): Promise<any[]> {
  const suffix = cancerType ? `?cancer_type=${encodeURIComponent(cancerType)}` : "";
  return apiFetch<any[]>(`/knowledge/papers${suffix}`);
}

export async function getGraphStats(): Promise<{
  total_nodes: number;
  total_edges: number;
  cancer_nodes: number;
  drug_nodes: number;
  biomarker_nodes: number;
}> {
  return apiFetch<any>("/knowledge/graph/stats");
}

export async function getGraphNetwork(): Promise<{
  nodes: Array<{ id: string; label: string; type: string; papers_count: number }>;
  edges: Array<{ source: string; target: string }>;
}> {
  return apiFetch<{
    nodes: Array<{ id: string; label: string; type: string; papers_count: number }>;
    edges: Array<{ source: string; target: string }>;
  }>("/knowledge/graph");
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
  status: string = "all"
): Promise<
  Array<{
    id: string;
    title: string;
    pmid?: string;
    doi?: string;
    journal?: string;
    published?: string;
    verification_status: string;
    confidence_score: number;
    evidence_level: string;
    flags: string[];
  }>
> {
  return apiFetch<any[]>(`/admin/verification/papers?status=${status}`);
}

export async function triggerOptimization(): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>("/admin/optimize", {
    method: "POST",
  });
}

export async function rebuildKnowledgeGraph(): Promise<{
  status: string;
  papers_processed: number;
  nodes: number;
  edges: number;
  cancer_nodes: number;
  drug_nodes: number;
  biomarker_nodes: number;
}> {
  return apiFetch<any>("/admin/graph/rebuild", { method: "POST" });
}
