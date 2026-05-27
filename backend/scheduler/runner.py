"""
MEDICA Scheduler Runner
Orchestrates background task schedules using AsyncIOScheduler.
"""
from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from core.config import settings
from core.logging import get_logger
from scheduler.jobs import daily_fetch_job, weekly_optimize_job

logger = get_logger(__name__)


class SchedulerRunner:
    """
    Manages the background execution scheduler.
    Registers jobs based on active platform settings.
    """

    def __init__(self) -> None:
        self.scheduler = AsyncIOScheduler()
        self._initialized = False

    def start(self) -> None:
        """Initialize triggers and start the scheduler scheduler."""
        if not settings.scheduler_enabled:
            logger.info("scheduler_disabled_by_config")
            return

        if self._initialized:
            logger.warning("scheduler_already_started")
            return

        try:
            # 1. Daily Ingestion Fetch (Default: 2 AM daily)
            self.scheduler.add_job(
                daily_fetch_job,
                trigger=CronTrigger(hour=settings.daily_fetch_hour, minute=0),
                id="daily_fetch_job",
                name="MEDICA Daily Oncology Research Ingestion",
                replace_existing=True,
            )
            logger.info(
                "scheduler_daily_fetch_registered",
                hour=settings.daily_fetch_hour,
            )

            # 2. Weekly Knowledge Graph Optimizer (Default: Sunday at 3 AM)
            day_of_week = settings.weekly_optimize_day.lower()
            self.scheduler.add_job(
                weekly_optimize_job,
                trigger=CronTrigger(day_of_week=day_of_week, hour=3, minute=0),
                id="weekly_optimize_job",
                name="MEDICA Weekly Knowledge Graph Optimization",
                replace_existing=True,
            )
            logger.info(
                "scheduler_weekly_optimize_registered",
                day_of_week=day_of_week,
            )

            self.scheduler.start()
            self._initialized = True
            logger.info("scheduler_runner_started")

        except Exception as e:
            logger.error("scheduler_start_failed", error=str(e))

    def shutdown(self) -> None:
        """Shutdown running scheduler tasks."""
        if self._initialized and self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            self._initialized = False
            logger.info("scheduler_runner_shutdown")


# Global singleton scheduler runner
scheduler_runner = SchedulerRunner()
