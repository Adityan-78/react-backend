"""Sales-order header operations matching dbo.Sales_Order.

The supplied database stores customer, date, status, total and notes only. It
has no order-line table, product_id, quantity or unit_price on an order. For
that reason this service does not reserve/deduct stock; inventory is managed
through the inventory endpoints and product availability endpoint.
"""
from datetime import date
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from app.api.deps import PageParams
from app.core.constants import ORDER_TRANSITIONS, OrderStatus
from app.core.errors import bad_request, conflict, not_found
from app.models import Customer, SalesOrder
from app.schemas.order import OrderCreate, OrderUpdate
from app.services.common import paginate

_LOAD = (joinedload(SalesOrder.customer),)

def get_order(db: Session, order_id: int) -> SalesOrder:
    obj = db.scalar(select(SalesOrder).options(*_LOAD).where(SalesOrder.order_id == order_id).execution_options(populate_existing=True))
    if obj is None: raise not_found("Order")
    return obj

def list_orders(db: Session, params: PageParams, status: str | None, customer_id: int | None, date_from: date | None, date_to: date | None) -> dict[str, Any]:
    stmt = select(SalesOrder).options(*_LOAD).order_by(SalesOrder.order_date.desc(), SalesOrder.order_id.desc())
    if status: stmt = stmt.where(SalesOrder.status == status)
    if customer_id: stmt = stmt.where(SalesOrder.customer_id == customer_id)
    if date_from: stmt = stmt.where(SalesOrder.order_date >= date_from)
    if date_to: stmt = stmt.where(SalesOrder.order_date <= date_to)
    return paginate(db, stmt, params)

def list_orders_for_customer(db: Session, customer_id: int, params: PageParams) -> dict[str, Any]:
    if db.get(Customer, customer_id) is None: raise not_found("Customer")
    return list_orders(db, params, None, customer_id, None, None)

def create_order(db: Session, data: OrderCreate) -> SalesOrder:
    if db.get(Customer, data.customer_id) is None: raise bad_request("Customer does not exist")
    obj = SalesOrder(customer_id=data.customer_id, order_date=data.order_date, total_amount=data.total_amount, notes=data.notes, status=OrderStatus.PENDING)
    db.add(obj); db.commit(); return get_order(db, obj.order_id)

def update_order(db: Session, order_id: int, data: OrderUpdate) -> SalesOrder:
    obj = get_order(db, order_id)
    if obj.status != OrderStatus.PENDING: raise conflict("Only Pending orders can be edited")
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None or field == "notes": setattr(obj, field, value)
    db.commit(); return get_order(db, order_id)

def change_status(db: Session, order_id: int, new_status: str) -> SalesOrder:
    obj = get_order(db, order_id)
    if new_status == OrderStatus.CANCELLED: return cancel_order(db, order_id)
    if new_status not in ORDER_TRANSITIONS.get(obj.status, set()): raise conflict(f"An order cannot move from {obj.status} to {new_status}")
    obj.status = new_status; db.commit(); return get_order(db, order_id)

def cancel_order(db: Session, order_id: int) -> SalesOrder:
    obj = get_order(db, order_id)
    if OrderStatus.CANCELLED not in ORDER_TRANSITIONS.get(obj.status, set()): raise conflict(f"A {obj.status} order cannot be cancelled")
    obj.status = OrderStatus.CANCELLED; db.commit(); return get_order(db, order_id)
