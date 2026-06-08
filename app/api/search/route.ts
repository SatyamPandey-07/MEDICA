/**
 * GET /api/search?q=...&limit=...&strategy=...
 * Hybrid search: pgvector semantic + PostgreSQL full-text, merged and ranked.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { embedText } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);
  const strategy = searchParams.get("strategy") ?? "hybrid";

  if (!q) return NextResponse.json([]);

  try {
    const results: {
      score: number;
      strategy: string;
      paper: Record<string, unknown>;
    }[] = [];

    const seen = new Set<string>();

    // ── Semantic search (pgvector) ──────────────────────────────────────────
    if (strategy === "semantic" || strategy === "hybrid") {
      try {
        const embedding = await embedText(q);
        const vectorStr = `[${embedding.join(",")}]`;
        const semRes = await query<{ paper_id: string; similarity: number }>(
          `SELECT paper_id, 1 - (vector <=> $1::vector) AS similarity
           FROM paper_embeddings
           WHERE embedding_type = 'abstract'
           ORDER BY vector <=> $1::vector
           LIMIT $2`,
          [vectorStr, limit]
        );
        for (const row of semRes.rows) {
          if (!seen.has(row.paper_id)) {
            seen.add(row.paper_id);
            const paper = await getPaperById(row.paper_id);
            if (paper) results.push({ score: row.similarity * 0.65, strategy: "semantic", paper });
          }
        }
      } catch (e) {
        console.warn("semantic_search_failed", e);
      }
    }

    // ── Full-text search ───────────────────────────────────────────────────
    if (strategy === "keyword" || strategy === "hybrid") {
      const ftRes = await query<{ id: string; rank: number }>(
        `SELECT id, ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,'')),
                plainto_tsquery('english', $1)) AS rank
         FROM paper_records
         WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,'')) @@ plainto_tsquery('english', $1)
         ORDER BY rank DESC
         LIMIT $2`,
        [q, limit]
      );
      for (const row of ftRes.rows) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          const paper = await getPaperById(row.id);
          if (paper) results.push({ score: row.rank * 0.35, strategy: "keyword", paper });
        }
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return NextResponse.json(results.slice(0, limit));
  } catch (err) {
    console.error("search_error", err);
    return NextResponse.json({ detail: `Search failed: ${err}` }, { status: 500 });
  }
}

async function getPaperById(id: string): Promise<Record<string, unknown> | null> {
  const res = await query(
    `SELECT id, title, pmid, doi, journal, published, authors, source,
            verification_status, confidence_score, evidence_level, study_type,
            trial_phase, tags, abstract, keywords
     FROM paper_records WHERE id = $1`,
    [id]
  );
  if (res.rowCount === 0) return null;
  const r = res.rows[0] as Record<string, unknown>;
  return {
    id: r.id,
    title: r.title,
    pmid: r.pmid,
    doi: r.doi,
    journal: r.journal,
    published: r.published,
    authors: r.authors ?? [],
    source: r.source ?? "pubmed",
    verification_status: r.verification_status ?? "unverified",
    confidence_score: r.confidence_score ?? 0,
    evidence_level: r.evidence_level ?? "unknown",
    study_type: r.study_type ?? "other",
    trial_phase: r.trial_phase,
    tags: r.tags,
    abstract: r.abstract,
    keywords: r.keywords ?? [],
    linked_entities: [],
    related_papers: [],
    contradictory_papers: [],
    citation_count: 0,
  };
}
