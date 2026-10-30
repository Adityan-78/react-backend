"""Helpers used by several services."""
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.api.deps import PageParams


def paginate(db: Session, stmt: Select, params: PageParams) -> dict[str, Any]:
    """Run a SELECT with paging and return the standard list envelope.

    Remember: SQL Server's OFFSET/FETCH only works with an ORDER BY, so every
    list query that goes through here must already be ordered.
    """
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.offset(params.offset).limit(params.page_size)).unique().all()
    return {
        "items": rows,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
    }


def escape_like(term: str) -> str:
    """Make user input safe to drop inside a LIKE pattern."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def like(column, term: str):
    """Case-insensitive 'contains' filter."""
    return column.ilike(f"%{escape_like(term)}%", escape="\\")
