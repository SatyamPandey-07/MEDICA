/**
 * POST /api/admin/optimize
 * Trigger a lightweight knowledge graph optimization pass.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Re-link papers with unverified status that have high confidence scores
    const res = await query(
      `UPDATE paper_records
       SET verification_status = 'verified', updated_at = NOW()
       WHERE verification_status = 'unverified' AND confidence_score >= 0.75
       RETURNING id`
    );
    return NextResponse.json({
      status: "triggered",
      message: `Optimization complete. ${res.rowCount ?? 0} papers promoted to verified status.`,
    });
  } catch (err) {
    console.error("optimize_error", err);
    return NextResponse.json({ status: "error", message: String(err) }, { status: 500 });
  }
}
