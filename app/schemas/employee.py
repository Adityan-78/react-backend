from datetime import date

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class EmployeeOut(ORMModel):
    employee_id: int
    user_id: int
    name: str
    email: EmailStr
    role: str = Field(validation_alias="role_name")
    designation: str | None = None
    department: str | None = None
    phone: str | None = None
    hire_date: date | None = None
    is_active: bool


class EmployeeCreate(BaseModel):
    user_id: int
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    hire_date: date | None = None  # defaults to today


class EmployeeUpdate(BaseModel):
    designation: str | None = Field(default=None, max_length=100)
    department: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    hire_date: date | None = None
