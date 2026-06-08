/**
 * GET /api/papers/[id]
 * Retrieve paper details by UUID or PMID.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Try as UUID first, then as PMID
    const isUUID = /^[0-9a-f-]{36}$/i.test(id);
    const col = isUUID ? "id" : "pmid";
    const lookupVal = id.replace(/^pmid_/, "").replace(/^doi_/, "");

    const res = await query(
      `SELECT id, title, pmid, doi, journal, published, authors, source,
              verification_status, confidence_score, evidence_level, study_type,
              trial_phase, tags, abstract, keywords
       FROM paper_records WHERE ${col} = $1 LIMIT 1`,
      [lookupVal]
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ detail: "Paper not found" }, { status: 404 });
    }

    const r = res.rows[0] as Record<string, unknown>;
    return NextResponse.json({
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
    });
  } catch (err) {
    console.error("get_paper_error", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
