"""Role, Users and Employee tables matching the existing SQL Server schema."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models._helpers import today, utc_now


class Role(Base):
    __tablename__ = "Role"

    role_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    role_name: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )
    description: Mapped[str | None] = mapped_column(String(255))


class User(Base):
    __tablename__ = "Users"

    user_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    role_id: Mapped[int] = mapped_column(
        ForeignKey("Role.role_id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(150), unique=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(
        "password", String(255), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, server_default=func.now()
    )

    # Matches the existing SQL Server column: is_active BIT NOT NULL
    is_active: Mapped[bool] = mapped_column(
        "is_active",
        Boolean,
        nullable=False,
        default=True
    )

    role: Mapped[Role] = relationship(Role)
    employee: Mapped["Employee | None"] = relationship(
        "Employee", back_populates="user", uselist=False
    )

    @property
    def role_name(self) -> str:
        return self.role.role_name


class Employee(Base):
    __tablename__ = "Employee"

    employee_id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("Users.user_id"), unique=True, nullable=False
    )
    designation: Mapped[str | None] = mapped_column(String(100))
    department: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    hire_date: Mapped[date | None] = mapped_column(Date, default=today)

    user: Mapped[User] = relationship(
        User, back_populates="employee"
    )

    @property
    def name(self) -> str:
        return self.user.name

    @property
    def email(self) -> str:
        return self.user.email

    @property
    def role_name(self) -> str:
        return self.user.role.role_name

    @property
    def is_active(self) -> bool:
        return self.user.is_active
