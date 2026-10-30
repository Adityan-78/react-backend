from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


class PRItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=1_000_000)
    estimated_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    notes: str | None = Field(default=None, max_length=500)


class PRItemUpdate(BaseModel):
    quantity: int | None = Field(default=None, gt=0, le=1_000_000)
    estimated_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    notes: str | None = Field(default=None, max_length=500)


class PRItemOut(ORMModel):
    pr_item_id: int
    pr_id: int
    product_id: int
    product_name: str
    quantity: int
    estimated_price: Decimal | None = None
    notes: str | None = None
    approval_id: int | None = None
    approved_date: date | None = None
    status: str


def _unique_products(items):
    if items is None:
        return items
    ids = [i.product_id for i in items]
    if len(ids) != len(set(ids)):
        raise ValueError("Each product may appear only once per purchase request")
    return items


class PRCreate(BaseModel):
    request_date: date | None = None
    # Items can be added now or later via POST /purchase-requests/{id}/items.
    items: list[PRItemIn] = Field(default_factory=list, max_length=200)

    _unique = field_validator("items")(_unique_products)


class PRUpdate(BaseModel):
    """Allowed only while the request is still waiting for a decision."""

    request_date: date | None = None
    items: list[PRItemIn] | None = Field(default=None, max_length=200)  # replaces all items

    _unique = field_validator("items")(_unique_products)


class PRRejectIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class PRStatusUpdate(BaseModel):
    status: Literal["Completed", "Closed"]
    # When completing a request, optionally add the ordered quantities to stock.
    receive_stock: bool = False


class PROut(ORMModel):
    pr_id: int
    raised_by: int
    raised_by_name: str
    request_date: date
    status: str
    approval_status: str
    rejection_reason: str | None = None
    total_estimated: Decimal
    items: list[PRItemOut]
