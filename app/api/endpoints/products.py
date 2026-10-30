from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DbSession, Paging, require_roles
from app.core.constants import Perm
from app.schemas.common import Page
from app.schemas.product import (
    AvailabilityOut, ProductCreate, ProductOut, ProductUpdate,
)
from app.services import product_service

router = APIRouter()

view = Depends(require_roles(*Perm.PRODUCT_VIEW))
active_view = Depends(require_roles(*Perm.PRODUCT_ACTIVE_VIEW))
manage = Depends(require_roles(*Perm.PRODUCT_MANAGE))
availability_view = Depends(require_roles(*Perm.AVAILABILITY))

Search = Annotated[str | None, Query(max_length=100)]


@router.get("", response_model=Page[ProductOut], dependencies=[view])
def list_products(
    db: DbSession, params: Paging, search: Search = None, is_active: bool | None = None,
):
    return product_service.list_products(db, params, search, is_active)


# NOTE: static paths ("/active") must be declared BEFORE "/{product_id}",
# otherwise FastAPI would try to read the word "active" as a product id.
@router.get("/active", response_model=Page[ProductOut], dependencies=[active_view])
def list_active_products(db: DbSession, params: Paging, search: Search = None):
    return product_service.list_products(db, params, search, None, only_active=True)


@router.get(
    "/{product_id}/availability", response_model=AvailabilityOut,
    dependencies=[availability_view],
)
def product_availability(
    product_id: int, db: DbSession, quantity: Annotated[int, Query(gt=0)] = 1,
):
    """Is there enough stock to sell `quantity` units of this product?"""
    return product_service.check_availability(db, product_id, quantity)


@router.get("/{product_id}", response_model=ProductOut, dependencies=[view])
def get_product(product_id: int, db: DbSession):
    return product_service.get_product(db, product_id)


@router.post("", response_model=ProductOut, status_code=201, dependencies=[manage])
def create_product(data: ProductCreate, db: DbSession):
    return product_service.create_product(db, data)


@router.put("/{product_id}", response_model=ProductOut, dependencies=[manage])
def update_product(product_id: int, data: ProductUpdate, db: DbSession):
    return product_service.update_product(db, product_id, data)


@router.delete("/{product_id}", status_code=204, dependencies=[manage])
def deactivate_product(product_id: int, db: DbSession):
    """Soft delete: the product is marked inactive."""
    product_service.deactivate_product(db, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
