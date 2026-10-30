from datetime import date

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORMModel


class InventoryOut(ORMModel):
    inventory_id: int
    product_id: int
    product_name: str
    unit_measure: str | None = None
    quantity_in_stock: int
    reorder_level: int
    last_updated: date | None = None
    is_low_stock: bool


class InventoryUpdate(BaseModel):
    """Set absolute values (e.g. after a physical stock count)."""

    quantity_in_stock: int | None = Field(default=None, ge=0)
    reorder_level: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _need_something(self) -> "InventoryUpdate":
        if self.quantity_in_stock is None and self.reorder_level is None:
            raise ValueError("Provide quantity_in_stock and/or reorder_level")
        return self


class StockMovement(BaseModel):
    """Body for the add / reduce endpoints."""

    quantity: int = Field(gt=0)
