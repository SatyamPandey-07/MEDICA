/**
 * GET  /api/chat/sessions/[id] — get session history
 * DELETE /api/chat/sessions/[id] — delete session
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await query<{
      id: string;
      title: string;
      messages: unknown[];
      created_at: string;
      updated_at: string;
    }>("SELECT id, title, messages, created_at, updated_at FROM chat_sessions WHERE id = $1", [id]);

    if (res.rowCount === 0) {
      return NextResponse.json({ detail: "Chat session not found" }, { status: 404 });
    }
    const s = res.rows[0];
    return NextResponse.json({
      id: s.id,
      title: s.title,
      messages: s.messages ?? [],
      created_at: s.created_at,
      updated_at: s.updated_at,
    });
  } catch (err: any) {
    console.error("get_session_error", err);
    return NextResponse.json({ detail: `Internal server error: ${err.message || String(err)}` }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await query("DELETE FROM chat_sessions WHERE id = $1", [id]);
    return NextResponse.json({ status: "success", message: "Session deleted" });
  } catch (err) {
    console.error("delete_session_error", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
