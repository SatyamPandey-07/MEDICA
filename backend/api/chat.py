"""
MEDICA Chat API Endpoints
Manages agent chat sessions, streaming responses, and research history.
"""
from __future__ import annotations

import json
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


@router.post("")
async def chat_endpoint(
    message: str = Body(..., embed=True),
    session_id: str | None = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
):
    """
    Core agent chat endpoint.
    Streams ReAct thoughts, tool executions, and the final clinical answer using Server-Sent Events.
    """
    logger.info("api_chat_request", session_id=session_id)

    # 1. Fetch or create chat session
    session_uuid = None
    if session_id:
        try:
            session_uuid = UUID(session_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session_id UUID format")

    db_session = None
    if session_uuid:
        result = await db.execute(
            select(ChatSessionRecord).where(ChatSessionRecord.id == session_uuid)
        )
        db_session = result.scalar_one_or_none()

    if not db_session:
        session_uuid = uuid4()
        db_session = ChatSessionRecord(
            id=session_uuid,
            title=message[:60] + ("..." if len(message) > 60 else ""),
            messages=[],
        )
        db.add(db_session)
        await db.commit()
        await db.refresh(db_session)

    # 2. Append user message to history
    messages_list = list(db_session.messages) if db_session.messages else []
    messages_list.append({"role": "user", "content": message})
    db_session.messages = messages_list
    await db.commit()

    # 3. Stream agent execution
    async def event_generator():
        agent = OncologyResearchAgent()
        accumulated_text = ""
        reasoning_path = []

        # Send initial session identification event
        yield f"data: {json.dumps({'type': 'session_init', 'session_id': str(session_uuid)})}\n\n"

        async for chunk in agent.run(message):
            # Intercept thoughts, calls, and observations
            if chunk.startswith("[thought]"):
                thought_content = chunk.replace("[thought]", "").replace("[/thought]", "").strip()
                reasoning_path.append({"type": "thought", "content": thought_content})
                yield f"data: {json.dumps({'type': 'thought', 'content': thought_content})}\n\n"
            elif chunk.startswith("[call]"):
                call_content = chunk.replace("[call]", "").replace("[/call]", "").strip()
                reasoning_path.append({"type": "call", "content": call_content})
                yield f"data: {json.dumps({'type': 'call', 'content': call_content})}\n\n"
            elif chunk.startswith("[observation]"):
                obs_content = chunk.replace("[observation]", "").replace("[/observation]", "").strip()
                reasoning_path.append({"type": "observation", "content": obs_content})
                yield f"data: {json.dumps({'type': 'observation', 'content': obs_content})}\n\n"
            else:
                # Part of the final answer
                accumulated_text += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        # 4. Save completed assistant message to history
        async with get_session() as local_db:
            res = await local_db.execute(
                select(ChatSessionRecord).where(ChatSessionRecord.id == session_uuid)
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
                await local_db.commit()

        # Emit completion event
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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

    result = await db.execute(
        delete(ChatSessionRecord).where(ChatSessionRecord.id == session_uuid)
    )
    await db.commit()
    return {"status": "success", "message": "Session deleted"}
