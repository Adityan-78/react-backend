from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from app.schemas.common import ORMModel
class CustomerOut(ORMModel):
    customer_id: int
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    created_at: datetime
class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)
class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)
