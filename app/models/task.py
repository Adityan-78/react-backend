"""Customer_Task table (name kept exactly as in the current schema)."""
from datetime import date, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Date, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import TaskPriority, TaskStatus
from app.db.base import Base
from app.models._helpers import today, utc_now
from app.models.user import Employee


class CustomerTask(Base):
    __tablename__ = "Customer_Task"

    task_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assigned_to: Mapped[int] = mapped_column(ForeignKey("Employee.employee_id"), nullable=False)
    assigned_by: Mapped[int] = mapped_column(ForeignKey("Employee.employee_id"), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=TaskStatus.PENDING,
        server_default=text(f"'{TaskStatus.PENDING}'"),
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default=TaskPriority.MEDIUM,
        server_default=text(f"'{TaskPriority.MEDIUM}'"),
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, server_default=func.now()
    )

    # Two foreign keys point at Employee, so each relationship names its own.
    assignee: Mapped[Employee] = relationship(Employee, foreign_keys=[assigned_to])
    assigner: Mapped[Employee] = relationship(Employee, foreign_keys=[assigned_by])

    @property
    def assigned_to_name(self) -> str:
        return self.assignee.user.name

    @property
    def assigned_by_name(self) -> str:
        return self.assigner.user.name

    @property
    def is_overdue(self) -> bool:
        """Overdue is worked out from the date, so it is always up to date
        without a background job rewriting the status column."""
        return (
            self.due_date is not None
            and self.due_date < today()
            and self.status != TaskStatus.COMPLETED
        )
