"""Role, Users and Employee tables."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models._helpers import today, utc_now


class Role(Base):
    __tablename__ = "Role"

    role_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))


class User(Base):
    __tablename__ = "Users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("Role.role_id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    # The DB column is called "password" but it only ever holds the hash.
    password_hash: Mapped[str] = mapped_column("password", String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, server_default=func.now()
    )
    # Soft-delete flag (see schema_additions.sql) - users are never hard deleted
    # because orders, tasks etc. may still point at them.
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
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

    employee_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("Users.user_id"), unique=True, nullable=False
    )
    designation: Mapped[str | None] = mapped_column(String(100))
    department: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    hire_date: Mapped[date | None] = mapped_column(Date, default=today)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )

    user: Mapped[User] = relationship(User, back_populates="employee")

    # Convenience read-only fields so response schemas can show who this is.
    @property
    def name(self) -> str:
        return self.user.name

    @property
    def email(self) -> str:
        return self.user.email

    @property
    def role_name(self) -> str:
        return self.user.role.role_name
