"""
MEDICA Chat API Endpoints
Manages agent chat sessions, streaming responses, and research history.
"""
from __future__ import annotations

import json
import re
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import get_logger
from agents.research_agent import OncologyResearchAgent
from shared.database import get_db, get_session
from shared.models import ChatSessionRecord

logger = get_logger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

# Patterns to detect Open Access URLs and bare DOIs in chat messages
URL_PATTERN = re.compile(r'https?://\S+')
DOI_PATTERN = re.compile(r'\b10\.\d{4,9}/[^\s]+')


@router.post("")
async def chat_endpoint(
    message: str = Body(..., embed=True),
    session_id: str | None = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
):
    """
    Core agent chat endpoint.
    Streams ReAct thoughts, tool executions, and the final clinical answer using Server-Sent Events.
    Automatically detects Open Access URLs / DOIs and ingests them into the local knowledge base.
    """
    logger.info("api_chat_request", session_id=session_id)

    # 1. Resolve or create chat session (use get_session() so the DB handle is not tied
    #    to the Depends lifecycle which closes before the StreamingResponse generator runs)
    session_uuid: UUID | None = None
    if session_id:
        try:
            session_uuid = UUID(session_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session_id UUID format")

    async with get_session() as init_db:
        db_session = None
        if session_uuid:
            result = await init_db.execute(
                select(ChatSessionRecord).where(ChatSessionRecord.id == session_uuid)
            )
            db_session = result.scalar_one_or_none()

        if not db_session:
            session_uuid = uuid4()
            db_session = ChatSessionRecord(
                id=session_uuid,
                title=message[:60] + ("..." if len(message) > 60 else ""),
                messages=[],
                llm_config={},
            )
            init_db.add(db_session)
            await init_db.commit()
            await init_db.refresh(db_session)

        # Append user message to history
        messages_list = list(db_session.messages) if db_session.messages else []
        messages_list.append({"role": "user", "content": message})
        db_session.messages = messages_list
        await init_db.commit()

    # Capture session_uuid in local var for use inside the generator closure
    active_session_uuid: UUID = session_uuid  # type: ignore[assignment]

    # 2. Build streaming generator — all DB work uses independent get_session() contexts
    async def event_generator():
        agent = OncologyResearchAgent()
        accumulated_text = ""
        reasoning_path = []

        # Emit session identification first
        yield f"data: {json.dumps({'type': 'session_init', 'session_id': str(active_session_uuid)})}\n\n"

        # ── Open Access ingestion intercept ──────────────────────────────────
        urls = URL_PATTERN.findall(message)
        dois = DOI_PATTERN.findall(message)
        target_link: str | None = urls[0] if urls else (dois[0] if dois else None)

        if target_link:
            call_payload = json.dumps({
                "type": "call",
                "content": f"OpenAccessProcessor.ingest_paper(link={target_link!r})",
            })
            yield f"data: {call_payload}\n\n"

            try:
                from processing.open_access import OpenAccessProcessor
                processor = OpenAccessProcessor()
                oa_result = await processor.ingest_paper(target_link)

                biomarkers_str = ", ".join(oa_result.get("biomarkers") or []) or "None"
                sample_size_str = str(oa_result["sample_size"]) if oa_result.get("sample_size") is not None else "N/A"

                obs = (
                    f"Successfully crawled and ingested Open Access publication:\n"
                    f"- Title: {oa_result['title']}\n"
                    f"- Extracted Claims: {oa_result['claims_count']}\n"
                    f"- Biomarkers Found: {biomarkers_str}\n"
                    f"- Trial Sample Size: {sample_size_str}\n"
                    f"- Knowledge Base Path: {oa_result['knowledge_path']}\n\n"
                    f"Active research knowledge base and semantic index updated successfully."
                )
                reasoning_path.append({"type": "observation", "content": obs})
                yield f"data: {json.dumps({'type': 'observation', 'content': obs})}\n\n"

            except Exception as crawler_err:
                logger.error("api_oa_crawler_failed", error=str(crawler_err))
                err_msg = f"Open Access ingestion failed: {crawler_err}"
                reasoning_path.append({"type": "observation", "content": err_msg})
                yield f"data: {json.dumps({'type': 'observation', 'content': err_msg})}\n\n"

        # ── Main ReAct agent loop ────────────────────────────────────────────
        async for chunk in agent.run(message):
            if chunk.startswith("[thought]"):
                content = chunk.replace("[thought]", "").replace("[/thought]", "").strip()
                reasoning_path.append({"type": "thought", "content": content})
                yield f"data: {json.dumps({'type': 'thought', 'content': content})}\n\n"
            elif chunk.startswith("[call]"):
                content = chunk.replace("[call]", "").replace("[/call]", "").strip()
                reasoning_path.append({"type": "call", "content": content})
                yield f"data: {json.dumps({'type': 'call', 'content': content})}\n\n"
            elif chunk.startswith("[observation]"):
                content = chunk.replace("[observation]", "").replace("[/observation]", "").strip()
                reasoning_path.append({"type": "observation", "content": content})
                yield f"data: {json.dumps({'type': 'observation', 'content': content})}\n\n"
            else:
                accumulated_text += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        # ── Persist completed assistant turn ─────────────────────────────────
        async with get_session() as save_db:
            res = await save_db.execute(
                select(ChatSessionRecord).where(ChatSessionRecord.id == active_session_uuid)
            )
            sess = res.scalar_one_or_none()
            if sess:
                current_msgs = list(sess.messages) if sess.messages else []
                current_msgs.append({
                    "role": "assistant",
                    "content": accumulated_text,
                    "reasoning_path": reasoning_path,
                })
                sess.messages = current_msgs
                await save_db.commit()

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """List all available research chat sessions."""
    result = await db.execute(
        select(ChatSessionRecord).order_by(ChatSessionRecord.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "title": s.title,
            "updated_at": s.updated_at.isoformat(),
            "messages_count": len(s.messages) if s.messages else 0,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}")
async def get_session_history(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get complete conversation history for a session."""
    try:
        session_uuid = UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id UUID format")

    result = await db.execute(
        select(ChatSessionRecord).where(ChatSessionRecord.id == session_uuid)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return {
        "id": str(session.id),
        "title": session.title,
        "messages": session.messages or [],
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
    }


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a chat session."""
    try:
        session_uuid = UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id UUID format")

    await db.execute(
        delete(ChatSessionRecord).where(ChatSessionRecord.id == session_uuid)
    )
    await db.commit()
    return {"status": "success", "message": "Session deleted"}
