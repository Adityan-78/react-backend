"""Stock levels and stock movements.

Stock is only ever changed with a single conditional UPDATE statement, e.g.
    UPDATE Inventory SET qty = qty - 5 WHERE product_id = 1 AND qty >= 5
The database applies the check and the change as one atomic step, so two people
working at the same moment can never push stock below zero (no read-then-write
race), and no explicit row locks are needed.
"""
from typing import Any

from sqlalchemy import select, true, update
from sqlalchemy.orm import Session, joinedload

from app.api.deps import PageParams
from app.core.errors import conflict, not_found
from app.models import Inventory, Product
from app.models._helpers import today
from app.schemas.inventory import InventoryUpdate
from app.services.common import like, paginate

_LOAD = (joinedload(Inventory.product),)


# --- low-level stock operations (also used by orders / purchase requests) ----
def deduct_stock(db: Session, product_id: int, quantity: int) -> bool:
    """Remove stock if enough exists. Returns False when there isn't enough.
    Does not commit - the caller decides when the whole business action is done."""
    result = db.execute(
        update(Inventory)
        .where(Inventory.product_id == product_id, Inventory.quantity_in_stock >= quantity)
        .values(
            quantity_in_stock=Inventory.quantity_in_stock - quantity,
            last_updated=today(),
        )
    )
    return result.rowcount == 1


def add_stock(db: Session, product_id: int, quantity: int) -> None:
    """Add stock, creating the inventory row first if the product has none yet."""
    result = db.execute(
        update(Inventory)
        .where(Inventory.product_id == product_id)
        .values(
            quantity_in_stock=Inventory.quantity_in_stock + quantity,
            last_updated=today(),
        )
    )
    if result.rowcount == 0:
        db.add(Inventory(product_id=product_id, quantity_in_stock=quantity, reorder_level=0))
        db.flush()


# --- queries -------------------------------------------------------------------
def _ensure_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise not_found("Product")
    return product


def get_inventory(db: Session, product_id: int) -> Inventory:
    inv = db.scalar(
        select(Inventory)
        .options(*_LOAD)
        .where(Inventory.product_id == product_id)
        .execution_options(populate_existing=True)
    )
    if inv is None:
        # Product exists but has no stock row yet -> create it with zero stock.
        _ensure_product(db, product_id)
        db.add(Inventory(product_id=product_id, quantity_in_stock=0, reorder_level=0))
        db.commit()
        return get_inventory(db, product_id)
    return inv


def list_inventory(
    db: Session, params: PageParams, search: str | None, low_only: bool,
) -> dict[str, Any]:
    stmt = (
        select(Inventory).options(*_LOAD).join(Product)
        .where(Product.is_active == true())
        .order_by(Product.name, Inventory.inventory_id)
    )
    if search:
        stmt = stmt.where(like(Product.name, search))
    if low_only:
        stmt = stmt.where(Inventory.quantity_in_stock <= Inventory.reorder_level)
    return paginate(db, stmt, params)


def list_low_stock(db: Session, params: PageParams) -> dict[str, Any]:
    """Active products at or below their reorder level, most urgent first."""
    stmt = (
        select(Inventory).options(*_LOAD).join(Product)
        .where(
            Product.is_active == true(),
            Inventory.quantity_in_stock <= Inventory.reorder_level,
        )
        .order_by(Inventory.quantity_in_stock, Product.name)
    )
    return paginate(db, stmt, params)


# --- changes -------------------------------------------------------------------
def set_inventory(db: Session, product_id: int, data: InventoryUpdate) -> Inventory:
    inv = get_inventory(db, product_id)
    if data.quantity_in_stock is not None:
        inv.quantity_in_stock = data.quantity_in_stock
    if data.reorder_level is not None:
        inv.reorder_level = data.reorder_level
    inv.last_updated = today()
    db.commit()
    return get_inventory(db, product_id)


def receive_stock(db: Session, product_id: int, quantity: int) -> Inventory:
    _ensure_product(db, product_id)
    add_stock(db, product_id, quantity)
    db.commit()
    return get_inventory(db, product_id)


def issue_stock(db: Session, product_id: int, quantity: int) -> Inventory:
    _ensure_product(db, product_id)
    if not deduct_stock(db, product_id, quantity):
        db.rollback()
        raise conflict("Not enough stock to reduce by that quantity")
    db.commit()
    return get_inventory(db, product_id)
