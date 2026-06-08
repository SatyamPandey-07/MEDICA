/**
 * GET /api/admin/verification/papers?status=all|verified|unverified|disputed|pending
 * List papers filtered by verification status.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "all";

  try {
    const whereClause = status !== "all" ? "WHERE verification_status = $1" : "";
    const params = status !== "all" ? [status] : [];

    const res = await query(
      `SELECT id, title, pmid, doi, journal, published,
              verification_status, confidence_score, evidence_level, tags
       FROM paper_records
       ${whereClause}
       ORDER BY confidence_score DESC
       LIMIT 100`,
      params
    );

    return NextResponse.json(
      res.rows.map((p) => ({
        id: p.id,
        title: p.title,
        pmid: p.pmid,
        doi: p.doi,
        journal: p.journal,
        published: p.published,
        verification_status: p.verification_status,
        confidence_score: p.confidence_score ?? 0,
        evidence_level: p.evidence_level ?? "unknown",
        flags: (p.tags as Record<string, string[]>)?.evidence ?? [],
      }))
    );
  } catch (err) {
    console.error("verification_papers_error", err);
    return NextResponse.json([]);
  }
}
