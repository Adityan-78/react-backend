from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Role(Base):
    __tablename__ = "Role"

    role_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_name: Mapped[str] = mapped_column(String(50), nullable=False)

    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="role"
    )


class User(Base):
    __tablename__ = "Users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Role.role_id"),
        nullable=False
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        unique=True
    )
    password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Maps directly to the existing SQL Server BIT column.
    is_active: Mapped[bool] = mapped_column(
        "is_active",
        Boolean,
        nullable=False,
        default=True
    )

    role: Mapped["Role"] = relationship(
        "Role",
        back_populates="users"
    )

    employee: Mapped["Employee"] = relationship(
        "Employee",
        back_populates="user",
        uselist=False
    )


class Employee(Base):
    __tablename__ = "Employee"

    employee_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("Users.user_id"),
        nullable=False
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="employee"
    )

    @property
    def is_active(self) -> bool:
        return self.user.is_active