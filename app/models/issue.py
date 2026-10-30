"""Operational_Issue table."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import IssueStatus
from app.db.base import Base
from app.models._helpers import utc_now
from app.models.user import Employee


class OperationalIssue(Base):
    __tablename__ = "Operational_Issue"

    issue_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    raised_by: Mapped[int] = mapped_column(ForeignKey("Employee.employee_id"), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default=IssueStatus.OPEN,
        server_default=text(f"'{IssueStatus.OPEN}'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, server_default=func.now()
    )

    reporter: Mapped[Employee] = relationship(Employee)

    @property
    def raised_by_name(self) -> str:
        return self.reporter.user.name
