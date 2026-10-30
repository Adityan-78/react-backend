"""Declarative base shared by every model.

Importing app.models here makes sure all tables are registered on Base.metadata
(needed by Alembic autogenerate and by the test/seed scripts).
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


import app.models  # noqa: E402,F401  (registers all models on Base.metadata)
