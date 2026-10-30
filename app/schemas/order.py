from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=1_000_000)
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class OrderItemOut(ORMModel):
    order_item_id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


def _no_duplicate_products(items: list[OrderItemIn]) -> list[OrderItemIn]:
    ids = [i.product_id for i in items]
    if len(ids) != len(set(ids)):
        raise ValueError("Each product may appear only once per order")
    return items


class OrderCreate(BaseModel):
    customer_id: int
    order_date: date | None = None  # defaults to today
    notes: str | None = Field(default=None, max_length=500)
    items: list[OrderItemIn] = Field(min_length=1, max_length=200)

    _unique = field_validator("items")(_no_duplicate_products)


class OrderUpdate(BaseModel):
    """Only Pending orders can be edited. Sending `items` replaces all lines."""

    order_date: date | None = None
    notes: str | None = Field(default=None, max_length=500)
    items: list[OrderItemIn] | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("items")
    @classmethod
    def _unique(cls, v):
        return _no_duplicate_products(v) if v is not None else v


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
    items: list[OrderItemOut]

