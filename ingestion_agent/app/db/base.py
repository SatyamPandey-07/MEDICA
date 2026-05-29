from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    """
    Shared Declarative Base for the Ingestion Agent's SQLAlchemy models.
    All models must inherit from this to be tracked by the session and migrations.
    """
    pass
