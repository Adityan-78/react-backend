"""Tiny helpers shared by the models and services."""
from datetime import date, datetime, timezone


def utc_now() -> datetime:
    """Naive UTC timestamp (SQL Server DATETIME has no timezone)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def today() -> date:
    return date.today()
