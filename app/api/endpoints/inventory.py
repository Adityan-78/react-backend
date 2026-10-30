from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, Paging, require_roles
from app.core.constants import Perm
from app.schemas.common import Page
from app.schemas.inventory import InventoryOut, InventoryUpdate, StockMovement
from app.services import inventory_service

router = APIRouter()

view = Depends(require_roles(*Perm.INVENTORY_VIEW))
low_view = Depends(require_roles(*Perm.INVENTORY_LOW_STOCK))
manage = Depends(require_roles(*Perm.INVENTORY_MANAGE))


@router.get("", response_model=Page[InventoryOut], dependencies=[view])
def list_inventory(
    db: DbSession, params: Paging,
    search: Annotated[str | None, Query(max_length=100)] = None,
    low_only: bool = False,
):
    return inventory_service.list_inventory(db, params, search, low_only)


# Static path first - see the note in products.py.
@router.get("/low-stock", response_model=Page[InventoryOut], dependencies=[low_view])
def low_stock(db: DbSession, params: Paging):
    """Products at or below the configured application-level low-stock threshold."""
    return inventory_service.list_low_stock(db, params)


@router.get("/{product_id}", response_model=InventoryOut, dependencies=[view])
def get_inventory(product_id: int, db: DbSession):
    return inventory_service.get_inventory(db, product_id)


@router.put("/{product_id}", response_model=InventoryOut, dependencies=[manage])
def update_inventory(product_id: int, data: InventoryUpdate, db: DbSession):
    """Set the absolute stock quantity (e.g. after a physical stock count)."""
    return inventory_service.set_inventory(db, product_id, data)


@router.post("/{product_id}/add", response_model=InventoryOut, dependencies=[manage])
def add_stock(product_id: int, data: StockMovement, db: DbSession):
    """Add received stock."""
    return inventory_service.receive_stock(db, product_id, data.quantity)


@router.post("/{product_id}/reduce", response_model=InventoryOut, dependencies=[manage])
def reduce_stock(product_id: int, data: StockMovement, db: DbSession):
    """Remove stock (409 if that would take it below zero)."""
    return inventory_service.issue_stock(db, product_id, data.quantity)
