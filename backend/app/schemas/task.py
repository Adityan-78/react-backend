from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

Priority = Literal["Low", "Medium", "High", "Critical"]


class TaskOut(ORMModel):
    task_id: int
    assigned_to: int
    assigned_to_name: str
    assigned_by: int
    assigned_by_name: str
    title: str
    description: str | None = None
    status: str
    priority: str
    due_date: date | None = None
    created_at: datetime
    updated_at: datetime
    is_overdue: bool


class TaskCreate(BaseModel):
    assigned_to: int  # employee_id
    title: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    priority: Priority = "Medium"
    due_date: date | None = None


class TaskUpdate(BaseModel):
    assigned_to: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=500)
    priority: Priority | None = None
    due_date: date | None = None


class TaskStatusUpdate(BaseModel):
    # "Overdue" is derived from the due date, so it can't be chosen by hand.
    status: Literal["Pending", "In Progress", "Completed"]
