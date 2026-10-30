"""Sales orders.

Stock rule used here (the spec asks us to pick one):
  * Pending   - nothing is reserved yet. We only check stock is available.
  * Confirmed - stock is deducted (all lines, in one transaction).
  * Cancelled - if the order was already Confirmed the stock goes back.
  * Shipped / Delivered orders can no longer be cancelled.
"""
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import PageParams
from app.core.constants import ORDER_TRANSITIONS, OrderStatus
from app.core.errors import bad_request, conflict, not_found
from app.models import Customer, Inventory, Product, SalesOrder, SalesOrderItem
from app.schemas.order import OrderCreate, OrderItemIn, OrderUpdate
from app.services import inventory_service
from app.services.common import paginate

_LOAD = (
    joinedload(SalesOrder.customer),
    selectinload(SalesOrder.items).joinedload(SalesOrderItem.product),
)


def get_order(db: Session, order_id: int) -> SalesOrder:
    order = db.scalar(
        select(SalesOrder)
        .options(*_LOAD)
        .where(SalesOrder.order_id == order_id)
        .execution_options(populate_existing=True)
    )
    if order is None:
        raise not_found("Order")
    return order


def list_orders(
    db: Session, params: PageParams, status: str | None, customer_id: int | None,
    date_from: date | None, date_to: date | None,
) -> dict[str, Any]:
    stmt = select(SalesOrder).options(*_LOAD).order_by(
        SalesOrder.order_date.desc(), SalesOrder.order_id.desc()
    )
    if status:
        stmt = stmt.where(SalesOrder.status == status)
    if customer_id:
        stmt = stmt.where(SalesOrder.customer_id == customer_id)
    if date_from:
        stmt = stmt.where(SalesOrder.order_date >= date_from)
    if date_to:
        stmt = stmt.where(SalesOrder.order_date <= date_to)
    return paginate(db, stmt, params)


def list_orders_for_customer(db: Session, customer_id: int, params: PageParams) -> dict[str, Any]:
    if db.get(Customer, customer_id) is None:
        raise not_found("Customer")
    return list_orders(db, params, None, customer_id, None, None)


# --- building order lines -------------------------------------------------------
def _build_lines(db: Session, items: list[OrderItemIn]) -> tuple[list[SalesOrderItem], Decimal]:
    """Validate the requested products + stock and build the order lines.

    Two queries total (products, stock) no matter how many lines the order has.
    """
    ids = [i.product_id for i in items]
    products = {p.product_id: p for p in db.scalars(select(Product).where(Product.product_id.in_(ids)))}
    stock = dict(
        db.execute(
            select(Inventory.product_id, Inventory.quantity_in_stock)
            .where(Inventory.product_id.in_(ids))
        ).all()
    )

    lines: list[SalesOrderItem] = []
    total = Decimal("0.00")
    for item in items:
        product = products.get(item.product_id)
        if product is None:
            raise bad_request(f"Product {item.product_id} does not exist")
        if not product.is_active:
            raise bad_request(f"Product '{product.name}' is not active")
        available = stock.get(item.product_id, 0)
        if available < item.quantity:
            raise conflict(
                f"Insufficient stock for '{product.name}': "
                f"requested {item.quantity}, available {available}"
            )
        lines.append(
            SalesOrderItem(
                product_id=item.product_id, quantity=item.quantity, unit_price=item.unit_price
            )
        )
        total += item.unit_price * item.quantity
    return lines, total


# --- create / update -------------------------------------------------------------
def create_order(db: Session, data: OrderCreate) -> SalesOrder:
    customer = db.get(Customer, data.customer_id)
    if customer is None:
        raise bad_request("Customer does not exist")
    if not customer.is_active:
        raise bad_request("Customer is inactive")

    lines, total = _build_lines(db, data.items)
    order = SalesOrder(
        customer_id=data.customer_id,
        order_date=data.order_date,  # None -> today
        notes=data.notes,
        status=OrderStatus.PENDING,
        total_amount=total,
        items=lines,
    )
    db.add(order)
    db.commit()
    return get_order(db, order.order_id)


def update_order(db: Session, order_id: int, data: OrderUpdate) -> SalesOrder:
    order = get_order(db, order_id)
    if order.status != OrderStatus.PENDING:
        raise conflict("Only Pending orders can be edited")

    changes = data.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in changes.items():
        if value is not None or field == "notes":
            setattr(order, field, value)

    if data.items is not None:
        # Replace every line; delete-orphan removes the old ones for us.
        lines, total = _build_lines(db, data.items)
        order.items = lines
        order.total_amount = total

    db.commit()
    return get_order(db, order_id)


# --- status workflow ---------------------------------------------------------------
def change_status(db: Session, order_id: int, new_status: str) -> SalesOrder:
    order = get_order(db, order_id)

    if new_status == OrderStatus.CANCELLED:
        return cancel_order(db, order_id)

    if new_status not in ORDER_TRANSITIONS.get(order.status, set()):
        raise conflict(f"An order cannot move from {order.status} to {new_status}")

    if new_status == OrderStatus.CONFIRMED:
        _deduct_order_stock(db, order)

    order.status = new_status
    db.commit()
    return get_order(db, order_id)


def cancel_order(db: Session, order_id: int) -> SalesOrder:
    order = get_order(db, order_id)
    if OrderStatus.CANCELLED not in ORDER_TRANSITIONS.get(order.status, set()):
        raise conflict(f"A {order.status} order cannot be cancelled")

    if order.status == OrderStatus.CONFIRMED:
        # Stock was taken when the order was confirmed - give it back.
        for line in order.items:
            inventory_service.add_stock(db, line.product_id, line.quantity)

    order.status = OrderStatus.CANCELLED
    db.commit()
    return get_order(db, order_id)


def _deduct_order_stock(db: Session, order: SalesOrder) -> None:
    """Take stock for every line. If any line is short the whole thing is
    rolled back, so an order is never half-confirmed."""
    # Always lock products in the same order (by id) so two orders confirming
    # at the same time can't deadlock each other.
    for line in sorted(order.items, key=lambda l: l.product_id):
        if not inventory_service.deduct_stock(db, line.product_id, line.quantity):
            name = line.product.name
            db.rollback()
            raise conflict(f"Insufficient stock for '{name}' - order cannot be confirmed")
