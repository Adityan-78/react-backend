from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class IssueOut(ORMModel):
    issue_id: int
    raised_by: int
    raised_by_name: str
    title: str
    description: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class IssueCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)


class IssueUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)


class IssueStatusUpdate(BaseModel):
    status: Literal["Open", "In Progress", "Resolved", "Closed"]
