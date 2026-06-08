import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  let dbStatus = "healthy";
  try {
    await query("SELECT 1");
  } catch {
    dbStatus = "unhealthy";
  }
  return NextResponse.json({
    status: dbStatus === "healthy" ? "healthy" : "unhealthy",
    environment: process.env.NODE_ENV,
    database: dbStatus,
    llm_provider: "gemini",
    embedding_provider: process.env.EMBEDDING_PROVIDER ?? "gemini",
  });
}
