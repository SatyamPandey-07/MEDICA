from datetime import datetime, timezone, timedelta
import sys
from loguru import logger
from ingestion_agent.app.config.settings import settings

"""
Consolidated Logging System for the Ingestion Agent.
Uses Loguru for clean, colorized terminal output localized to IST.
"""

# Indian Standard Time definition for log timestamps
IST = timezone(timedelta(hours=5, minutes=30))

def setup_logger():
    """Configures the terminal output format and verbosity."""
    logger.remove()
    logger.add(
        sys.stdout,
        colorize=True,
        # Format: HH:mm:ss | LEVEL | Message
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <7}</level> | <level>{message}</level>",
        level=settings.LOG_LEVEL,
    )

setup_logger()
