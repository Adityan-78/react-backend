"""Product catalogue and the stock-availability check."""
from typing import Any

from sqlalchemy import select, true
from sqlalchemy.orm import Session

from app.api.deps import PageParams
from app.core.errors import not_found
from app.models import Inventory, Product
from app.schemas.product import ProductCreate, ProductUpdate
from app.services.common import like, paginate


def get_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise not_found("Product")
    return product


def list_products(
    db: Session, params: PageParams, search: str | None,
    is_active: bool | None, only_active: bool = False,
) -> dict[str, Any]:
    stmt = select(Product).order_by(Product.name, Product.product_id)
    if only_active:
        stmt = stmt.where(Product.is_active == true())
    elif is_active is not None:
        stmt = stmt.where(Product.is_active == is_active)
    if search:
        stmt = stmt.where(like(Product.name, search))
    return paginate(db, stmt, params)


def create_product(db: Session, data: ProductCreate) -> Product:
    """Create the product and its inventory row together, in one transaction."""
    product = Product(
        name=data.name.strip(),
        description=data.description,
        unit_measure=data.unit_measure,
    )
    db.add(product)
    db.flush()  # gives us product.product_id without committing yet
    db.add(
        Inventory(
            product_id=product.product_id,
            quantity_in_stock=data.initial_stock,
        )
    )
    db.commit()
    return product


def update_product(db: Session, product_id: int, data: ProductUpdate) -> Product:
    product = get_product(db, product_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    return product


def deactivate_product(db: Session, product_id: int) -> None:
    """Soft delete - orders and purchase requests keep referencing the product."""
    product = get_product(db, product_id)
    product.is_active = False
    db.commit()


def check_availability(db: Session, product_id: int, quantity: int) -> dict:
    product = get_product(db, product_id)
    available = db.scalar(
        select(Inventory.quantity_in_stock).where(Inventory.product_id == product_id)
    ) or 0
    return {
        "product_id": product.product_id,
        "product_name": product.name,
        "is_active": product.is_active,
        "requested": quantity,
        "available": available,
        # An inactive product can't be sold even if units are physically in stock.
        "is_available": product.is_active and available >= quantity,
    }
