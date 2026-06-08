/**
 * GET /api/knowledge/graph
 * Return nodes and edges for knowledge graph visualization.
 * Builds the graph dynamically from PostgreSQL paper tags.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await query<{ id: string; tags: Record<string, string[]> }>(
      `SELECT id, tags FROM paper_records WHERE tags IS NOT NULL LIMIT 500`
    );

    const nodeMap = new Map<string, { id: string; label: string; type: string; papers_count: number }>();
    const edgeSet = new Set<string>();
    const edges: { source: string; target: string }[] = [];

    for (const row of res.rows) {
      const tags = row.tags ?? {};
      const paperId = row.id;

      const addNodes = (list: string[], type: string) => {
        for (const name of list ?? []) {
          const key = `${type}::${name}`;
          if (!nodeMap.has(key)) {
            nodeMap.set(key, { id: key, label: name, type, papers_count: 0 });
          }
          nodeMap.get(key)!.papers_count++;
          // Link all cancer nodes to drug/biomarker nodes for this paper
          return key;
        }
      };

      const cancerKeys = (tags.cancer ?? []).map((n: string) => {
        const key = `cancer::${n}`;
        if (!nodeMap.has(key)) nodeMap.set(key, { id: key, label: n, type: "cancer", papers_count: 0 });
        nodeMap.get(key)!.papers_count++;
        return key;
      });

      for (const list of [
        { items: tags.drugs ?? [], type: "drug" },
        { items: tags.biomarkers ?? [], type: "biomarker" },
      ]) {
        for (const item of list.items) {
          const key = `${list.type}::${item}`;
          if (!nodeMap.has(key)) nodeMap.set(key, { id: key, label: item, type: list.type, papers_count: 0 });
          nodeMap.get(key)!.papers_count++;

          for (const ck of cancerKeys) {
            const pair = [ck, key].sort().join("||");
            if (!edgeSet.has(pair)) {
              edgeSet.add(pair);
              edges.push({ source: ck, target: key });
            }
          }
        }
      }
      void paperId; // used only for counting above
      void addNodes;
    }

    return NextResponse.json({
      nodes: Array.from(nodeMap.values()),
      edges,
    });
  } catch (err) {
    console.error("graph_network_error", err);
    return NextResponse.json({ nodes: [], edges: [] });
  }
}
