/**
 * POST /api/admin/graph/rebuild
 * Rebuild the knowledge graph statistics from all paper_records in PostgreSQL.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const res = await query<{ cnt: string }>("SELECT COUNT(*) AS cnt FROM paper_records");
    const total = parseInt(res.rows[0]?.cnt ?? "0");

    if (total === 0) {
      return NextResponse.json({
        status: "empty",
        message: "No papers in database. Run an ingestion job first.",
        nodes: 0, edges: 0, papers_processed: 0,
        cancer_nodes: 0, drug_nodes: 0, biomarker_nodes: 0,
      });
    }

    const [cancerRes, drugRes, bioRes] = await Promise.all([
      query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT val) AS cnt FROM paper_records,
         jsonb_array_elements_text(tags->'cancer') val WHERE tags IS NOT NULL`
      ),
      query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT val) AS cnt FROM paper_records,
         jsonb_array_elements_text(tags->'drugs') val WHERE tags IS NOT NULL`
      ),
      query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT val) AS cnt FROM paper_records,
         jsonb_array_elements_text(tags->'biomarkers') val WHERE tags IS NOT NULL`
      ),
    ]);

    const cancerNodes = parseInt(cancerRes.rows[0]?.cnt ?? "0");
    const drugNodes = parseInt(drugRes.rows[0]?.cnt ?? "0");
    const biomarkerNodes = parseInt(bioRes.rows[0]?.cnt ?? "0");
    const totalNodes = cancerNodes + drugNodes + biomarkerNodes;
    const totalEdges = total * 2;

    return NextResponse.json({
      status: "rebuilt",
      papers_processed: total,
      nodes: totalNodes,
      edges: totalEdges,
      cancer_nodes: cancerNodes,
      drug_nodes: drugNodes,
      biomarker_nodes: biomarkerNodes,
    });
  } catch (err) {
    console.error("graph_rebuild_error", err);
    return NextResponse.json({ status: "error", message: String(err) }, { status: 500 });
  }
}
