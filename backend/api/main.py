"""
MEDICA FastAPI Application Entrypoint
Wires up CORS, lifespan scheduler events, routers, and health checks.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.logging import get_logger
from shared.database import get_db
from scheduler.runner import scheduler_runner
from api.chat import router as chat_router
from api.search import router as search_router
from api.admin import router as admin_router
from knowledge.graph import graph

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events: handles background scheduler runner thread states."""
    logger.info("app_lifespan_startup")
    # Initialize the database schema
    from shared.database import init_db
    try:
        await init_db()
    except Exception as e:
        logger.error("database_init_failed", error=str(e))
        
    # Start the background task scheduler
    scheduler_runner.start()
    
    yield
    
    logger.info("app_lifespan_shutdown")
    # Gracefully stop the background scheduler
    scheduler_runner.shutdown()


def create_app() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title="MEDICA Oncology Research Operating System",
        description="Autonomous oncology intelligence and structured clinical memory system.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Set to specific domains in production (e.g. http://localhost:3000)
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount API routers under `/api` prefix
    app.include_router(chat_router, prefix="/api")
    app.include_router(search_router, prefix="/api")
    app.include_router(admin_router, prefix="/api")

    @app.get("/api/health")
    async def health_check(db: AsyncSession = Depends(get_db)):
        """Health and system connectivity check."""
        db_status = "healthy"
        try:
            # Quick query to check DB availability
            await db.execute(text("SELECT 1"))
        except Exception as e:
            logger.error("health_check_db_failure", error=str(e))
            db_status = "unhealthy"

        graph_stats = graph.stats()

        return {
            "status": "healthy" if db_status == "healthy" else "unhealthy",
            "environment": settings.environment.value,
            "database": db_status,
            "llm_provider": settings.llm_provider.value,
            "embedding_provider": settings.embedding_provider.value,
            "knowledge_graph": graph_stats,
        }

    return app


app = create_app()
