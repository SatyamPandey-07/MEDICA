/**
 * GET /api/chat/sessions
 * List all chat sessions ordered by last updated.
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await query<{
      id: string;
      title: string;
      updated_at: string;
      messages: unknown[];
    }>(
      "SELECT id, title, updated_at, messages FROM chat_sessions ORDER BY updated_at DESC LIMIT 100"
    );
    return NextResponse.json(
      res.rows.map((s) => ({
        id: s.id,
        title: s.title,
        updated_at: s.updated_at,
        messages_count: Array.isArray(s.messages) ? s.messages.length : 0,
      }))
    );
  } catch (err) {
    console.error("list_sessions_error", err);
    return NextResponse.json([], { status: 200 });
  }
}
