/**
 * POST /api/chat
 * Core MEDICA agent chat endpoint.
 * Creates/resolves a session, runs Gemini streaming, and returns SSE.
 */
import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { streamOncologyChat } from "@/lib/ai";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const message: string = body.message ?? "";
  let sessionId: string | null = body.session_id ?? null;

  // Resolve or create session
  try {
    if (sessionId) {
      const existing = await query(
        "SELECT id FROM chat_sessions WHERE id = $1",
        [sessionId]
      );
      if (existing.rowCount === 0) sessionId = null;
    }
    if (!sessionId) {
      sessionId = uuidv4();
      const title = message.slice(0, 60) + (message.length > 60 ? "..." : "");
      await query(
        "INSERT INTO chat_sessions (id, title, messages, created_at, updated_at) VALUES ($1, $2, $3::jsonb, NOW(), NOW())",
        [sessionId, title, JSON.stringify([])]
      );
    }
    // Append user message
    await query(
      `UPDATE chat_sessions
       SET messages = messages || $1::jsonb, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify([{ role: "user", content: message }]), sessionId]
    );
  } catch (err) {
    console.error("chat_session_init_error", err);
  }

  const capturedSessionId = sessionId!;

  // Build history for Gemini from DB
  let history: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  try {
    const res = await query<{ messages: { role: string; content: string }[] }>(
      "SELECT messages FROM chat_sessions WHERE id = $1",
      [capturedSessionId]
    );
    const msgs = res.rows[0]?.messages ?? [];
    // Exclude the last user message (already sent) — build Gemini-compatible history
    const histMsgs = msgs.slice(0, -1);
    history = histMsgs.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));
  } catch {
    history = [];
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Emit session init
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "session_init", session_id: capturedSessionId })}\n\n`
          )
        );

        for await (const chunk of streamOncologyChat(message, history)) {
          // chunk is already "data: {...}\n\n" formatted
          controller.enqueue(encoder.encode(chunk));
          // Extract text chunks to accumulate full response
          try {
            const parsed = JSON.parse(chunk.replace(/^data: /, "").trim());
            if (parsed.type === "chunk") fullResponse += parsed.content;
          } catch { /* ignore parse errors */ }
        }

        // Persist assistant response
        try {
          await query(
            `UPDATE chat_sessions
             SET messages = messages || $1::jsonb, updated_at = NOW()
             WHERE id = $2`,
            [
              JSON.stringify([{ role: "assistant", content: fullResponse }]),
              capturedSessionId,
            ]
          );
        } catch (err) {
          console.error("chat_save_error", err);
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "chunk", content: `\n\nError: ${msg}` })}\n\n`
          )
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
