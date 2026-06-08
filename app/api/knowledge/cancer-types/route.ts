/**
 * GET /api/knowledge/cancer-types
 * Return distinct cancer types derived from paper tags stored in PostgreSQL.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Well-known oncology types for fallback when DB is empty
const DEFAULT_TYPES = [
  "lung", "breast", "colorectal", "prostate", "melanoma",
  "leukemia", "lymphoma", "pancreatic", "ovarian", "glioblastoma",
  "hepatocellular", "bladder", "renal", "thyroid", "cervical",
];

export async function GET() {
  try {
    const res = await query<{ cancer_type: string }>(
      `SELECT DISTINCT jsonb_array_elements_text(tags->'cancer') AS cancer_type
       FROM paper_records
       WHERE tags IS NOT NULL AND tags ? 'cancer'
       ORDER BY cancer_type`
    );
    const types = res.rows.map((r) => r.cancer_type).filter(Boolean);
    return NextResponse.json(types.length > 0 ? types : DEFAULT_TYPES);
  } catch (err) {
    console.error("cancer_types_error", err);
    return NextResponse.json(DEFAULT_TYPES);
  }
}
