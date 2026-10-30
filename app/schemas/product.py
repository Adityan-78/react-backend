from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ProductOut(ORMModel):
    product_id: int
    name: str
    description: str | None = None
    unit_measure: str | None = None
    is_active: bool


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=255)
    unit_measure: str | None = Field(default=None, max_length=30)
    # A product always gets an inventory row; these seed it.
    initial_stock: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=255)
    unit_measure: str | None = Field(default=None, max_length=30)
    is_active: bool | None = None


class AvailabilityOut(BaseModel):
    product_id: int
    product_name: str
    is_active: bool
    requested: int
    available: int
    is_available: bool
