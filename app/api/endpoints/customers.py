from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DbSession, Paging, require_roles
from app.core.constants import Perm
from app.schemas.common import Page
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.schemas.order import OrderOut
from app.services import customer_service, order_service

router = APIRouter()

view = Depends(require_roles(*Perm.CUSTOMER_VIEW))
create = Depends(require_roles(*Perm.CUSTOMER_CREATE))
update = Depends(require_roles(*Perm.CUSTOMER_UPDATE))
admin = Depends(require_roles(*Perm.ADMIN_ONLY))
orders_view = Depends(require_roles(*Perm.CUSTOMER_ORDERS))


@router.get("", response_model=Page[CustomerOut], dependencies=[view])
def list_customers(
    db: DbSession, params: Paging,
    search: Annotated[str | None, Query(max_length=100)] = None,
    include_inactive: bool = False,
):
    return customer_service.list_customers(db, params, search, include_inactive)


@router.get("/{customer_id}/orders", response_model=Page[OrderOut], dependencies=[orders_view])
def customer_orders(customer_id: int, db: DbSession, params: Paging):
    """All orders placed by one customer."""
    return order_service.list_orders_for_customer(db, customer_id, params)


@router.get("/{customer_id}", response_model=CustomerOut, dependencies=[view])
def get_customer(customer_id: int, db: DbSession):
    return customer_service.get_customer(db, customer_id)


@router.post("", response_model=CustomerOut, status_code=201, dependencies=[create])
def create_customer(data: CustomerCreate, db: DbSession):
    return customer_service.create_customer(db, data)


@router.put("/{customer_id}", response_model=CustomerOut, dependencies=[update])
def update_customer(customer_id: int, data: CustomerUpdate, db: DbSession):
    return customer_service.update_customer(db, customer_id, data)


@router.delete("/{customer_id}", status_code=204, dependencies=[admin])
def deactivate_customer(customer_id: int, db: DbSession):
    """Soft delete: past orders stay linked to the customer."""
    customer_service.deactivate_customer(db, customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
