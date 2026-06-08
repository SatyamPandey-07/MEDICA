/**
 * GET /api/admin/jobs
 * List all ingestion job records.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await query(
      `SELECT id, job_name, source, query, status, fetched, processed, failed,
              error_message, created_at, started_at, completed_at
       FROM ingestion_jobs ORDER BY created_at DESC LIMIT 50`
    );
    return NextResponse.json(
      res.rows.map((j) => ({
        id: j.id,
        job_name: j.job_name,
        source: j.source,
        query: j.query,
        status: j.status,
        fetched: j.fetched ?? 0,
        processed: j.processed ?? 0,
        failed: j.failed ?? 0,
        error_message: j.error_message,
        created_at: j.created_at,
        started_at: j.started_at,
        completed_at: j.completed_at,
      }))
    );
  } catch (err) {
    console.error("list_jobs_error", err);
    return NextResponse.json([]);
  }
}
