from datetime import date
from pydantic import BaseModel, Field, model_validator
from app.schemas.common import ORMModel
class InventoryOut(ORMModel):
    inventory_id: int
    product_id: int
    product_name: str
    unit_measure: str | None = None
    quantity_in_stock: int
    reorder_level: int  # application-configured threshold, not a DB column
    last_updated: date | None = None
    is_low_stock: bool
class InventoryUpdate(BaseModel):
    quantity_in_stock: int = Field(ge=0)
class StockMovement(BaseModel):
    quantity: int = Field(gt=0)
