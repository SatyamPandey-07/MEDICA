/**
 * GET /api/knowledge/graph/stats
 * Return knowledge graph node and edge counts computed from paper tags.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [cancerRes, drugRes, bioRes, totalRes] = await Promise.all([
      query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT val) AS cnt
         FROM paper_records, jsonb_array_elements_text(tags->'cancer') val
         WHERE tags IS NOT NULL`
      ),
      query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT val) AS cnt
         FROM paper_records, jsonb_array_elements_text(tags->'drugs') val
         WHERE tags IS NOT NULL`
      ),
      query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT val) AS cnt
         FROM paper_records, jsonb_array_elements_text(tags->'biomarkers') val
         WHERE tags IS NOT NULL`
      ),
      query<{ cnt: string }>("SELECT COUNT(*) AS cnt FROM paper_records"),
    ]);

    const cancerNodes = parseInt(cancerRes.rows[0]?.cnt ?? "0");
    const drugNodes = parseInt(drugRes.rows[0]?.cnt ?? "0");
    const biomarkerNodes = parseInt(bioRes.rows[0]?.cnt ?? "0");
    const totalNodes = cancerNodes + drugNodes + biomarkerNodes;
    const paperCount = parseInt(totalRes.rows[0]?.cnt ?? "0");
    const totalEdges = paperCount * 2;

    return NextResponse.json({
      total_nodes: totalNodes,
      total_edges: totalEdges,
      cancer_nodes: cancerNodes,
      drug_nodes: drugNodes,
      biomarker_nodes: biomarkerNodes,
    });
  } catch (err) {
    console.error("graph_stats_error", err);
    return NextResponse.json({
      total_nodes: 0, total_edges: 0,
      cancer_nodes: 0, drug_nodes: 0, biomarker_nodes: 0,
    });
  }
}
