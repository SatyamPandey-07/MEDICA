/**
 * GET /api/knowledge/papers?cancer_type=...
 * List papers from PostgreSQL, optionally filtered by cancer type tag.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const cancerType = searchParams.get("cancer_type");

  try {
    let sql: string;
    let params: unknown[];

    if (cancerType) {
      sql = `SELECT id, title, pmid, doi, journal, published, authors, source,
                    verification_status, confidence_score, evidence_level, study_type,
                    trial_phase, tags, abstract, keywords
             FROM paper_records
             WHERE tags->'cancer' @> $1::jsonb
             ORDER BY updated_at DESC NULLS LAST, created_at DESC
             LIMIT 200`;
      params = [JSON.stringify([cancerType])];
    } else {
      sql = `SELECT id, title, pmid, doi, journal, published, authors, source,
                    verification_status, confidence_score, evidence_level, study_type,
                    trial_phase, tags, abstract, keywords
             FROM paper_records
             ORDER BY updated_at DESC NULLS LAST, created_at DESC
             LIMIT 200`;
      params = [];
    }

    const res = await query(sql, params);

    return NextResponse.json(
      res.rows.map((r) => ({
        id: r.id,
        title: r.title,
        pmid: r.pmid,
        doi: r.doi,
        journal: r.journal,
        published: r.published,
        authors: r.authors ?? [],
        source: r.source,
        verification_status: r.verification_status,
        confidence_score: r.confidence_score,
        evidence_level: r.evidence_level,
        study_type: r.study_type,
        trial_phase: r.trial_phase,
        tags: r.tags,
        abstract: r.abstract,
        keywords: r.keywords ?? [],
        linked_entities: [],
        related_papers: [],
        contradictory_papers: [],
        citation_count: 0,
      }))
    );
  } catch (err) {
    console.error("knowledge_papers_error", err);
    return NextResponse.json([]);
  }
}
