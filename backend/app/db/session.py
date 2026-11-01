"""Engine and session factory.

The engine is created lazily (on first use) so importing the app never needs
a live database or the ODBC driver - handy for tests and for the period where
the real connection string is still a dummy value.
"""
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


@lru_cache
def get_engine() -> Engine:
    kwargs: dict = {
        "echo": settings.sql_echo,
        "pool_pre_ping": True,   # quietly replace dead connections
        "pool_recycle": 1800,    # SQL Server drops idle connections eventually
    }
    if settings.database_url.startswith("mssql"):
        kwargs["fast_executemany"] = True  # much faster bulk inserts via pyodbc
    return create_engine(settings.database_url, **kwargs)


@lru_cache
def _session_factory() -> sessionmaker[Session]:
    # expire_on_commit=False: after commit() our objects stay readable, so we
    # don't pay for a re-query just to build the JSON response.
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always cleaned up."""
    db = _session_factory()()
    try:
        yield db
    except Exception:
        db.rollback()  # never leave a half-finished transaction behind
        raise
    finally:
        db.close()
