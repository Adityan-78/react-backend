from datetime import date

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, Paging, require_roles
from app.core.constants import Perm
from app.schemas.common import Page
from app.schemas.order import OrderCreate, OrderOut, OrderStatusUpdate, OrderUpdate
from app.services import order_service

router = APIRouter()

view = Depends(require_roles(*Perm.ORDER_VIEW))
create = Depends(require_roles(*Perm.ORDER_CREATE))
change_status = Depends(require_roles(*Perm.ORDER_STATUS))


@router.get("", response_model=Page[OrderOut], dependencies=[view])
def list_orders(
    db: DbSession, params: Paging, status: str | None = None,
    customer_id: int | None = None, date_from: date | None = None,
    date_to: date | None = None,
):
    return order_service.list_orders(db, params, status, customer_id, date_from, date_to)


@router.get("/{order_id}", response_model=OrderOut, dependencies=[view])
def get_order(order_id: int, db: DbSession):
    return order_service.get_order(db, order_id)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED, dependencies=[create])
def create_order(data: OrderCreate, db: DbSession):
    """Create a sales-order header. The supplied database has no order-line table, so stock is not changed by this endpoint."""
    return order_service.create_order(db, data)


@router.put("/{order_id}", response_model=OrderOut, dependencies=[create])
def update_order(order_id: int, data: OrderUpdate, db: DbSession):
    """Edit a Pending order (notes, date or total amount)."""
    return order_service.update_order(db, order_id, data)


@router.put("/{order_id}/status", response_model=OrderOut, dependencies=[change_status])
def update_status(order_id: int, data: OrderStatusUpdate, db: DbSession):
    """Move an order along: Pending -> Confirmed -> Shipped -> Delivered."""
    return order_service.change_status(db, order_id, data.status)


@router.put("/{order_id}/cancel", response_model=OrderOut, dependencies=[change_status])
def cancel_order(order_id: int, db: DbSession):
    """Cancel a Pending/Confirmed order. Inventory is managed separately."""
    return order_service.cancel_order(db, order_id)
