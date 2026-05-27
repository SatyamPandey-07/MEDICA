"""
MEDICA Lightweight Event Bus
Simple asyncio-based pub/sub for decoupled component communication.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, Callable, Coroutine

from core.logging import get_logger

logger = get_logger(__name__)

# Type alias for async event handlers
EventHandler = Callable[..., Coroutine[Any, Any, None]]


class EventBus:
    """
    Lightweight async event bus.
    Components subscribe to events and emit them without tight coupling.

    Events:
      - paper_ingested      (paper_id, source)
      - paper_verified      (paper_id, status, confidence)
      - index_updated       (index_type)
      - knowledge_updated   (path)
      - verification_retry  (paper_id, reason)
      - ingestion_complete  (stats)
      - scheduler_job_done  (job_name, success)
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, list[EventHandler]] = defaultdict(list)

    def subscribe(self, event: str, handler: EventHandler) -> None:
        """Subscribe a coroutine handler to an event."""
        self._subscribers[event].append(handler)
        logger.debug("event_subscribed", event=event, handler=handler.__name__)

    def unsubscribe(self, event: str, handler: EventHandler) -> None:
        """Unsubscribe a handler from an event."""
        if handler in self._subscribers[event]:
            self._subscribers[event].remove(handler)

    async def emit(self, event: str, **payload: Any) -> None:
        """Emit an event and call all subscribed handlers concurrently."""
        handlers = self._subscribers.get(event, [])
        if not handlers:
            return
        logger.debug("event_emitted", event=event, handlers=len(handlers), **payload)
        tasks = [asyncio.create_task(h(**payload)) for h in handlers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for result, handler in zip(results, handlers):
            if isinstance(result, Exception):
                logger.error(
                    "event_handler_error",
                    event=event,
                    handler=handler.__name__,
                    error=str(result),
                )


# Global singleton event bus
bus = EventBus()
