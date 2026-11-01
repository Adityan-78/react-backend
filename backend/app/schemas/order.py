from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field
from app.schemas.common import ORMModel

class OrderCreate(BaseModel):
    customer_id: int
    order_date: date | None = None
    total_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    notes: str | None = Field(default=None, max_length=500)

class OrderUpdate(BaseModel):
    order_date: date | None = None
    total_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    notes: str | None = Field(default=None, max_length=500)

class OrderStatusUpdate(BaseModel):
    status: Literal["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"]

class OrderOut(ORMModel):
    order_id: int
    customer_id: int
    customer_name: str
    order_date: date
    status: str
    total_amount: Decimal
    notes: str | None = None
