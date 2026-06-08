/**
 * GET /api/admin/verification/stats
 * Aggregated evidence audit metrics from PostgreSQL.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [statusRes, levelRes, avgRes, totalRes] = await Promise.all([
      query<{ verification_status: string; cnt: string }>(
        `SELECT verification_status, COUNT(*) AS cnt FROM paper_records GROUP BY verification_status`
      ),
      query<{ evidence_level: string; cnt: string }>(
        `SELECT evidence_level, COUNT(*) AS cnt FROM paper_records GROUP BY evidence_level`
      ),
      query<{ avg: string }>(
        `SELECT AVG(confidence_score) AS avg FROM paper_records`
      ),
      query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM paper_records`
      ),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const r of statusRes.rows) statusCounts[r.verification_status] = parseInt(r.cnt);

    const levelCounts: Record<string, number> = {};
    for (const r of levelRes.rows) levelCounts[r.evidence_level] = parseInt(r.cnt);

    return NextResponse.json({
      total_papers: parseInt(totalRes.rows[0]?.cnt ?? "0"),
      average_confidence_score: parseFloat(avgRes.rows[0]?.avg ?? "0"),
      status_distribution: {
        verified: statusCounts["verified"] ?? 0,
        unverified: statusCounts["unverified"] ?? 0,
        disputed: statusCounts["disputed"] ?? 0,
        pending: statusCounts["pending"] ?? 0,
      },
      evidence_level_distribution: levelCounts,
    });
  } catch (err) {
    console.error("verification_stats_error", err);
    return NextResponse.json({
      total_papers: 0,
      average_confidence_score: 0,
      status_distribution: { verified: 0, unverified: 0, disputed: 0, pending: 0 },
      evidence_level_distribution: {},
    });
  }
}
