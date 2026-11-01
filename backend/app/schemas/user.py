from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ORMModel, validate_password_strength


class RoleOut(ORMModel):
    role_id: int
    role_name: str
    description: str | None = None


class UserOut(ORMModel):
    user_id: int
    name: str
    email: EmailStr
    role_id: int
    role: str = Field(validation_alias="role_name")
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str
    role_id: int

    _check_password = field_validator("password")(validate_password_strength)


class UserUpdate(BaseModel):
    """All fields optional - only what is sent gets changed."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    is_active: bool | None = None
    password: str | None = None  # admin-initiated password reset

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str | None) -> str | None:
        return validate_password_strength(v) if v is not None else v


class RoleChange(BaseModel):
    role_id: int
